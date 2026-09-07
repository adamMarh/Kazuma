import { CombatService } from '@app/services/combat/combat.service';
import { CurrencyService } from '@app/services/currency/currency.service';
import { GameService } from '@app/services/game/game.service';
import { MovementService } from '@app/services/movement/movement.service';
import { StatsService } from '@app/services/stats/stats.service';
import { TurnService } from '@app/services/turn/turn.service';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/interfaces/position.interface';
import { TileInfo } from '@common/interfaces/tileInfo.interface';
import { COMBAT_EVENTS } from '@common/socket-events/combat.events';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { ITEM_EVENTS } from '@common/socket-events/item.events';
import { LOBBY_EVENTS } from '@common/socket-events/lobby.events';
import { MOVEMENT_EVENTS } from '@common/socket-events/movement.events';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway()
export class ClickGateway {
    @WebSocketServer() server: Server;

    constructor(
        private readonly movementService: MovementService,
        private readonly newGameService: GameService,
        private readonly combatService: CombatService,
        private readonly turnService: TurnService,
        private readonly statsService: StatsService,
        private readonly currencyService: CurrencyService,
    ) {}

    @SubscribeMessage(GAME_EVENTS.LEFT_CLICK)
    async handleLeftClick(@ConnectedSocket() client: Socket, @MessageBody() payload: { targetPos: Position; isAction: boolean; gameId: string }) {
        const { targetPos, isAction, gameId } = payload;
        const game = this.newGameService.getGame(gameId);
        const player = this.newGameService.getPlayer(client.id, game);
        if (!player || player.socketId !== game.playerTurns[game.currentPlayerIndex]) {
            return;
        }
        if (isAction) {
            const result = this.newGameService.handleAction(targetPos, player, game);
            if ('message' in result) {
                this.server.to(client.id).emit(GAME_EVENTS.ON_ERROR, {
                    errorMessage: result.message,
                    shouldRedirect: false,
                });
                return;
            }
            if (result.type === 'door') {
                this.server.to(gameId).emit(MOVEMENT_EVENTS.DOOR_OPEN, game.map);
                this.server.to(gameId).emit(GAME_EVENTS.ACTION_ENDED, {
                    player,
                    players: game.players,
                });

                const newTileState = game.map.tiles[targetPos.y][targetPos.x];
                const doorKey = `${targetPos.x},${targetPos.y}`;
                game.doorsManipulated = game.doorsManipulated || new Set();
                game.doorsManipulated.add(doorKey);

                const logMessage = newTileState === 'doorOpen' ? 'Ouverture de porte' : 'Fermeture de porte';
                const timestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false });
                const logEntry = {
                    timestamp,
                    message: logMessage,
                    players: [player.name],
                    type: 'door',
                };

                this.server.to(gameId).emit(GAME_EVENTS.LOG, logEntry);
            } else {
                this.turnService.pauseTimers(gameId);
                const combatState = this.combatService.getCombatState(game.gameId);
                this.server.to(game.gameId).emit(COMBAT_EVENTS.COMBAT_STARTED, { combatState });

                const timestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false });
                const logEntry = {
                    timestamp,
                    message: `Début de combat entre ${combatState.attacker.name} et ${combatState.target.name}`,
                    players: [combatState.attacker.name, combatState.target.name],
                    type: 'combat',
                };
                this.server.to(game.gameId).emit(GAME_EVENTS.LOG, logEntry);
            }
        } else {
            const path = this.movementService.findShortestPath(player, targetPos, game, game.map);
            const moveResult = this.movementService.movePlayer(player, path, false, game);

            if (moveResult.inventoryFull) {
                this.server.to(client.id).emit(ITEM_EVENTS.CHOOSE_ITEM, { item: moveResult.encounteredItem });
            }
            if (moveResult.mapUpdated) {
                this.server.to(gameId).emit(GAME_EVENTS.MAP_UPDATED, game.map);
                this.server.to(game.gameId).emit(ITEM_EVENTS.ITEM_EFFECT_APPLIED, {
                    playerId: player.socketId,
                    itemType: moveResult.encounteredItem.type,
                });

                const itemTimestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false });
                const pickupLogEntry = {
                    timestamp: itemTimestamp,
                    message: `${player.name} a ramassé ${moveResult.encounteredItem.type}`,
                    players: [player.name],
                    type: 'item_pickup',
                };
                this.server.to(gameId).emit(GAME_EVENTS.LOG, pickupLogEntry);
            }
            if (game.ended) {
                // Let turnBehaviour handle rewards, challenges, UPDATE_LOBBY
                await this.turnService.turnBehaviour(this.server, game);
            } else {
                this.server.to(gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
            }
            this.server.to(gameId).emit(GAME_EVENTS.ACTION_ENDED, {
                player: moveResult.player,
                players: game.players,
                path: moveResult.realPath,
            });
        }
    }

    @SubscribeMessage(GAME_EVENTS.RIGHT_CLICK)
    handleRightClick(@MessageBody() payload: { position: Position; gameId: string; myPlayer: Player }): TileInfo | void {
        const game = this.newGameService.getGame(payload.gameId);
        const tile = this.newGameService.getInformation(payload.position, payload.gameId);
        const invalidTileTypes = tile.tileType === 'wall' || tile.tileType === 'doorClose';
        const invalidItems = ['shield', 'lance', 'potion', 'crystal', 'compas', 'hourglass', 'flag'];
        if (game.isInDebugMode) {
            if (payload.myPlayer.isMyTurn) {
                if (!invalidTileTypes && !tile.playerAvatar && !invalidItems.includes(tile.itemType)) {
                    payload.myPlayer = { ...payload.myPlayer, position: payload.position };
                    game.players = game.players.map((p) => (p.socketId === payload.myPlayer.socketId ? payload.myPlayer : p));
                    this.server.to(game.gameId).emit(GAME_EVENTS.ACTION_ENDED, { player: payload.myPlayer, players: game.players });
                }
            } else {
                return this.newGameService.getInformation(payload.position, payload.gameId);
            }
        } else {
            return this.newGameService.getInformation(payload.position, payload.gameId);
        }
    }
}
