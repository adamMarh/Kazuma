import { GameService as NewGameService } from '@app/services/game/game.service';
import { ItemService } from '@app/services/item/item.service';
import { MovementService } from '@app/services/movement/movement.service';
import { TurnService } from '@app/services/turn/turn.service';
import { ItemType } from '@common/interfaces/item.interface';
import { Position } from '@common/interfaces/position.interface';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { ITEM_EVENTS } from '@common/socket-events/item.events';
import { LOBBY_EVENTS } from '@common/socket-events/lobby.events';
import { MOVEMENT_EVENTS } from '@common/socket-events/movement.events';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class MovementGateway {
    @WebSocketServer()
    server: Server;

    constructor(
        private readonly movementService: MovementService,
        private readonly newGameService: NewGameService,
        private readonly turnService: TurnService,
        private readonly itemService: ItemService,
    ) {}

    @SubscribeMessage(MOVEMENT_EVENTS.GET_MOVEMENTS)
    handlePossibleMovements(client: Socket, { gameId }: { gameId: string }) {
        const game = this.newGameService.getGame(gameId);
        if (!game) {
            return;
        }
        const player = game.players.find((p) => p.socketId === client.id);
        const turnChanged = this.newGameService.checkTurn(this.server, player, game);
        return turnChanged ? undefined : this.movementService.getPossibleMovements(player, game);
    }

    @SubscribeMessage(GAME_EVENTS.SKIP_TURN)
    handleSkipTurn(@MessageBody() payload: { gameId: string }) {
        const game = this.newGameService.getGame(payload.gameId);
        this.turnService.turnBehaviour(this.server, game);
    }

    @SubscribeMessage(GAME_EVENTS.CLIENT_TURN_RESPONSE)
    handleTurnChange(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
        const game = this.newGameService.getGame(payload.gameId);
        if (!game) {
            return;
        }
        const player = game.players.find((p) => p.socketId === client.id);
        this.turnService.startTimers(this.server, payload.gameId, player, game);
    }

    @SubscribeMessage(MOVEMENT_EVENTS.GET_PATH)
    handleGetShortestPath(@ConnectedSocket() client: Socket, @MessageBody() payload: { targetPos: Position; gameId: string }): Position[] {
        const game = this.newGameService.getGame(payload.gameId);
        if (!game) {
            return [];
        }
        const player = this.newGameService.getPlayer(client.id, game);
        return this.movementService.findShortestPath(player, payload.targetPos, game, game.map);
    }

    @SubscribeMessage(ITEM_EVENTS.ITEM_DROPPED)
    handleDropItem(@ConnectedSocket() client: Socket, @MessageBody() payload: { position: Position; itemType: ItemType; gameId: string }) {
        const game = this.newGameService.getGame(payload.gameId);
        const player = this.newGameService.getPlayer(client.id, game);
        const encounteredItem = game.map.items[payload.position.y][payload.position.x] as ItemType;
        const isSameInventory = payload.itemType === encounteredItem;
        let droppedItem: ItemType;
        if (isSameInventory) {
            droppedItem = encounteredItem;
        } else {
            const itemIndex = player.inventory.indexOf(payload.itemType);
            droppedItem = player.inventory[itemIndex];
            if (droppedItem === 'flag') {
                player.isFlagHolder = false;
            }
            player.inventory[itemIndex] = encounteredItem;
            this.itemService.removeItemEffect(player, payload.itemType);
            this.server.to(game.gameId).emit(ITEM_EVENTS.ITEM_EFFECT_REMOVED, {
                playerId: player.socketId,
                itemType: payload.itemType,
            });
            this.itemService.applyItemEffect(player, encounteredItem);
            this.server.to(game.gameId).emit(ITEM_EVENTS.ITEM_EFFECT_APPLIED, {
                playerId: player.socketId,
                itemType: encounteredItem,
            });

            const itemTimestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false });
            const pickupLogEntry = {
                timestamp: itemTimestamp,
                message: `${player.name} a ramassé ${encounteredItem}`,
                players: [player.name],
                type: 'item_pickup',
            };
            this.server.to(game.gameId).emit(GAME_EVENTS.LOG, pickupLogEntry);
        }
        game.map.items[payload.position.y][payload.position.x] = droppedItem;
        this.server.to(game.gameId).emit(GAME_EVENTS.MAP_UPDATED, game.map);
        this.server.to(game.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
    }
}
