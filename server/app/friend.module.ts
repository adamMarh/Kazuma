import { FriendController } from '@app/controllers/friend/friend.controller';
import { FriendGateway } from '@app/gateways/friend/friend.gateway';
import { FriendService } from '@app/services/friend/friend.service';
import { StatusService } from '@app/services/status/status.service';
import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { SharedModule } from './shared.module';

@Module({
    imports: [forwardRef(() => AuthModule), SharedModule],
    controllers: [FriendController],
    providers: [FriendGateway, FriendService, StatusService],
    exports: [FriendService, FriendGateway, StatusService],
})
export class FriendModule {}
