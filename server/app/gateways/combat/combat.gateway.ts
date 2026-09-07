import { BotService } from '@app/services/bot/bot.service';
import { CombatService } from '@app/services/combat/combat.service';
import { GameService as NewGameService } from '@app/services/game/game.service';
import { StatsService } from '@app/services/stats/stats.service';
import { TurnService } from '@app/services/turn/turn.service';
import { CombatState } from '@common/interfaces/combatState.interface';
import { Game } from '@common/interfaces/game.interface';
import { REASON } from '@common/socket-constants/game.constants';
import { COMBAT_EVENTS } from '@common/socket-events/combat.events';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { ITEM_EVENTS } from '@common/socket-events/item.events';
import { LOBBY_EVENTS } from '@common/socket-events/lobby.events';
import { MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
export class CombatGateway {
    @WebSocketServer() server: Server;

    constructor(
        private readonly combatService: CombatService,
        private readonly newGameService: NewGameService,
        private readonly turnService: TurnService,
        private readonly botService: BotService,
        private readonly statsService: StatsService,
    ) {}

    @SubscribeMessage(COMBAT_EVENTS.ATTACK_OPPONENT)
    async handleAttackOpponent(@MessageBody() payload: { gameId: string }) {
        const game = this.newGameService.getGame(payload.gameId);
        const combatState = this.combatService.getCombatState(game.gameId);
        if (!combatState.attacker) {
            return;
        }
        const result = this.combatService.attackOpponent(game);

        if (result.drankPotion) {
            this.server.to(game.gameId).emit(ITEM_EVENTS.ITEM_EFFECT_APPLIED, {
                playerId: result.combatState.attacker.socketId,
                itemType: 'potion',
                activated: true,
            });
        }

        if (result.flippedHourglass) {
            this.server.to(game.gameId).emit(ITEM_EVENTS.ITEM_EFFECT_APPLIED, {
                playerId: result.combatState.target.socketId,
                itemType: 'hourglass',
                activated: true,
            });
            const opponent = [combatState.attacker, combatState.target].find((p) => p.socketId !== combatState.combatInitiator.socketId);
            this.combatService.initCombat(combatState.combatInitiator, opponent, game, true);
            this.server.to(game.gameId).emit(COMBAT_EVENTS.COMBAT_STARTED, { combatState });
        }
        if (game.fastEliminationActive) {
            this.server.to(game.gameId).emit(COMBAT_EVENTS.COMBAT_STATE_UPDATE, { combatState: result.combatState });
        } else {
            [result.combatState.attacker.socketId, result.combatState.target.socketId].forEach((playerId) => {
                this.server.to(playerId).emit(COMBAT_EVENTS.COMBAT_STATE_UPDATE, { combatState: result.combatState });
            });
        }

        const attackTimestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false });
        const attackLogEntry = {
            timestamp: attackTimestamp,
            message:
                `Attaque de ${result.combatState.target.name} contre ${result.combatState.attacker.name} : ` +
                `jet d'attaque ${result.combatState.attackResult.attackDiceRoll}, ` +
                `jet de défense ${result.combatState.attackResult.defenseDiceRoll}, ` +
                `=> ${result.combatState.attackResult.damage} dégâts infligés`,
            players: [result.combatState.attacker.name, result.combatState.target.name],
            type: 'combat_attack',
        };
        this.server.to(game.gameId).emit(GAME_EVENTS.LOG, attackLogEntry);

        if (result.isDead) {
            this.server.to(combatState.target.socketId).emit(ITEM_EVENTS.ITEM_DROPPED, combatState.target.socketId);
            const winnerS = result.combatState.target;
            const loserS = result.combatState.attacker;
            if (loserS.isFlagHolder) {
                loserS.isFlagHolder = false;
            }

            if (game.fastEliminationActive) {
                this.newGameService.eliminatePlayer(game, loserS.socketId);
            }
            const combatResult = this.combatService.endCombat(game, winnerS);
            this.server.to(game.gameId).emit(COMBAT_EVENTS.COMBAT_ENDED, {
                combatState: combatResult.combatState,
                reason: REASON.DEATH,
                actionPlayer: combatResult.actionPlayer,
                gameEnded: combatResult.gameEnded,
            });

            if (combatResult.gameEnded) {
                this.statsService.persistGameStats(game);
            }
            this.server.to(game.gameId).emit(GAME_EVENTS.MAP_UPDATED, game.map);

            if (combatResult.gameEnded) {
                // Let turnBehaviour handle rewards, challenges, UPDATE_LOBBY
                await this.turnService.turnBehaviour(this.server, game);
            } else if (result.combatState.combatInitiator === loserS || winnerS.isBot) {
                this.server.to(game.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
                if (winnerS.isBot && winnerS.isMyTurn) {
                    this.botService.runBotTurn(winnerS, this.server, game);
                }
                await this.turnService.turnBehaviour(this.server, game);
            } else {
                this.server.to(game.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
                this.server.to(game.gameId).emit(GAME_EVENTS.ACTION_ENDED, {
                    player: winnerS,
                    players: game.players,
                });
                this.turnService.resumeTimers(this.server, game);
            }

            const timestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false });
            const logEntry = {
                timestamp,
                message: `Fin de combat : ${winnerS.name} a vaincu ${loserS.name}`,
                players: [winnerS.name, loserS.name],
                type: 'combat',
            };
            this.server.to(game.gameId).emit(GAME_EVENTS.LOG, logEntry);
            if (combatResult.gameEnded) {
                this.newGameService.finalizeGame(game);
            }
        } else {
            if (game.fastEliminationActive) {
                this.server.to(game.gameId).emit(COMBAT_EVENTS.TURN_CHANGED);
            } else {
                [result.combatState.attacker.socketId, result.combatState.target.socketId].forEach((playerId) => {
                    this.server.to(playerId).emit(COMBAT_EVENTS.TURN_CHANGED);
                });
            }
            this.handleBotActions(result.combatState, game);
        }
    }

    @SubscribeMessage(COMBAT_EVENTS.ATTEMPT_FLEE)
    handleAttemptFlee(@MessageBody() payload: { gameId: string }) {
        const game = this.newGameService.getGame(payload.gameId);
        const fleeingPlayer = this.combatService.getCombatState(game.gameId).attacker;
        const result = this.combatService.attemptFlee(game, fleeingPlayer);
        const combatState = this.combatService.getCombatState(game.gameId);
        if (!combatState || !combatState.inCombat) return;
        if (!fleeingPlayer || fleeingPlayer.hasLeft) return;

        const fleeTimestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false });
        const fleeLogEntry = {
            timestamp: fleeTimestamp,
            message: `Tentative d'évasion : ${fleeingPlayer.name} a ${result.fled ? 'réussi' : 'échoué'} sa tentative d'évasion`,
            players: [combatState.attacker.name, combatState.target.name],
            type: 'combat_flee',
        };
        this.server.to(game.gameId).emit(GAME_EVENTS.LOG, fleeLogEntry);

        if (result.hasCrystal) {
            this.server.to(fleeingPlayer.socketId).emit(ITEM_EVENTS.ITEM_EFFECT_APPLIED, {
                playerId: fleeingPlayer.socketId,
                itemType: 'crystal',
                activated: true,
            });
            return;
        }

        if (result.fled) {
            const timestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false });
            const logEntry = {
                timestamp,
                message: `Fin de combat : ${fleeingPlayer.name} s'est enfui !`,
                players: [combatState.attacker.name, combatState.target.name],
                type: 'combat_endflee',
            };
            this.server.to(game.gameId).emit(GAME_EVENTS.LOG, logEntry);

            const combatResult = this.combatService.endCombat(game, combatState.attacker);
            this.server.to(game.gameId).emit(COMBAT_EVENTS.COMBAT_ENDED, {
                combatState: combatResult.combatState,
                reason: REASON.FLED,
                actionPlayer: combatResult.actionPlayer,
                gameEnded: combatResult.gameEnded,
            });
            this.server.to(game.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
            this.server.to(game.gameId).emit(GAME_EVENTS.ACTION_ENDED, {
                player: combatResult.combatState.combatInitiator,
                players: game.players,
            });
            this.turnService.resumeTimers(this.server, game);
            if (combatResult.combatState.combatInitiator.isBot) {
                this.turnService.turnBehaviour(this.server, game);
            }
        } else {
            this.server.to(game.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
            this.server.to(game.gameId).emit(COMBAT_EVENTS.COMBAT_STATE_UPDATE, { combatState });
            this.server.to(game.gameId).emit(COMBAT_EVENTS.TURN_CHANGED);
            this.handleBotActions(combatState, game);
        }
    }

    @SubscribeMessage(COMBAT_EVENTS.START_TIMER)
    handleStartTimer(@MessageBody() payload: { gameId: string }) {
        const combatState = this.combatService.getCombatState(payload.gameId);

        if (!combatState.attacker || !combatState.target || combatState.attacker.hasLeft || combatState.target.hasLeft) {
            return;
        }

        const inCombat = combatState.inCombat;
        if (inCombat) {
            const canFlee = combatState.attacker.fleeAttempts < 2;
            this.server.to(payload.gameId).emit(COMBAT_EVENTS.TIMER_STATE, {
                timerStarted: true,
                timerPaused: false,
                delay: canFlee ? 5 : 3,
                targetPlayer: combatState.target,
            });
        }
    }

    async handleBotActions(combatState: CombatState, game: Game) {
        if (combatState.attacker.isBot) {
            if (!combatState.attacker.isAgressive && combatState.attacker.healthpoints < 4 && combatState.attacker.fleeAttempts < 2) {
                await this.delay(2000);
                this.handleAttemptFlee({ gameId: game.gameId });
            } else {
                await this.delay(2000);
                this.handleAttackOpponent({ gameId: game.gameId });
            }
        }
    }

    private async delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
