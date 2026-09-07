import { ChatMessage } from '@app/model/schema/chat-message.schema';
import { AuthService } from '@app/services/auth/auth.service';
import { ChatService } from '@app/services/chatroom/chatroom.service';
import { FriendService } from '@app/services/friend/friend.service';
import { CHAT_EVENTS } from '@common/socket-events/chatroom.events';
import { ConnectedSocket, MessageBody, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const GLOBAL_ROOM_ID = 'global';

interface RoomPayload {
    gameId: string;
    playerName: string;
    uid: string;
}

interface RoomHistoryPayload {
    gameId: string;
}

interface DeleteMessagesPayload {
    gameId: string;
}

interface RegisterUserPayload {
    uid: string;
}

interface CreateRoomPayload {
    name: string;
    owner: string;
    ownerUid?: string;
}

interface DeleteRoomPayload {
    roomId: string;
    owner: string;
    ownerUid?: string;
}

interface SearchRoomsPayload {
    query: string;
}

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayDisconnect {
    @WebSocketServer() server: Server;

    private socketUidMap = new Map<string, string>();
    private globalRoomSockets = new Set<string>();

    constructor(
        private chatService: ChatService,
        private authService: AuthService,
        private friendService: FriendService,
    ) {}

    @SubscribeMessage(CHAT_EVENTS.JOIN_ROOM)
    async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: RoomPayload) {
        await this.chatService.joinRoom(client, payload.gameId, payload.uid);

        if (payload.gameId === GLOBAL_ROOM_ID) {
            this.globalRoomSockets.add(client.id);
        }

        return { joined: true };
    }

    @SubscribeMessage(CHAT_EVENTS.LEAVE_ROOM)
    async handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string; uid: string }) {
        await this.chatService.leaveRoom(client, payload.gameId, payload.uid);

        if (payload.gameId === GLOBAL_ROOM_ID) {
            this.globalRoomSockets.delete(client.id);
        }

        return { left: true };
    }

    @SubscribeMessage(CHAT_EVENTS.SEND_MESSAGE)
    async handleSendMessage(@ConnectedSocket() client: Socket, @MessageBody() message: ChatMessage) {
        const senderUid = this.socketUidMap.get(client.id);
        await this.chatService.sendMessageToRoom(this.server, client, message, senderUid, this.friendService, this.socketUidMap);
        return { sent: true };
    }

    @SubscribeMessage(CHAT_EVENTS.GET_HISTORY)
    async handleGetHistory(@ConnectedSocket() client: Socket, @MessageBody() payload: RoomHistoryPayload) {
        const requesterUid = this.socketUidMap.get(client.id);
        const messages = await this.chatService.getMessageHistory(payload.gameId, requesterUid, this.friendService);
        client.emit(CHAT_EVENTS.HISTORY_RECEIVED, messages);
        return { success: true };
    }

    @SubscribeMessage(CHAT_EVENTS.GET_ROOMS)
    async handleGetRooms(@ConnectedSocket() client: Socket) {
        const rooms = await this.chatService.getRooms();
        client.emit(CHAT_EVENTS.ROOMS_RECEIVED, rooms);
        return { success: true };
    }

    @SubscribeMessage(CHAT_EVENTS.SEARCH_ROOMS)
    async handleSearchRooms(@ConnectedSocket() client: Socket, @MessageBody() payload: SearchRoomsPayload) {
        const rooms = await this.chatService.searchRooms(payload.query);
        client.emit(CHAT_EVENTS.ROOMS_RECEIVED, rooms);
        return { success: true };
    }

    @SubscribeMessage(CHAT_EVENTS.CREATE_ROOM)
    async handleCreateRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: CreateRoomPayload) {
        const room = await this.chatService.createRoom({
            name: payload.name,
            owner: payload.owner,
            ownerUid: payload.ownerUid,
        });

        if ('message' in room) {
            return {
                success: false,
                room: null,
                message: room.message,
            };
        }

        client.join(room.id);

        client.emit(CHAT_EVENTS.ROOM_CREATED, {
            success: true,
            room,
            message: null,
        });

        const rooms = await this.chatService.getRooms();
        this.server.emit(CHAT_EVENTS.ROOMS_RECEIVED, rooms);

        return {
            success: true,
            room,
            message: null,
        };
    }

    @SubscribeMessage(CHAT_EVENTS.DELETE_ROOM)
    async handleDeleteRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: DeleteRoomPayload) {
        const deleted = await this.chatService.deleteRoom({
            roomId: payload.roomId,
            owner: payload.owner,
            ownerUid: payload.ownerUid,
        });

        if (deleted) {
            const socketsInRoom = await this.server.in(payload.roomId).fetchSockets();

            for (const socket of socketsInRoom) {
                socket.leave(payload.roomId);
                socket.join(GLOBAL_ROOM_ID);
                socket.emit(CHAT_EVENTS.ROOM_DELETED, {
                    roomId: payload.roomId,
                    fallbackRoomId: GLOBAL_ROOM_ID,
                });
            }

            client.emit(CHAT_EVENTS.ROOM_DELETED, {
                roomId: payload.roomId,
                fallbackRoomId: GLOBAL_ROOM_ID,
            });
        }

        const rooms = await this.chatService.getRooms();
        this.server.emit(CHAT_EVENTS.ROOMS_RECEIVED, rooms);

        return {
            success: deleted,
        };
    }

    @SubscribeMessage(CHAT_EVENTS.DELETE_GAME_MESSAGES)
    async handleDeleteGameMessages(@ConnectedSocket() client: Socket, @MessageBody() payload: DeleteMessagesPayload) {
        if (!payload.gameId || payload.gameId === GLOBAL_ROOM_ID) {
            return { success: false };
        }

        const socketsInRoom = await this.server.in(payload.gameId).fetchSockets();

        for (const socket of socketsInRoom) {
            socket.leave(payload.gameId);
            socket.join(GLOBAL_ROOM_ID);
            socket.emit(CHAT_EVENTS.ROOM_DELETED, {
                roomId: payload.gameId,
                fallbackRoomId: GLOBAL_ROOM_ID,
            });
        }

        await this.chatService.deleteMessagesForGame(payload.gameId);
        return { success: true };
    }

    @SubscribeMessage(CHAT_EVENTS.REGISTER_USER)
    async handleRegisterUser(@ConnectedSocket() client: Socket, @MessageBody() payload: RegisterUserPayload) {
        if (payload?.uid) {
            this.socketUidMap.set(client.id, payload.uid);

            try {
                const rooms = await this.chatService.getRoomsForUser(payload.uid);
                for (const room of rooms) {
                    try {
                        client.join(room.id);
                    } catch (err) {
                        // ignore the error
                    }
                }
            } catch (err) {
                // ignore the error
            }
        }

        return { registered: true };
    }

    async handleDisconnect(@ConnectedSocket() client: Socket) {
        const inGlobalRoom = this.globalRoomSockets.delete(client.id);
        if (!inGlobalRoom) return;

        const uid = this.socketUidMap.get(client.id);
        if (uid) {
            this.socketUidMap.delete(client.id);
            await this.authService.clearSessionByUid(uid);
        }
    }
}
