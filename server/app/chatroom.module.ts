import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth.module';
import { FriendModule } from './friend.module';
import { ChatGateway } from './gateways/chatroom/chatroom.gateway';
import { MapsModule } from './maps.module';
import { ChatMessage, chatMessageSchema } from './model/schema/chat-message.schema';
import { ChatRoom, chatRoomSchema } from './model/schema/chatroom.schema';
import { AvatarModule } from './services/avatar/avatar.module';
import { ChatService } from './services/chatroom/chatroom.service';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: ChatMessage.name, schema: chatMessageSchema }]),
        MongooseModule.forFeature([{ name: ChatRoom.name, schema: chatRoomSchema }]),
        forwardRef(() => AvatarModule),
        forwardRef(() => AuthModule),
        forwardRef(() => FriendModule),
        MapsModule,
    ],
    providers: [ChatGateway, ChatService],
    exports: [ChatService],
})
export class ChatModule {}
