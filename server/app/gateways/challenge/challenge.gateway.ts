import { ChallengeService } from '@app/services/challenge/challenge.service';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class ChallengeGateway {
    constructor(private challengeService: ChallengeService) {}

    @SubscribeMessage(GAME_EVENTS.GET_CHALLENGE_HISTORY)
    async handleGetChallengeHistory(@ConnectedSocket() client: Socket, @MessageBody() payload: { username: string }) {
        try {
            const history = await this.challengeService.getChallengeHistory(payload.username);
            client.emit(GAME_EVENTS.CHALLENGE_HISTORY, history);
        } catch {
            client.emit(GAME_EVENTS.CHALLENGE_HISTORY, []);
        }
    }
}
