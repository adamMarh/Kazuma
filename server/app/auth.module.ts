import { AuthController } from '@app/controllers/auth/auth.controller';
import { AuthService } from '@app/services/auth/auth.service';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatModule } from './chatroom.module';
import { MapsModule } from './maps.module';
import { AvatarModule } from './services/avatar/avatar.module';
import { FriendModule } from './friend.module';

@Module({
    imports: [ConfigModule, forwardRef(() => ChatModule), MapsModule, forwardRef(() => AvatarModule), forwardRef(() => FriendModule)],
    controllers: [AuthController],
    providers: [AuthService],
    exports: [AuthService],
})
export class AuthModule {}
