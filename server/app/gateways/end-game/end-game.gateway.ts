/* eslint-disable prettier/prettier */
import { GameService } from '@app/services/game/game.service';
import { Injectable } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
@Injectable()
export class EndGameGateway {
    @WebSocketServer() server: Server;

    constructor(private readonly gameService: GameService) {}
    
    @SubscribeMessage('get-end-game-stats')
    handleEndGameStats(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
        const stats = this.gameService.getPlayerStats(payload.gameId);
        client.emit('end-game-stats', stats);
    }

    @SubscribeMessage('get-end-game-global-stats')
    handleEndGameGlobalStats(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
        const stats = this.gameService.getGlobalStats(payload.gameId);
        client.emit('end-game-global-stats', stats);
    }
}