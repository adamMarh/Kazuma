import { BotService } from '@app/services/bot/bot.service';
import { ChallengeService } from '@app/services/challenge/challenge.service';
import { CombatService } from '@app/services/combat/combat.service';
import { CurrencyService } from '@app/services/currency/currency.service';
import { StatsService } from '@app/services/stats/stats.service';
import { Game } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { LOBBY_EVENTS } from '@common/socket-events/lobby.events';
import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

interface TimerRefs {
    preTimer?: { cancel: () => void };
    turnTimer?: TimerObject;
}

interface TimerObject {
    cancel: () => void;
    remaining: number;
}

@Injectable()
export class TurnService {
    private activeTimers: Map<string, TimerRefs> = new Map();
    private timerPaused: boolean = false;
    private readonly logger = new Logger(TurnService.name);

    constructor(
        private readonly botService: BotService,
        private readonly combatService: CombatService,
        private readonly statsService: StatsService,
        private readonly currencyService: CurrencyService,
        private readonly challengeService: ChallengeService,
    ) {}

    orderPlayerTurns(game: Game): void {
        game.players.sort((a, b) => b.speed - a.speed || Math.random() - 0.5);
        game.playerTurns = game.players.filter((p) => !p.hasLeft && !p.isEliminated).map((p) => p.socketId);
        const firstAvailablePlayer = game.players.find((p) => !p.hasLeft && !p.isEliminated);
        if (firstAvailablePlayer) {
            firstAvailablePlayer.isMyTurn = true;
            firstAvailablePlayer.turnsPlayed = 1;
        }
    }

    orderTurnsAfterDropIn(game: Game): void {
        const currentPlayerId =
            (game.playerTurns && typeof game.currentPlayerIndex === 'number' && game.playerTurns[game.currentPlayerIndex]) ||
            (game.players.find((p) => p.isMyTurn) || {}).socketId;
        game.players.sort((a, b) => b.speed - a.speed || Math.random() - 0.5);
        game.playerTurns = game.players.filter((p) => !p.hasLeft && !p.isEliminated).map((p) => p.socketId);
        const newIndex = game.playerTurns.findIndex((id) => id === currentPlayerId);
        game.currentPlayerIndex = newIndex >= 0 ? newIndex : 0;
        game.players.forEach((p: Player) => (p.isMyTurn = p.socketId === game.playerTurns[game.currentPlayerIndex]));
    }

    startPreTimer(server: Server, gameId: string, duration: number = 3, onComplete: () => void): { cancel: () => void } {
        server.to(gameId).emit(GAME_EVENTS.PRE_TIMER_STARTED);
        let secondsRemaining = duration;
        const interval = setInterval(() => {
            if (this.timerPaused) {
                return;
            }
            secondsRemaining--;
            server.to(gameId).emit(GAME_EVENTS.PRE_TIMER_TICK, { secondsRemaining });
            if (secondsRemaining <= 0) {
                clearInterval(interval);
                onComplete();
            }
        }, 1000);
        return { cancel: () => clearInterval(interval) };
    }

    startTurnTimer(server: Server, game: Game, duration: number = 10, onComplete: (timerPaused: boolean) => void): TimerObject {
        server.to(game.gameId).emit(GAME_EVENTS.TURN_TIMER_STARTED);
        let secondsRemaining = duration;
        const timerObject: TimerObject = {
            cancel: () => clearInterval(interval),
            remaining: secondsRemaining,
        };

        const interval: NodeJS.Timeout = setInterval(() => {
            if (this.timerPaused) {
                clearInterval(interval);
                timerObject.remaining = secondsRemaining;
                onComplete(true);
                return;
            }
            secondsRemaining--;
            timerObject.remaining = secondsRemaining;
            server.to(game.gameId).emit(GAME_EVENTS.TURN_TIMER_TICK, { secondsRemaining });
            if (secondsRemaining <= 0) {
                clearInterval(interval);
                onComplete(false);
                this.turnBehaviour(server, game);
            }
        }, 1000);

        return timerObject;
    }

    startTimers(server: Server, gameId: string, targetPlayer: Player, game: Game): void {
        if (this.activeTimers.has(gameId)) {
            return;
        }

        const timers: TimerRefs = {};
        this.activeTimers.set(gameId, timers);
        timers.preTimer = this.startPreTimer(server, gameId, 3, () => {
            server.to(gameId).emit(GAME_EVENTS.ACTION_ENDED, { player: targetPlayer, players: game.players });
            timers.turnTimer = this.startTurnTimer(server, game, 30, (timerPaused: boolean) => {
                if (!timerPaused) {
                    this.activeTimers.delete(gameId);
                }
            });
        });
    }

    pauseTimers(gameId: string): void {
        const timers = this.activeTimers.get(gameId);
        if (timers) {
            if (timers.preTimer) {
                timers.preTimer.cancel();
                delete timers.preTimer;
            }
            if (timers.turnTimer) {
                this.timerPaused = true;
            }
        }
    }

    cancelTimers(gameId: string): void {
        const timers = this.activeTimers.get(gameId);
        if (timers) {
            this.timerPaused = false;
            if (timers.preTimer) timers.preTimer.cancel();
            if (timers.turnTimer) timers.turnTimer.cancel();
            this.activeTimers.delete(gameId);
        }
    }

    resumeTimers(server: Server, game: Game): void {
        const timers = this.activeTimers.get(game.gameId);
        this.timerPaused = false;
        if (timers && timers.turnTimer && timers.turnTimer.remaining > 0) {
            timers.turnTimer = this.startTurnTimer(server, game, timers.turnTimer.remaining, (timerPaused: boolean) => {
                if (!timerPaused) {
                    this.activeTimers.delete(game.gameId);
                }
            });
        }
    }

    nextTurn(game: Game): Player {
        const currentPlayer = game.players.find((p) => p.socketId === game.playerTurns[game.currentPlayerIndex]);
        if (currentPlayer) {
            currentPlayer.isMyTurn = false;
        }
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.playerTurns.length;

        const newCurrentPlayer = game.players.find((player: Player) => player.socketId === game.playerTurns[game.currentPlayerIndex]);

        if (!newCurrentPlayer) {
            throw new Error('No current player found');
        }

        newCurrentPlayer.isMyTurn = true;
        newCurrentPlayer.actionPoints = game.map.actionPoints || 1;
        newCurrentPlayer.movementPoints = newCurrentPlayer.speed;
        newCurrentPlayer.turnsPlayed = (newCurrentPlayer.turnsPlayed || 0) + 1;
        return newCurrentPlayer;
    }

    async turnBehaviour(server: Server, game: Game) {
        if (game.ended) {
            // Await rewards & challenges BEFORE notifying clients, so the
            // end-game screen has all data (balance, challenge result) immediately.
            await Promise.all([
                this.currencyService.applyEndGameRewards(game, server).catch((e) => this.logger.error('[Rewards]', e)),
                this.evaluateAndDistributeChallenges(game, server).catch((e) => this.logger.error('[Challenges]', e)),
            ]);
            server.to(game.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
            this.cancelTimers(game.gameId);
            this.statsService.persistGameStats(game);
            return;
        }
        this.cancelTimers(game.gameId);
        const newCurr = this.nextTurn(game);
        if (newCurr.isBot) {
            server.to(game.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
            server.to(game.gameId).emit(GAME_EVENTS.PLAYER_TURN_CHANGED, game.playerTurns[game.currentPlayerIndex]);
            this.startTimers(server, game.gameId, newCurr, game);
        }
        const timestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false });
        const logEntry = {
            timestamp,
            message: `Début de tour de ${newCurr.name}`,
            players: [newCurr.name],
            type: 'turn',
        };
        server.to(game.gameId).emit(GAME_EVENTS.LOG, logEntry);
        if (newCurr.isBot) {
            await this.delay(5000 + Math.random() * 5000);
            this.botService.runBotTurn(newCurr, server, game);
            server.to(game.gameId).emit(GAME_EVENTS.MAP_UPDATED, game.map);
            this.cancelTimers(game.gameId);
            await this.delay(2000 + Math.random() * 3000);
            if (!this.combatService.getCombatState(game.gameId) || !this.combatService.getCombatState(game.gameId).attacker) {
                await this.turnBehaviour(server, game);
            }
        } else {
            server.to(game.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
            server.to(game.gameId).emit(GAME_EVENTS.PLAYER_TURN_CHANGED, game.playerTurns[game.currentPlayerIndex]);
        }
    }

    private async delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async evaluateAndDistributeChallenges(game: Game, server: Server): Promise<void> {
        const humanPlayers = game.players.filter((p: Player) => !p.isBot && !p.hasLeft);
        const socketIds = humanPlayers.map((p: Player) => p.socketId);

        await Promise.all(
            humanPlayers.map(async (player: Player) => {
                const result = this.challengeService.evaluateChallenge(player.socketId, player, game);
                if (!result) return;

                // Emit result to client immediately, before slow Firestore persistence
                server.to(player.socketId).emit(GAME_EVENTS.CHALLENGE_RESULT, result);

                if (result.completed) {
                    await this.challengeService.persistCompletedChallenge(player.name, result, game.gameId);
                    this.logger.log(`[Challenges] "${player.name}" completed challenge "${result.challengeId}" → +${result.reward} coins`);
                } else {
                    this.logger.log(`[Challenges] "${player.name}" failed challenge "${result.challengeId}" (${result.progress}/${result.target})`);
                }
            }),
        );

        this.challengeService.clearChallenges(socketIds);
    }
}
