import { CombatService } from '@app/services/combat/combat.service';
import { CurrencyService } from '@app/services/currency/currency.service';
import { MovementService } from '@app/services/movement/movement.service';
import { CombatState } from '@common/interfaces/combatState.interface';
import { Game } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/interfaces/position.interface';
import { REASON } from '@common/socket-constants/game.constants';
import { COMBAT_EVENTS } from '@common/socket-events/combat.events';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { LOBBY_EVENTS } from '@common/socket-events/lobby.events';
import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class BotService {
    constructor(
        private readonly movementService: MovementService,
        private readonly combatService: CombatService,
        private readonly currencyService: CurrencyService,
    ) {}

    runBotTurn(currentBot: Player, server: Server, game: Game) {
        if (currentBot.isAgressive) {
            this.runAgressiveSequence(game, currentBot, server);
        } else {
            this.runPassiveSequence(game, currentBot, server);
        }
        currentBot.isMyTurn = false;
    }

    onlyBotsLeft(game: Game): boolean {
        const activePlayers = game.players.filter((p) => !p.hasLeft);
        return activePlayers.length > 0 && activePlayers.every((p) => p.isBot);
    }

    getAdjacentEnemy(bot: Player, game: Game): Player | undefined {
        const adjacentPositions: Position[] = [
            { x: bot.position.x, y: bot.position.y - 1 },
            { x: bot.position.x, y: bot.position.y + 1 },
            { x: bot.position.x - 1, y: bot.position.y },
            { x: bot.position.x + 1, y: bot.position.y },
        ];
        const playersToConsider = game.players.filter((p) => !game.eliminatedPlayers.includes(p) && p.socketId !== bot.socketId);
        for (const pos of adjacentPositions) {
            const enemy = playersToConsider.find((p) => p.position.x === pos.x && p.position.y === pos.y);
            if (enemy) {
                return enemy;
            }
        }
        return undefined;
    }

    findBestItem(bot: Player, game: Game, desiredItemTypes: string[]): Position | null {
        let bestPathLength = Infinity;
        let targetItemPos: Position | null = null;

        for (let y = 0; y < game.map.items.length; y++) {
            for (let x = 0; x < game.map.items[0].length; x++) {
                const item = game.map.items[y][x];
                if (item !== 'empty' && desiredItemTypes.includes(item)) {
                    const targetPos = { x, y };
                    const path = this.movementService.findShortestPath(bot, targetPos, game, game.map);
                    if (path.length > 0 && path.length < bestPathLength) {
                        bestPathLength = path.length;
                        targetItemPos = targetPos;
                    }
                }
            }
        }
        return targetItemPos;
    }

    moveToTarget(bot: Player, target: Position, game: Game, server: Server): void {
        const path = this.movementService.findShortestPath(bot, target, game, game.map);
        if (path.length > 0) {
            const result = this.movementService.movePlayer(bot, path, false, game);
            if (result.mapUpdated && result.encounteredItem) {
                const itemTimestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false });
                const pickupLogEntry = {
                    timestamp: itemTimestamp,
                    message: `${bot.name} a ramassé ${result.encounteredItem.type}`,
                    players: [bot.name],
                    type: 'item_pickup',
                };
                server.to(game.gameId).emit(GAME_EVENTS.LOG, pickupLogEntry);
            }
            server.to(game.gameId).emit(GAME_EVENTS.ACTION_ENDED, {
                player: bot,
                players: game.players,
                path: result.realPath,
            });
        }
    }

    getCTFAggressiveTarget(bot: Player, game: Game) {
        const playersToConsider = game.players.filter((p) => !game.eliminatedPlayers.includes(p) && p.socketId !== bot.socketId);
        const flagHolder = playersToConsider.find((p) => p.isFlagHolder && p.socketId !== bot.socketId);
        if (!flagHolder) return null;
        let nearestTarget: Position | null = null;
        let minPathLength = Infinity;
        const adjacentPositions: Position[] = [
            { x: flagHolder.position.x, y: flagHolder.position.y - 1 },
            { x: flagHolder.position.x, y: flagHolder.position.y + 1 },
            { x: flagHolder.position.x - 1, y: flagHolder.position.y },
            { x: flagHolder.position.x + 1, y: flagHolder.position.y },
        ];
        for (const pos of adjacentPositions) {
            const path = this.movementService.findShortestPath(bot, pos, game, game.map);
            if (path.length > 0 && path.length < minPathLength) {
                minPathLength = path.length;
                nearestTarget = pos;
            }
        }
        return this.teamCheck(game, bot, flagHolder) ? { nearestTarget, flagHolder } : null;
    }

    getCTFDefensiveTarget(bot: Player, game: Game): Position | null {
        const playersToConsider = game.players.filter((p) => !game.eliminatedPlayers.includes(p) && p.socketId !== bot.socketId);
        const flagHolder = playersToConsider.find((p) => p.isFlagHolder);
        if (!flagHolder) return null;
        let targetPos: Position = flagHolder.startPosition;
        const isOccupied = playersToConsider.some((p) => p.position.x === targetPos.x && p.position.y === targetPos.y);
        if (isOccupied) {
            let freeTile: Position | null = null;
            let minDistance = Infinity;
            for (let y = 0; y < game.map.tiles.length; y++) {
                for (let x = 0; x < game.map.tiles[0].length; x++) {
                    const pos = { x, y };
                    const occupied = playersToConsider.some((p) => p.position.x === pos.x && p.position.y === pos.y);
                    if (!occupied) {
                        const distance = Math.abs(pos.x - targetPos.x) + Math.abs(pos.y - targetPos.y);
                        if (distance < minDistance) {
                            minDistance = distance;
                            freeTile = pos;
                        }
                    }
                }
            }
            if (freeTile) {
                targetPos = freeTile;
            }
        }
        return targetPos;
    }

    eliminateBot(game: Game, socketId: string) {
        const playerIndex = game.playerTurns.findIndex((p) => p === socketId);
        const eliminatedPlayer = game.players.find((p) => p.socketId === socketId);
        if (!eliminatedPlayer) return;
        eliminatedPlayer.isEliminated = true;
        eliminatedPlayer.isMyTurn = false;

        if (playerIndex !== -1) {
            game.playerTurns.splice(playerIndex, 1);

            if (playerIndex < game.currentPlayerIndex) {
                game.currentPlayerIndex--;
            } else if (playerIndex === game.currentPlayerIndex) {
                if (game.currentPlayerIndex >= game.playerTurns.length) {
                    game.currentPlayerIndex = 0;
                }
            }
        }

        game.eliminatedPlayers.push(eliminatedPlayer);
        game.map.items[eliminatedPlayer.position.y][eliminatedPlayer.position.x] = 'empty';
    }

    private combatLogEntry(player1: Player, player2: Player, server: Server, game: Game) {
        const timestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false });
        const combatStartEntry = {
            timestamp,
            message: `Début de combat entre ${player1.name} et ${player2.name}`,
            players: [player1.name, player2.name],
            type: 'combat',
        };
        server.to(game.gameId).emit(GAME_EVENTS.LOG, combatStartEntry);
    }

    private goForFlagHolder(bot: Player, game: Game, server: Server, targetPosition: Position): void {
        const playersToConsider = game.players.filter((p) => !game.eliminatedPlayers.includes(p) && p.socketId !== bot.socketId);
        if (this.movementService.isAdjacent(bot.position, targetPosition)) {
            const enemy = playersToConsider.find(
                (p) => p.socketId !== bot.socketId && p.position.x === targetPosition.x && p.position.y === targetPosition.y,
            );
            if (enemy && bot.actionPoints > 0) {
                this.combatService.initCombat(bot, enemy, game);
                this.combatLogEntry(bot, enemy, server, game);
                const combatState = this.combatService.getCombatState(game.gameId);
                server.to(game.gameId).emit(COMBAT_EVENTS.COMBAT_STARTED, { combatState });
                if (enemy.isBot) {
                    this.attackBot(combatState, game, server);
                    bot.actionPoints--;
                }
            }
        }
    }

    private runAgressiveSequence(game: Game, bot: Player, server: Server): void {
        if (game.map.gameMode === 'CTF') {
            const ctfTarget = this.getCTFAggressiveTarget(bot, game);
            if (bot.isFlagHolder) {
                this.moveToTarget(bot, bot.startPosition, game, server);
                return;
            } else if (ctfTarget) {
                if (ctfTarget.nearestTarget) {
                    this.moveToTarget(bot, ctfTarget.nearestTarget, game, server);
                }
                this.goForFlagHolder(bot, game, server, ctfTarget.flagHolder.position);
                return;
            } else {
                const flagPos = this.findBestItem(bot, game, ['flag']);
                if (flagPos) {
                    this.moveToTarget(bot, flagPos, game, server);
                } else {
                    const itemPos = this.findBestItem(bot, game, ['crystal', 'lance', 'hourglass', 'compas']);
                    if (itemPos) {
                        this.moveToTarget(bot, itemPos, game, server);
                    }
                }
                return;
            }
        }

        const directEnemy = this.getAdjacentEnemy(bot, game);
        if (directEnemy && bot.actionPoints > 0) {
            this.combatService.initCombat(bot, directEnemy, game);
            this.combatLogEntry(bot, directEnemy, server, game);
            const combatState = this.combatService.getCombatState(game.gameId);
            server.to(game.gameId).emit(COMBAT_EVENTS.COMBAT_STARTED, { combatState });
            if (directEnemy.isBot) {
                this.attackBot(combatState, game, server);
            }
            return;
        }

        const playersToConsider = game.players.filter((p) => !game.eliminatedPlayers.includes(p) && p.socketId !== bot.socketId);

        let nearestTarget: Position | null = null;
        let minPathLength = Infinity;
        for (const player of playersToConsider) {
            if (player.socketId !== bot.socketId) {
                const adjacentPositions: Position[] = [
                    { x: player.position.x, y: player.position.y - 1 },
                    { x: player.position.x, y: player.position.y + 1 },
                    { x: player.position.x - 1, y: player.position.y },
                    { x: player.position.x + 1, y: player.position.y },
                ];
                for (const pos of adjacentPositions) {
                    const path = this.movementService.findShortestPath(bot, pos, game, game.map);
                    if (path.length > 0 && path.length < minPathLength) {
                        minPathLength = path.length;
                        nearestTarget = pos;
                    }
                }
            }
        }
        if (nearestTarget) {
            this.moveToTarget(bot, nearestTarget, game, server);
            const enemyAfterMove = this.getAdjacentEnemy(bot, game);
            if (enemyAfterMove && bot.actionPoints > 0) {
                this.combatService.initCombat(bot, enemyAfterMove, game);
                this.combatLogEntry(bot, enemyAfterMove, server, game);
                const combatState = this.combatService.getCombatState(game.gameId);
                server.to(game.gameId).emit(COMBAT_EVENTS.COMBAT_STARTED, { combatState });
                if (enemyAfterMove.isBot) {
                    this.attackBot(combatState, game, server);
                }
            }
            return;
        }
        const aggressiveItemTypes = ['crystal', 'lance', 'hourglass', 'compas'];
        const bestItemPos = this.findBestItem(bot, game, aggressiveItemTypes);
        if (bestItemPos) {
            this.moveToTarget(bot, bestItemPos, game, server);
            const enemy = this.getAdjacentEnemy(bot, game);
            if (enemy && bot.actionPoints > 0) {
                this.combatService.initCombat(bot, enemy, game);
                this.combatLogEntry(bot, enemy, server, game);
                const combatState = this.combatService.getCombatState(game.gameId);
                server.to(game.gameId).emit(COMBAT_EVENTS.COMBAT_STARTED, { combatState });
                if (enemy.isBot) {
                    this.attackBot(combatState, game, server);
                }
            }
            return;
        }
    }

    private runPassiveSequence(game: Game, bot: Player, server: Server): void {
        if (game.map.gameMode === 'CTF') {
            if (bot.isFlagHolder) {
                this.moveToTarget(bot, bot.startPosition, game, server);
                return;
            }
            const ctfTarget = this.getCTFDefensiveTarget(bot, game);
            if (ctfTarget) {
                this.moveToTarget(bot, ctfTarget, game, server);
                return;
            } else {
                const flagPos = this.findBestItem(bot, game, ['flag']);
                if (flagPos) {
                    this.moveToTarget(bot, flagPos, game, server);
                } else {
                    const itemPos = this.findBestItem(bot, game, ['potion', 'shield', 'compas']);
                    if (itemPos) {
                        this.moveToTarget(bot, itemPos, game, server);
                    }
                }
                return;
            }
        }
        const defensiveItemTypes = ['potion', 'shield', 'compas'];
        const bestItemPos = this.findBestItem(bot, game, defensiveItemTypes);
        if (bestItemPos) {
            this.moveToTarget(bot, bestItemPos, game, server);
            const enemy = this.getAdjacentEnemy(bot, game);
            if (enemy) {
                this.combatService.initCombat(bot, enemy, game);
                this.combatLogEntry(bot, enemy, server, game);
                const combatState = this.combatService.getCombatState(game.gameId);
                server.to(game.gameId).emit(COMBAT_EVENTS.COMBAT_STARTED, { combatState });
                if (enemy.isBot) {
                    this.attackBot(combatState, game, server);
                }
            }
            return;
        } else {
            this.fleeBotFromEnemies(bot, game, server);
            return;
        }
    }

    private fleeBotFromEnemies(bot: Player, game: Game, server: Server): void {
        let safestPosition: Position | null = null;
        let maxMinDistance = -1;
        const playersToConsider = game.players.filter((p) => !game.eliminatedPlayers.includes(p) && p.socketId !== bot.socketId);

        for (let y = 0; y < game.map.tiles.length; y++) {
            for (let x = 0; x < game.map.tiles[0].length; x++) {
                const pos = { x, y };
                const isOccupied = playersToConsider.some((p) => p.position.x === pos.x && p.position.y === pos.y);

                if (!isOccupied) {
                    let minDistanceToEnemy = Infinity;

                    for (const player of playersToConsider) {
                        if (player.socketId !== bot.socketId) {
                            const distance = Math.abs(pos.x - player.position.x) + Math.abs(pos.y - player.position.y);
                            minDistanceToEnemy = Math.min(minDistanceToEnemy, distance);
                        }
                    }

                    if (minDistanceToEnemy > maxMinDistance) {
                        maxMinDistance = minDistanceToEnemy;
                        safestPosition = pos;
                    }
                }
            }
        }

        if (safestPosition) {
            this.moveToTarget(bot, safestPosition, game, server);
        }
    }

    private teamCheck(game: Game, player1: Player, player2: Player): boolean {
        const team1 = game.teams.blue.includes(player1.socketId) ? game.teams.blue : game.teams.red;
        const team2 = game.teams.blue.includes(player2.socketId) ? game.teams.blue : game.teams.red;
        return team1 !== team2;
    }

    private attackBot(combatState: CombatState, game: Game, server: Server) {
        let gameEnded = false;
        const coinToss = Math.random() < 0.5;
        const winnerS = coinToss ? combatState.target : combatState.attacker;
        const loserS = winnerS === combatState.target ? combatState.attacker : combatState.target;
        this.combatService.dropPlayerItems(loserS, game);
        if (game.fastEliminationActive) {
            this.eliminateBot(game, loserS.socketId);
        }
        const combatResult = this.combatService.endCombat(game, winnerS);
        winnerS.battlesWon++;
        if (winnerS.battlesWon === 3) {
            gameEnded = true;
            game.ended = true;
            game.winner = winnerS.name;
            this.currencyService.applyEndGameRewards(game, server).catch(() => {
                // Error handled silently - rewards application failed
            });
        }
        if (!game.fastEliminationActive) {
            loserS.position = this.combatService.placePlayerAfterCombat(game, loserS.startPosition);
        }
        if (loserS.isFlagHolder) {
            loserS.isFlagHolder = false;
        }

        loserS.battlesLost = (loserS.battlesLost || 0) + 1;
        winnerS.combatsParticipated = (winnerS.combatsParticipated || 0) + 1;
        loserS.combatsParticipated = (loserS.combatsParticipated || 0) + 1;
        combatState.combatAlreadyCounted = true;
        const originalHp = this.combatService['defaultHp'].get(loserS.socketId) || 0;
        const damageDealt = originalHp;
        winnerS.totalDamageDone = (winnerS.totalDamageDone || 0) + damageDealt;
        loserS.totalDamageTaken = (loserS.totalDamageTaken || 0) + damageDealt;

        server.to(game.gameId).emit(COMBAT_EVENTS.COMBAT_ENDED, {
            combatState: combatResult.combatState,
            reason: REASON.DEATH,
            actionPlayer: combatResult.actionPlayer,
            gameEnded,
        });

        server.to(game.gameId).emit(GAME_EVENTS.MAP_UPDATED, game.map);
        server.to(game.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
        const timestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false });
        const logEntry = {
            timestamp,
            message: `Fin de combat : ${winnerS.name} a vaincu ${loserS.name}`,
            players: [winnerS.name, loserS.name],
            type: 'combat',
        };
        server.to(game.gameId).emit(GAME_EVENTS.LOG, logEntry);
    }
}
