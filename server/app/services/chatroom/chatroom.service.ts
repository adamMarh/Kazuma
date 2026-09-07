import { ChatMessage } from '@app/model/schema/chat-message.schema';
import { ChatRoom } from '@app/model/schema/chatroom.schema';
import { FriendService } from '@app/services/friend/friend.service';
import { ChatMessage as ChatMessageDto } from '@common/interfaces/chatmessage.interface';
import { CHAT_EVENTS } from '@common/socket-events/chatroom.events';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Server, Socket } from 'socket.io';
/* eslint-disable @typescript-eslint/no-explicit-any */

const GLOBAL_ROOM_ID = 'global';

export interface ChatRoomSummary {
    id: string;
    name: string;
    owner: string;
    ownerUid?: string;
    isSystem?: boolean;
}

interface CreateRoomInput {
    name: string;
    owner: string;
    ownerUid?: string;
}

interface DeleteRoomInput {
    roomId: string;
    owner: string;
    ownerUid?: string;
}

@Injectable()
export class ChatService {
    constructor(
        @InjectModel(ChatMessage.name) private chatMessageModel: Model<ChatMessage>,
        @InjectModel(ChatRoom.name) private chatRoomModel: Model<ChatRoom>,
    ) {}

    async joinRoom(client: Socket, gameId: string, uid: string) {
        client.join(gameId);
        await this.chatRoomModel.updateMany({ id: gameId }, { $addToSet: { members: uid } }).exec();
    }

    async leaveRoom(client: Socket, gameId: string, uid: string) {
        client.leave(gameId);
        await this.chatRoomModel.updateMany({ id: gameId }, { $pull: { members: uid } }).exec();
    }

    async sendMessageToRoom(
        server: Server,
        client: Socket,
        message: any,
        senderUid?: string,
        friendService?: FriendService,
        socketUidMap?: Map<string, string>,
    ) {
        const targetRoomId = (message.gameId ?? '').trim();

        if (!targetRoomId) {
            return;
        }

        const chatMessage = new this.chatMessageModel({
            author: message.author,
            uid: message.uid,
            content: message.content,
            timestamp: new Date(message.timestamp),
            gameId: targetRoomId,
            fromLobby: message.fromLobby || false,
        });

        await chatMessage.save();

        if (senderUid && friendService && socketUidMap) {
            const socketsInRoom = await server.in(targetRoomId).fetchSockets();
            for (const socket of socketsInRoom) {
                if (socket.id === client.id) {
                    socket.emit(CHAT_EVENTS.RECEIVE_MESSAGE, { ...message, gameId: targetRoomId });
                    continue;
                }
                const recipientUid = socketUidMap.get(socket.id);
                if (recipientUid) {
                    const hasBlock = await friendService.hasBlockRelationship(senderUid, recipientUid);
                    if (hasBlock) continue;
                }
                socket.emit(CHAT_EVENTS.RECEIVE_MESSAGE, { ...message, gameId: targetRoomId });
            }
        } else {
            server.to(targetRoomId).emit(CHAT_EVENTS.RECEIVE_MESSAGE, {
                ...message,
                gameId: targetRoomId,
            });
        }
    }

    async getRoomsForUser(uid: string): Promise<ChatRoom[]> {
        if (!uid) return [];
        return await this.chatRoomModel.find({ members: uid }).exec();
    }

    async userHasAccessToRoom(gameId: string, uid?: string): Promise<boolean> {
        if (!gameId) return false;
        if (gameId === GLOBAL_ROOM_ID) return true;
        if (!uid) return false;

        const exists = await this.chatRoomModel.exists({ id: gameId, members: uid }).exec();
        return !!exists;
    }
    async getMessageHistory(gameId: string, requesterUid?: string, friendService?: FriendService): Promise<ChatMessageDto[]> {
        const messages = await this.chatMessageModel.find({ gameId }).sort({ timestamp: 1 }).exec();

        let blockedUids: Set<string> | undefined;
        if (requesterUid && friendService) {
            const [blocked, blockedBy] = await Promise.all([
                friendService.getBlockedUsers(requesterUid),
                friendService.getUsersWhoBlocked(requesterUid),
            ]);
            blockedUids = new Set([...blocked, ...blockedBy]);
        }

        return messages
            .filter((msg) => !blockedUids || !msg.uid || !blockedUids.has(msg.uid))
            .map((msg) => ({
                author: msg.author,
                uid: msg.uid,
                content: msg.content,
                timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
                gameId: msg.gameId,
                fromLobby: msg.fromLobby,
            }));
    }

    async deleteMessagesForGame(gameId: string): Promise<void> {
        if (!gameId) {
            return;
        }

        try {
            await this.chatMessageModel.deleteMany({ gameId }).exec();
        } catch (error) {
            //
        }
    }

    async purgeMessagesByUsername(username: string): Promise<{ deletedMessages: number }> {
        if (!username) {
            return { deletedMessages: 0 };
        }

        const res = await this.chatMessageModel.deleteMany({ author: username }).exec();

        return {
            deletedMessages: res.deletedCount ?? 0,
        };
    }

    async updateMessageUsername(oldUsername: string, newUsername: string): Promise<void> {
        await this.chatMessageModel.updateMany({ author: oldUsername }, { $set: { author: newUsername } }).exec();
    }

    async getRooms(): Promise<ChatRoomSummary[]> {
        const rooms = await this.chatRoomModel.find().exec();
        return [
            this.buildGlobalRoom(),
            rooms.map((room) => ({
                id: room.id,
                name: room.name,
                owner: room.owner,
                ownerUid: room.ownerUid,
                isSystem: room.isSystem,
                members: room.members,
            })),
        ].flat();
    }

    async searchRooms(query: string): Promise<ChatRoomSummary[]> {
        const normalizedQuery = (query ?? '').trim().toLowerCase();

        if (!normalizedQuery) {
            return this.getRooms();
        }

        return (await this.getRooms()).filter(
            (room) => room.name.toLowerCase().includes(normalizedQuery) || room.id.toLowerCase().includes(normalizedQuery),
        );
    }

    async createRoom(data: CreateRoomInput): Promise<ChatRoomSummary | { message: string }> {
        const trimmedName = (data.name ?? '').trim();
        const existingRoom = await this.chatRoomModel.findOne({ name: trimmedName, ownerUid: data.ownerUid }).exec();
        if (existingRoom) {
            return {
                message: 'Il existe déjà une salle avec ce nom pour cet utilisateur.',
            };
        }
        if (!trimmedName) {
            return {
                message: 'Le nom de la salle est requis.',
            };
        }

        const room = new this.chatRoomModel({
            id: this.generateUniqueRoomId(),
            name: trimmedName,
            owner: data.owner,
            ownerUid: data.ownerUid,
            isSystem: false,
            members: [data.ownerUid],
        });

        await room.save();
        return room;
    }

    async deleteRoom(data: DeleteRoomInput): Promise<boolean> {
        const roomId = (data.roomId ?? '').trim();

        if (!roomId || roomId === GLOBAL_ROOM_ID) {
            return false;
        }

        const room = await this.chatRoomModel.findOne({ id: roomId, ownerUid: data.ownerUid }).exec();
        if (!room) {
            return false;
        }

        const sameOwnerUid = !!room.ownerUid && !!data.ownerUid && room.ownerUid === data.ownerUid;
        const sameOwnerName = room.owner === data.owner;

        if (!sameOwnerUid && !sameOwnerName) {
            return false;
        }

        await this.chatRoomModel.deleteMany({ id: roomId, ownerUid: data.ownerUid }).exec();

        try {
            await this.chatMessageModel.deleteMany({ gameId: roomId }).exec();
        } catch (error) {
            //
        }

        return true;
    }

    private buildGlobalRoom(): ChatRoomSummary {
        return {
            id: GLOBAL_ROOM_ID,
            name: 'Global',
            owner: 'system',
            isSystem: true,
        };
    }

    private generateUniqueRoomId(): string {
        // Use MongoDB ObjectId format for guaranteed uniqueness
        // Alternative: could use UUID, nanoid, or crypto.randomUUID()
        return `room-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }
}
