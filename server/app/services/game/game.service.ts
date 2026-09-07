import { BotService } from '@app/services/bot/bot.service';
import { CombatService } from '@app/services/combat/combat.service';
import { EndGameService } from '@app/services/end-game/end-game.service';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { MovementService } from '@app/services/movement/movement.service';
import { TurnService } from '@app/services/turn/turn.service';
import { ActionResult } from '@common/interfaces/actionResult.interface';
import { Attribute } from '@common/interfaces/attribute.interface';
import { Game } from '@common/interfaces/game.interface';
import { Map } from '@common/interfaces/map.interface';
import { GlobalStats } from '@common/interfaces/player-global-stats';
import { PlayerStats } from '@common/interfaces/player-stats.interface';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/interfaces/position.interface';
import { TileInfo } from '@common/interfaces/tileInfo.interface';
import { COMBAT_EVENTS } from '@common/socket-events/combat.events';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class GameService {
    private games: { [gameId: string]: Game } = {};
    private server: Server;
    private finalizedGames = new Set<string>();

    constructor(
        private readonly lobbyService: LobbyService,
        private readonly movementService: MovementService,
        private readonly turnService: TurnService,
        private readonly combatService: CombatService,
        private readonly botService: BotService,
        private readonly endGameService: EndGameService,
    ) {}

    setServer(server: Server) {
        this.server = server;
    }

    getGame(gameId: string): Game {
        return this.games[gameId];
    }

    getGameByPlayer(playerId: string): Game | undefined {
        for (const [, game] of Object.entries(this.getGames())) {
            if (game.players.some((player: Player) => player.socketId === playerId)) {
                return game;
            }
        }
    }

    getGames(): { [gameId: string]: Game } {
        // Temporary fix
        // const gameIds = Object.keys(this.games);
        // gameIds.forEach((gameId) => {
        //     if (this.games[gameId].ended) {
        //         delete this.games[gameId];
        //     }
        // });
        return this.games;
    }

    getCurrentPlayer(gameId: string): number {
        const game = this.getGame(gameId);
        return game.currentPlayerIndex;
    }

    createGame(
        clientId: string,
        payload: {
            name: string;
            avatar: number;
            map: Map;
            attributes: Record<string, Attribute>;
            entryFee?: number;
            friendsOnly?: boolean;
            creatorUid?: string;
        },
    ): Game {
        const game = this.lobbyService.createGame(clientId, this.getGames(), payload);
        this.games[game.gameId] = game;
        return game;
    }

    checkTurn(server: Server, player: Player, game: Game): boolean {
        const turnChanged = false;
        if (player?.movementPoints === 0 && !this.actionsPossible(player, game) && player.socketId === game.playerTurns[game.currentPlayerIndex]) {
            this.turnService.turnBehaviour(server, game);
        }
        return turnChanged;
    }

    getInformation(position: Position, gameId: string): TileInfo | null {
        const game = this.getGame(gameId);
        const { map, players } = game;
        const tileType = map.tiles[position.y][position.x];
        const itemType = map.items[position.y][position.x];
        const player = players.find((p) => p.position.x === position.x && p.position.y === position.y);
        const tileInfo: TileInfo = {
            tileType,
            tileCost: this.getTileCost(tileType),
            itemType: itemType !== 'empty' && itemType !== 'hidden_checkpoint' ? itemType : undefined,
            playerName: player ? player.name : undefined,
            playerAvatar: player ? player.avatar : undefined,
            isActionTile: tileType === 'doorOpen' || tileType === 'doorClose' || Boolean(player),
        };
        return tileInfo;
    }

    getPlayer(playerId: string, game: Game): Player | undefined {
        if (!game || !this.games[game.gameId]) return undefined;
        return this.games[game.gameId].players.find((p) => p.socketId === playerId);
    }

    nextTurn(game: Game): void {
        if (game.players.length === 0 || game.playerTurns.length === 0) return;
        const currentPlayer = game.players.find((p) => p.socketId === game.playerTurns[game.currentPlayerIndex]);
        if (currentPlayer && !currentPlayer.hasLeft) {
            currentPlayer.isMyTurn = false;
        }
        if (game.players.length !== game.playerTurns.length) {
            this.refreshPlayerTurns(game);
        }
        const total = game.playerTurns.length;
        for (let i = 1; i <= total; i++) {
            const nextIndex = (game.currentPlayerIndex + i) % total;
            const nextId = game.playerTurns[nextIndex];
            const nextPlayer = game.players.find((p) => p.socketId === nextId);
            if (nextPlayer && !nextPlayer.hasLeft && !nextPlayer.isEliminated) {
                game.currentPlayerIndex = nextIndex;
                nextPlayer.isMyTurn = true;
                nextPlayer.actionPoints = 1;
                nextPlayer.movementPoints = nextPlayer.speed;
                nextPlayer.turnsPlayed = (nextPlayer.turnsPlayed || 0) + 1;
                return;
            }
        }
        return;
    }

    refreshPlayerTurns(game: Game): void {
        game.playerTurns = game.players.filter((p) => !p.hasLeft).map((player) => player.socketId);
    }

    getTileCost(tileType: string): string {
        const tileCosts: Record<string, string> = {
            grass: '1',
            ice: '0',
            water: '2',
            wall: 'Infinity',
            doorClose: 'Infinity',
            doorOpen: '1',
        };

        return tileCosts[tileType];
    }

    isPlayerInCombat(quitter: Player, gameId: string): boolean {
        const combatState = this.combatService.getCombatState(gameId);
        if (!combatState) {
            return false;
        }
        return quitter === combatState.attacker || quitter === combatState.target;
    }

    actionsPossible(player: Player, game: Game): boolean {
        if (player.actionPoints < 1) {
            return false;
        }

        const { position } = player;
        const adjacentPositions: Position[] = [
            { x: position.x, y: position.y - 1 },
            { x: position.x, y: position.y + 1 },
            { x: position.x - 1, y: position.y },
            { x: position.x + 1, y: position.y },
        ];

        return adjacentPositions.some((pos) => {
            if (pos.x < 0 || pos.y < 0 || pos.x >= game.map.tiles[0].length || pos.y >= game.map.tiles.length) {
                return false;
            }

            const tileInfo = this.getInformation(pos, game.gameId);
            return tileInfo?.tileType === 'doorOpen' || tileInfo?.tileType === 'doorClose' || tileInfo?.playerName !== undefined;
        });
    }

    handleCombatantDisonnection(player: Player, game: Game) {
        const combatState = this.combatService.getCombatState(game.gameId);
        if (combatState && !combatState.combatAlreadyCounted && combatState.attacker && combatState.target) {
            combatState.attacker.combatsParticipated = (combatState.attacker.combatsParticipated || 0) + 1;
            combatState.target.combatsParticipated = (combatState.target.combatsParticipated || 0) + 1;
            combatState.combatAlreadyCounted = true;
        }

        if (player === combatState.attacker) {
            combatState.target.battlesWon++;
            player.battlesLost = (player.battlesLost || 0) + 1;
            const winner = combatState.target;
            const combatResult = this.combatService.endCombat(game, winner);

            if (this.server) {
                this.server.to(game.gameId).emit(COMBAT_EVENTS.COMBAT_ENDED, {
                    combatState: combatResult.combatState,
                    reason: 'DISCONNECTED',
                    actionPlayer: winner,
                    gameEnded: combatResult.gameEnded,
                });
            }
        } else {
            combatState.attacker.battlesWon++;
            player.battlesLost = (player.battlesLost || 0) + 1;
            const winner = combatState.attacker;
            const combatResult = this.combatService.endCombat(game, winner);

            if (this.server) {
                this.server.to(game.gameId).emit(COMBAT_EVENTS.COMBAT_ENDED, {
                    combatState: combatResult.combatState,
                    reason: 'DISCONNECTED',
                    actionPlayer: winner,
                    gameEnded: combatResult.gameEnded,
                });
            }
        }
        this.eliminatePlayer(game, player.socketId);
    }

    eliminatePlayer(game: Game, socketId: string) {
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

    validPlayersPositions(position1: Position, position2: Position): boolean {
        return (
            (Math.abs(position1.x - position2.x) === 1 && position1.y === position2.y) ||
            (Math.abs(position1.y - position2.y) === 1 && position1.x === position2.x)
        );
    }

    actionValidation(player: Player, position: Position, gameId: string): { success: boolean; message: string } {
        if (player.position.x === position.x && player.position.y === position.y) {
            return { success: false, message: 'Vous ne pouvez pas vous attaquer vous-même' };
        }
        const game = this.getGame(gameId);
        const targetPlayer = game.players.find((p) => p.position.x === position.x && p.position.y === position.y);
        if (this.arePlayersInSameTeam(game, player.socketId, targetPlayer?.socketId)) {
            return { success: false, message: 'Vous ne pouvez pas attaquer un joueur de votre équipe' };
        }
        if (!this.getInformation(position, gameId).isActionTile) {
            return { success: false, message: "Ceci n'est pas une tuile d'action" };
        }
        if (!this.validPlayersPositions(player.position, position)) {
            return { success: false, message: 'Cette actions est limitées aux tuiles adjacentes' };
        }
        if (player.actionPoints < 1) {
            return { success: false, message: "Vos points d'action sont insuffisants" };
        }
        return;
    }

    handleAction(targetPos: Position, player: Player, game: Game): ActionResult {
        const validationError = this.actionValidation(player, targetPos, game.gameId);
        if (validationError) {
            return { success: false, message: validationError.message };
        }
        const tile = game.map.tiles[targetPos.y][targetPos.x];
        const itemOnTile = game.map.items[targetPos.y][targetPos.x];
        const targetPlayer = game.players.find((p) => p.position.x === targetPos.x && p.position.y === targetPos.y && !p.hasLeft);
        if (
            tile === 'doorClose' ||
            (tile === 'doorOpen' && !targetPlayer && (itemOnTile === 'empty' || itemOnTile === 'checkpoint' || itemOnTile === 'hidden_checkpoint'))
        ) {
            player.actionPoints--;
            const newTile = tile === 'doorClose' ? 'doorOpen' : 'doorClose';
            game.map.tiles[targetPos.y][targetPos.x] = newTile;
            return { success: true, type: 'door', updatedMap: game.map };
        } else {
            if (player.hasLeft) {
                return { success: false, message: 'Action impossible : un joueur a quitté la partie.' };
            }
            this.combatService.initCombat(player, targetPlayer, game);
            return { success: true, type: 'combat', target: targetPlayer };
        }
    }

    getPlayerStats(gameId: string): PlayerStats[] {
        const game = this.getGame(gameId);
        if (!game) return [];
        const allPlayers = game.players.concat(game.inactivePlayers);

        return allPlayers.map((player) => {
            let name = player.name;
            if (game.inactivePlayers.includes(player)) {
                name = player.name + '(abandon)';
            }
            const evasions = player.successfulFleeAttempts || 0;
            const combats = player.combatsParticipated || 0;
            const victories = player.battlesWon;
            const defeats = player.battlesLost || 0;
            const hpLost = player.totalDamageTaken || 0;
            const damageDone = player.totalDamageDone || 0;
            const itemsPicked = Array.isArray(player.collectedUniqueItems) ? new Set(player.collectedUniqueItems).size : 0;
            const tilesVisitedPercentage = this.endGameService.calculateTilesVisitedPercentage(player, game.map.tiles);
            const hasLeft = !!player.hasLeft;

            return {
                name,
                combats,
                victories,
                evasions,
                defeats,
                hpLost,
                damageDone,
                itemsPicked,
                tilesVisitedPercentage,
                hasLeft,
            };
        });
    }

    getGlobalStats(gameId: string): GlobalStats | null {
        const game = this.getGame(gameId);
        if (!game) return null;
        return {
            formattedDuration: this.endGameService.calculateGameDuration(game),
            totalTurns: this.endGameService.calculateTotalTurns(game),
            tilesVisitedPercentage: this.endGameService.calculateVisitedTilesPercentage(game),
            doorManipulatedPercentage: this.endGameService.calculateDoorManipulatedPercentage(game),
            playersWithFlag: game.map.gameMode === 'CTF' ? this.endGameService.calculateFlagHolders(game) : undefined,
        };
    }

    arePlayersInSameTeam(game: Game, playerId1: string, playerId2: string): boolean {
        return Object.values(game.teams).some((team) => team.includes(playerId1) && team.includes(playerId2));
    }

    finalizeGame(game: Game): void {
        if (!game.ended || this.finalizedGames.has(game.gameId)) return;
        this.finalizedGames.add(game.gameId);

        if (!game.endTime) {
            game.endTime = new Date();
        }

        const playerStats = this.getPlayerStats(game.gameId);
        const globalStats = this.getGlobalStats(game.gameId);

        this.server.to(game.gameId).emit(GAME_EVENTS.GAME_OVER_STATS, {
            playerStats,
            globalStats,
            winner: game.winner,
        });

        setTimeout(() => {
            this.finalizedGames.delete(game.gameId);
            this.removeGame(game.gameId);
        }, 10000);
    }

    removeGame(gameId: string): void {
        delete this.games[gameId];
    }
}
