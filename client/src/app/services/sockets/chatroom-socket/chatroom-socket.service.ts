import { Injectable, inject } from '@angular/core';
import { AuthService } from '@app/services/auth/auth.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { ChatMessage } from '@common/interfaces/chatmessage.interface';
import { CHAT_EVENTS } from '@common/socket-events/chatroom.events';
import { Observable, Subject } from 'rxjs';

export interface ChatRoomSummary {
    id: string;
    name: string;
    owner: string;
    ownerUid?: string;
    isSystem?: boolean;
    members?: string[];
}

export interface RoomDeletedPayload {
    roomId: string;
    fallbackRoomId: string;
}

@Injectable({
    providedIn: 'root',
})
export class ChatSocketService {
    messages$: Observable<ChatMessage>;
    history$: Observable<ChatMessage[]>;
    rooms$: Observable<ChatRoomSummary[]>;
    roomDeleted$: Observable<RoomDeletedPayload>;

    private readonly joinedRoomsStorageKey = 'chat_joined_rooms_by_uid';
    private readonly activeRoomStorageKey = 'chat_active_room_by_uid';

    private socketService = inject(SocketService);
    private authService = inject(AuthService);

    private messagesSubject = new Subject<ChatMessage>();
    private historySubject = new Subject<ChatMessage[]>();
    private roomsSubject = new Subject<ChatRoomSummary[]>();
    private roomDeletedSubject = new Subject<RoomDeletedPayload>();

    private joinedRoomsByUid = new Map<string, ChatRoomSummary[]>();
    private activeRoomIdByUid = new Map<string, string>();

    constructor() {
        this.loadStateFromStorage();

        this.messages$ = this.messagesSubject.asObservable();
        this.history$ = this.historySubject.asObservable();
        this.rooms$ = this.roomsSubject.asObservable();
        this.roomDeleted$ = this.roomDeletedSubject.asObservable();

        this.socketService.on(CHAT_EVENTS.RECEIVE_MESSAGE).subscribe((message) => {
            this.messagesSubject.next(message as ChatMessage);
        });

        this.socketService.on(CHAT_EVENTS.HISTORY_RECEIVED).subscribe((data) => {
            this.historySubject.next(data as ChatMessage[]);
        });

        this.socketService.on(CHAT_EVENTS.ROOMS_RECEIVED).subscribe((data) => {
            const rooms = (data as ChatRoomSummary[]) ?? [];
            this.roomsSubject.next(rooms);

            const uid = this.getCurrentUid();
            if (!uid) return;

            const serverJoinedRooms = rooms.filter((room) => {
                if (room.isSystem) return true;
                if (room.id === 'global') return true;
                return Array.isArray(room.members) && room.members.includes(uid);
            });

            const existingRooms = this.getJoinedRoomsSnapshot(uid);
            const mergedRooms = this.mergeUniqueRooms(existingRooms, serverJoinedRooms);

            this.setJoinedRooms(uid, mergedRooms);
        });

        this.socketService.on(CHAT_EVENTS.ROOM_DELETED).subscribe((data) => {
            const payload = data as RoomDeletedPayload;
            const uid = this.getCurrentUid();

            if (uid) {
                this.removeJoinedRoomState(uid, payload.roomId);
                this.setActiveRoomId(uid, payload.fallbackRoomId);
            }

            this.roomDeletedSubject.next(payload);
        });
    }

    joinRoom(gameId: string, playerName: string): Observable<unknown> {
        const uid = this.getCurrentUid();

        if (uid) {
            this.socketService.send(CHAT_EVENTS.REGISTER_USER, { uid });
        }

        return this.socketService.emit(CHAT_EVENTS.JOIN_ROOM, { gameId, playerName, uid });
    }

    leaveRoom(gameId: string): Observable<unknown> {
        const uid = this.getCurrentUid();

        if (uid) {
            this.removeJoinedRoomState(uid, gameId);

            if (this.getActiveRoomIdSnapshot(uid) === gameId) {
                this.setActiveRoomId(uid, 'global');
            }
        }

        return this.socketService.emit(CHAT_EVENTS.LEAVE_ROOM, { gameId, uid });
    }

    sendMessage(gameId: string, author: string, content: string, fromLobby: boolean = false): Observable<unknown> {
        const now = new Date();
        const timestamp = now.toISOString();

        const message: ChatMessage = {
            author,
            uid: this.getCurrentUid(),
            content,
            gameId,
            timestamp,
            fromLobby,
        };

        return this.socketService.emit(CHAT_EVENTS.SEND_MESSAGE, message);
    }

    getMessageHistory(gameId: string): Observable<unknown> {
        return this.socketService.emit(CHAT_EVENTS.GET_HISTORY, { gameId });
    }

    listRooms(): Observable<unknown> {
        return this.socketService.emit(CHAT_EVENTS.GET_ROOMS, {});
    }

    searchRooms(query: string): Observable<unknown> {
        return this.socketService.emit(CHAT_EVENTS.SEARCH_ROOMS, { query });
    }

    createRoom(name: string, owner: string): Observable<unknown> {
        return this.socketService.emit(CHAT_EVENTS.CREATE_ROOM, {
            name,
            owner,
            ownerUid: this.getCurrentUid(),
        });
    }

    deleteRoom(roomId: string, owner: string): Observable<unknown> {
        return this.socketService.emit(CHAT_EVENTS.DELETE_ROOM, {
            roomId,
            owner,
            ownerUid: this.getCurrentUid(),
        });
    }

    getJoinedRoomsSnapshot(uid: string): ChatRoomSummary[] {
        return [...(this.joinedRoomsByUid.get(uid) ?? [])];
    }

    setJoinedRooms(uid: string, rooms: ChatRoomSummary[]): void {
        const uniqueRooms = this.dedupeRooms(rooms);
        this.joinedRoomsByUid.set(uid, uniqueRooms);
        this.persistJoinedRoomsToStorage();
    }

    addJoinedRoomState(uid: string, room: ChatRoomSummary): void {
        const currentRooms = this.joinedRoomsByUid.get(uid) ?? [];
        const nextRooms = this.mergeUniqueRooms(currentRooms, [room]);
        this.joinedRoomsByUid.set(uid, nextRooms);
        this.persistJoinedRoomsToStorage();
    }

    removeJoinedRoomState(uid: string, roomId: string, ownerUid?: string): void {
        const currentRooms = this.joinedRoomsByUid.get(uid) ?? [];
        const nextRooms = currentRooms.filter((room) => {
            if (room.id !== roomId) return true;
            if (ownerUid === undefined) return false;
            return (room.ownerUid ?? 'system') !== (ownerUid ?? 'system');
        });

        this.joinedRoomsByUid.set(uid, nextRooms);
        this.persistJoinedRoomsToStorage();
    }

    getActiveRoomIdSnapshot(uid: string): string {
        return this.activeRoomIdByUid.get(uid) ?? 'global';
    }

    setActiveRoomId(uid: string, roomId: string): void {
        this.activeRoomIdByUid.set(uid, roomId);
        this.persistActiveRoomsToStorage();
    }

    private getCurrentUid(): string | undefined {
        return this.authService.currentUser?.uid;
    }

    private getRoomKey(room: Pick<ChatRoomSummary, 'id' | 'ownerUid'>): string {
        return `${room.id}::${room.ownerUid ?? 'system'}`;
    }

    private dedupeRooms(rooms: ChatRoomSummary[]): ChatRoomSummary[] {
        return rooms.filter((room, index, arr) => arr.findIndex((r) => this.getRoomKey(r) === this.getRoomKey(room)) === index);
    }

    private mergeUniqueRooms(baseRooms: ChatRoomSummary[], incomingRooms: ChatRoomSummary[]): ChatRoomSummary[] {
        const merged = [...baseRooms];

        for (const room of incomingRooms) {
            const existingIndex = merged.findIndex((existing) => this.getRoomKey(existing) === this.getRoomKey(room));

            if (existingIndex >= 0) {
                merged[existingIndex] = {
                    ...merged[existingIndex],
                    ...room,
                };
            } else {
                merged.push(room);
            }
        }

        return this.dedupeRooms(merged);
    }

    private loadStateFromStorage(): void {
        this.loadJoinedRoomsFromStorage();
        this.loadActiveRoomsFromStorage();
    }

    private loadJoinedRoomsFromStorage(): void {
        try {
            const raw = localStorage.getItem(this.joinedRoomsStorageKey);
            if (!raw) return;

            const parsed = JSON.parse(raw) as Record<string, ChatRoomSummary[]>;

            for (const [uid, rooms] of Object.entries(parsed)) {
                if (!uid || !Array.isArray(rooms)) continue;
                this.joinedRoomsByUid.set(uid, this.dedupeRooms(rooms));
            }
        } catch {
            localStorage.removeItem(this.joinedRoomsStorageKey);
        }
    }

    private loadActiveRoomsFromStorage(): void {
        try {
            const raw = localStorage.getItem(this.activeRoomStorageKey);
            if (!raw) return;

            const parsed = JSON.parse(raw) as Record<string, string>;

            for (const [uid, roomId] of Object.entries(parsed)) {
                if (!uid || typeof roomId !== 'string') continue;
                this.activeRoomIdByUid.set(uid, roomId);
            }
        } catch {
            localStorage.removeItem(this.activeRoomStorageKey);
        }
    }

    private persistJoinedRoomsToStorage(): void {
        try {
            const serialized: Record<string, ChatRoomSummary[]> = {};

            for (const [uid, rooms] of this.joinedRoomsByUid.entries()) {
                serialized[uid] = rooms;
            }

            localStorage.setItem(this.joinedRoomsStorageKey, JSON.stringify(serialized));
        } catch {
            // no-op
        }
    }

    private persistActiveRoomsToStorage(): void {
        try {
            const serialized: Record<string, string> = {};

            for (const [uid, roomId] of this.activeRoomIdByUid.entries()) {
                serialized[uid] = roomId;
            }

            localStorage.setItem(this.activeRoomStorageKey, JSON.stringify(serialized));
        } catch {
            // no-op
        }
    }
}
