import { Module } from '@nestjs/common';
import { ChatModule } from './chatroom.module';
import { FriendModule } from './friend.module';
import { LobbyGateway } from './gateways/lobby/lobby.gateway';
import { SharedModule } from './shared.module';

@Module({
    imports: [SharedModule, ChatModule, FriendModule],
    providers: [LobbyGateway],
})
export class WaitingRoomModule {}
