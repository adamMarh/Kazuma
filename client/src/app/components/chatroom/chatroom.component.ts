/* eslint-disable max-lines */
import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getShopItemVisualClass } from '@app/constants/shop-catalog';
import { AuthService } from '@app/services/auth/auth.service';
import { AvatarService } from '@app/services/avatar/avatar.service';
import { ChatPopoutService } from '@app/services/chat-popout/chat-popout.service';
import { CurrencyStoreService } from '@app/services/currency/currency-store.service';
import { CurrencyService } from '@app/services/currency/currency.service';
import { ElectronService } from '@app/services/electron/electron.service';
import { LanguageService } from '@app/services/language/language.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { ChatRoomSummary, ChatSocketService, RoomDeletedPayload } from '@app/services/sockets/chatroom-socket/chatroom-socket.service';
import { ChatMessage } from '@common/interfaces/chatmessage.interface';
import { Subscription } from 'rxjs';

interface ChatUiMessage extends ChatMessage {
    uid?: string;
}

@Component({
    selector: 'app-chatroom',
    templateUrl: './chatroom.component.html',
    styleUrls: ['./chatroom.component.scss'],
    standalone: true,
    imports: [FormsModule, CommonModule, TranslatePipe],
})
export class ChatRoomComponent implements OnInit, OnDestroy {
    @Input() gameId: string = 'global';
    @Input() playerName: string;
    @Input() isLobby: boolean = false;
    @Input() isPopup: boolean = false;
    @Input() maxChars: number = 255;

    @ViewChild('messageInput') messageInput!: ElementRef<HTMLTextAreaElement>;
    @ViewChild('messagesContainer') private messagesContainer!: ElementRef<HTMLDivElement>;

    messages: ChatUiMessage[] = [];
    currentMessage = '';
    errorMessage: string = '';

    roomSearchTerm = '';
    newRoomName = '';
    activeRoomId = 'global';
    showRoomsView = false;

    joinedRooms: ChatRoomSummary[] = [];
    availableRooms: ChatRoomSummary[] = [];

    avatarSrcs = new Map<string, string>();
    popoutService = inject(ChatPopoutService);
    electronService = inject(ElectronService);

    private roomMessages = new Map<string, ChatUiMessage[]>();
    private pendingHistoryRoomId: string | null = null;
    private chatService = inject(ChatSocketService);
    private authService = inject(AuthService);
    private avatarService = inject(AvatarService);
    private currencyService = inject(CurrencyService);
    private currencyStore = inject(CurrencyStoreService);
    private languageService = inject(LanguageService);

    private userVisuals = new Map<string, string[]>();
    private visualsFetching = new Set<string>();
    private avatarsFetching = new Set<string>();
    private avatarInvalidationSub?: Subscription;
    private visualClassesCache = new Map<string, string[]>();
    private timestampCache = new Map<string, string>();

    private messageSub?: Subscription;
    private historySub?: Subscription;
    private roomsSub?: Subscription;
    private roomDeletedSub?: Subscription;
    private popoutSub?: Subscription;
    private avatarSubs: Subscription[] = [];

    get currentRoomId(): string {
        return this.activeRoomId;
    }

    get activeRoom(): ChatRoomSummary | undefined {
        return this.joinedRooms.find((room) => room.id === this.activeRoomId) ?? this.availableRooms.find((room) => room.id === this.activeRoomId);
    }

    get filteredAvailableRooms(): ChatRoomSummary[] {
        const query = this.roomSearchTerm.trim().toLowerCase();
        const baseRooms = this.availableRooms.filter(
            (room) => !this.joinedRooms.some((joined) => joined.id === room.id && joined.ownerUid === room.ownerUid),
        );

        if (!query) {
            return baseRooms;
        }

        return baseRooms.filter((room) => room.name.toLowerCase().includes(query) || room.id.toLowerCase().includes(query));
    }

    ngOnInit(): void {
        if (!this.playerName) {
            this.playerName = this.authService.currentUsername || this.languageService.translate('chatroom.anonymous');
        }

        this.initializeRoomState();
        this.subscribeToIncomingMessages();
        this.rejoinPersistedRooms();
        this.activateRoom(this.activeRoomId);
        this.loadAvailableRooms();

        this.roomsSub = this.chatService.rooms$.subscribe((rooms) => {
            this.availableRooms = this.mergeSystemRooms(rooms ?? []);
            this.reconcileJoinedRoomsWithAvailableRooms();
        });

        this.roomDeletedSub = this.chatService.roomDeleted$.subscribe(({ roomId, fallbackRoomId }: RoomDeletedPayload) => {
            this.joinedRooms = this.joinedRooms.filter((room) => room.id !== roomId);
            this.availableRooms = this.availableRooms.filter((room) => room.id !== roomId);
            this.roomMessages.delete(roomId);

            this.syncJoinedRoomsToService();

            if (this.activeRoomId === roomId) {
                this.activateRoom(fallbackRoomId);
                this.showRoomsView = false;
            }
        });

        if (!this.isPopup) {
            this.popoutSub = this.popoutService.isPoppedOut$.subscribe((isPoppedOut) => {
                if (isPoppedOut) {
                    this.chatService.leaveRoom(this.currentRoomId).subscribe();
                    this.messages = [];
                } else {
                    this.activateRoom(this.activeRoomId);
                }
            });
        }

        this.avatarInvalidationSub = this.avatarService.avatarInvalidated$.subscribe((keys) => {
            for (const key of keys) {
                this.avatarSrcs.delete(key);
                this.avatarsFetching.delete(key);
            }
            for (const msg of this.messages) {
                this.fetchAvatarIfNeeded(msg);
            }
        });
    }

    getVisualClassesForAuthor(author: string): string[] {
        const cached = this.visualClassesCache.get(author);
        if (cached) {
            return cached;
        }

        const visuals = this.userVisuals.get(author) ?? [];
        const classes: string[] = [];
        for (const v of visuals) {
            const cls = getShopItemVisualClass(v);
            if (cls) classes.push(cls);
        }
        this.visualClassesCache.set(author, classes);
        return classes;
    }

    ngOnDestroy(): void {
        if (!this.popoutService.isPoppedOut && this.currentRoomId === 'global') {
            this.chatService.leaveRoom('global').subscribe();
        }
        this.messageSub?.unsubscribe();
        this.historySub?.unsubscribe();
        this.roomsSub?.unsubscribe();
        this.roomDeletedSub?.unsubscribe();
        this.popoutSub?.unsubscribe();
        this.avatarInvalidationSub?.unsubscribe();
        this.avatarSubs.forEach((sub) => sub.unsubscribe());
    }

    openRoomsView(): void {
        this.showRoomsView = true;
    }

    openChatView(): void {
        this.showRoomsView = false;
        setTimeout(() => this.scrollToBottom(), 0);
    }

    openRoom(roomId: string): void {
        this.switchRoom(roomId);
        this.showRoomsView = false;
        setTimeout(() => this.scrollToBottom(), 0);
    }

    joinAndOpenRoom(room: ChatRoomSummary): void {
        this.joinRoom(room);
        this.showRoomsView = false;
        setTimeout(() => this.scrollToBottom(), 0);
    }

    createRoom(): void {
        const roomName = this.newRoomName.trim();
        if (!roomName) return;

        this.chatService.createRoom(roomName, this.playerName).subscribe({
            next: (response: unknown) => {
                const result = response as { success?: boolean; room?: ChatRoomSummary; message?: string };
                const createdRoom = result?.room;

                if (!createdRoom) {
                    this.errorMessage = result.message ?? this.languageService.translate('chatroom.roomCreationError');
                    setTimeout(() => (this.errorMessage = ''), 2000);
                    return;
                }

                this.newRoomName = '';
                this.addJoinedRoom(createdRoom);
                this.activateRoom(createdRoom.id);
                this.showRoomsView = false;
            },
        });
    }

    deleteRoom(room: ChatRoomSummary, event?: Event): void {
        event?.stopPropagation();

        if (!this.canDeleteRoom(room)) return;

        this.chatService.deleteRoom(room.id, this.playerName).subscribe({
            next: () => {
                this.handleDeletedRoomLocally(room.id);
                this.loadAvailableRooms();
            },
        });
    }

    joinRoom(room: ChatRoomSummary): void {
        if (this.isJoined(room.id, room.ownerUid)) {
            this.activateRoom(room.id);
            return;
        }

        this.chatService.joinRoom(room.id, this.playerName).subscribe({
            next: () => {
                this.addJoinedRoom(room);
                this.activateRoom(room.id);
            },
        });
    }

    switchRoom(roomId: string): void {
        if (this.activeRoomId === roomId) return;
        this.activateRoom(roomId);
    }

    leaveJoinedRoom(room: ChatRoomSummary, event?: Event): void {
        event?.stopPropagation();

        if (room.isSystem) return;

        this.chatService.leaveRoom(room.id).subscribe({
            next: () => {
                this.joinedRooms = this.joinedRooms.filter((r) => !this.isSameRoom(r, room));
                this.syncJoinedRoomsToService();

                if (this.activeRoomId === room.id) {
                    this.activateRoom('global');
                }
            },
        });
    }

    refreshRoomSearch(): void {
        const query = this.roomSearchTerm.trim();

        if (query) {
            this.chatService.searchRooms(query).subscribe();
            return;
        }

        this.loadAvailableRooms();
    }

    send(): void {
        if (!this.currentRoomId || !this.currentMessage.trim()) {
            return;
        }

        const content = this.currentMessage.trim().slice(0, this.maxChars);

        this.chatService.sendMessage(this.currentRoomId, this.playerName, content, this.isLobby).subscribe({
            next: () => {
                this.currentMessage = '';

                if (this.messageInput) {
                    this.messageInput.nativeElement.style.height = 'auto';
                }

                setTimeout(() => this.scrollToBottom(), 0);
            },
        });
    }

    adjustHeight(): void {
        const textarea = this.messageInput.nativeElement;
        textarea.style.height = '32px';

        const maxHeight = 64;
        const nextHeight = Math.min(textarea.scrollHeight, maxHeight);

        textarea.style.height = `${nextHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }

    getAvatarSrc(message: ChatUiMessage): string {
        const key = this.getAvatarCacheKey(message);
        return this.avatarSrcs.get(key) ?? this.avatarService.defaultAvatarSrc;
    }

    formatTimestamp(timestamp: string): string {
        const cached = this.timestampCache.get(timestamp);
        if (cached) {
            return cached;
        }

        try {
            const date = new Date(timestamp);
            const formatted = date.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            });
            this.timestampCache.set(timestamp, formatted);
            return formatted;
        } catch {
            return timestamp;
        }
    }

    canDeleteRoom(room: ChatRoomSummary): boolean {
        return !room.isSystem && room.owner === this.playerName;
    }

    canLeaveRoom(room: ChatRoomSummary): boolean {
        return !room.isSystem;
    }

    trackRoom(_: number, room: ChatRoomSummary): string {
        return `${room.id}::${room.ownerUid ?? 'system'}`;
    }

    isJoined(roomId: string, ownerUid?: string): boolean {
        return this.joinedRooms.some((joined) => joined.id === roomId && joined.ownerUid === ownerUid);
    }

    popOut(): void {
        this.popoutService.popOut(this.gameId);
    }

    anchorBack(): void {
        this.popoutService.anchor();
    }

    private rejoinPersistedRooms(): void {
        const roomsToRejoin = this.joinedRooms.filter((room) => {
            if (room.id === this.activeRoomId) {
                return false;
            }

            if (room.isSystem) {
                return room.id === 'global' || room.id === this.gameId;
            }

            return true;
        });

        for (const room of roomsToRejoin) {
            this.chatService.joinRoom(room.id, this.playerName).subscribe();
        }
    }

    private initializeRoomState(): void {
        const currentUid = this.authService.currentUser?.uid ?? '';
        const defaultRooms: ChatRoomSummary[] = [this.buildGlobalRoom()];

        if (this.shouldIncludeGameRoom()) {
            defaultRooms.unshift(this.buildGameRoom(this.gameId));
        }

        const savedRooms = currentUid ? this.chatService.getJoinedRoomsSnapshot(currentUid) : [];
        const mergedRooms = [...defaultRooms];

        for (const savedRoom of savedRooms) {
            const alreadyExists = mergedRooms.some((room) => this.isSameRoom(room, savedRoom));

            if (!alreadyExists && (!this.isGameRoom(savedRoom.id) || this.shouldIncludeGameRoom())) {
                mergedRooms.push(savedRoom);
            }
        }

        this.joinedRooms = mergedRooms;
        this.availableRooms = this.mergeSystemRooms([]);

        this.syncJoinedRoomsToService();

        const savedActiveRoomId = currentUid ? this.chatService.getActiveRoomIdSnapshot(currentUid) : 'global';
        const activeRoomStillExists = this.joinedRooms.some((room) => room.id === savedActiveRoomId);

        if (activeRoomStillExists) {
            this.activeRoomId = savedActiveRoomId;
        } else if (this.shouldIncludeGameRoom()) {
            this.activeRoomId = this.gameId;
        } else {
            this.activeRoomId = 'global';
        }
    }

    private subscribeToIncomingMessages(): void {
        this.messageSub = this.chatService.messages$.subscribe((msg) => {
            const roomId = msg.gameId;
            const existingMessages = this.roomMessages.get(roomId) ?? [];
            const updatedMessages = [...existingMessages, msg];

            this.roomMessages.set(roomId, updatedMessages);
            this.fetchAvatarIfNeeded(msg);

            if (roomId === this.activeRoomId) {
                this.messages = updatedMessages;
                setTimeout(() => this.scrollToBottom(), 0);
            }
        });

        this.historySub = this.chatService.history$.subscribe((messages) => {
            if (!messages) return;

            const targetRoomId = this.pendingHistoryRoomId ?? this.activeRoomId;
            this.roomMessages.set(targetRoomId, messages);

            const seenAuthors = new Set<string>();
            for (const msg of messages) {
                this.fetchAvatarIfNeeded(msg);
                if (!seenAuthors.has(msg.author)) {
                    seenAuthors.add(msg.author);
                    this.ensureVisualsForAuthor(msg.author);
                }
            }

            if (targetRoomId === this.activeRoomId) {
                this.messages = messages;
                setTimeout(() => this.scrollToBottom(), 0);
            }

            this.pendingHistoryRoomId = null;
        });
    }

    private activateRoom(roomId: string): void {
        const roomExists = this.availableRooms.some((room) => room.id === roomId) || this.joinedRooms.some((room) => room.id === roomId);

        if (!roomExists) {
            roomId = 'global';
        }

        this.activeRoomId = roomId;

        const currentUid = this.authService.currentUser?.uid;
        if (currentUid) {
            this.chatService.setActiveRoomId(currentUid, roomId);
        }

        this.chatService.joinRoom(roomId, this.playerName).subscribe({
            next: () => {
                this.loadHistoryForRoom(roomId);
            },
        });

        this.messages = this.roomMessages.get(roomId) ?? [];
    }

    private loadHistoryForRoom(roomId: string): void {
        this.pendingHistoryRoomId = roomId;
        this.chatService.getMessageHistory(roomId).subscribe();
    }

    private loadAvailableRooms(): void {
        this.chatService.listRooms().subscribe({
            error: () => {
                this.availableRooms = this.mergeSystemRooms([]);
                this.reconcileJoinedRoomsWithAvailableRooms();
            },
        });
    }

    private addJoinedRoom(room: ChatRoomSummary): void {
        if (!this.joinedRooms.some((joined) => this.isSameRoom(joined, room))) {
            this.joinedRooms.push(room);
        }

        this.upsertAvailableRoom(room);
        this.syncJoinedRoomsToService();
    }

    private upsertAvailableRoom(room: ChatRoomSummary): void {
        const index = this.availableRooms.findIndex((r) => this.isSameRoom(r, room));

        if (index >= 0) {
            this.availableRooms[index] = room;
        } else {
            this.availableRooms.push(room);
        }

        this.availableRooms = this.mergeSystemRooms(this.availableRooms.filter((r) => !r.isSystem));
    }

    private reconcileJoinedRoomsWithAvailableRooms(): void {
        const systemRoomIds = new Set(this.mergeSystemRooms([]).map((room) => this.getRoomKey(room)));
        const availableRoomIds = new Set(this.availableRooms.map((room) => this.getRoomKey(room)));

        const removedJoinedRooms = this.joinedRooms.filter((room) => !room.isSystem && !availableRoomIds.has(this.getRoomKey(room)));

        if (removedJoinedRooms.length > 0) {
            removedJoinedRooms.forEach((room) => {
                this.roomMessages.delete(room.id);
            });

            this.joinedRooms = this.joinedRooms.filter((room) => room.isSystem || availableRoomIds.has(this.getRoomKey(room)));
            this.syncJoinedRoomsToService();

            const activeRoomKey = this.getRoomKey({ id: this.activeRoomId, ownerUid: this.activeRoom?.ownerUid });

            if (!availableRoomIds.has(activeRoomKey) && !systemRoomIds.has(activeRoomKey)) {
                this.activateRoom('global');
                this.showRoomsView = false;
            }
        }

        if (!this.shouldIncludeGameRoom()) {
            this.removeGameRoomLocally();
        }
    }

    private handleDeletedRoomLocally(roomId: string): void {
        this.availableRooms = this.availableRooms.filter((r) => r.id !== roomId);
        this.joinedRooms = this.joinedRooms.filter((r) => r.id !== roomId);
        this.roomMessages.delete(roomId);
        this.syncJoinedRoomsToService();

        if (this.activeRoomId === roomId) {
            this.activateRoom('global');
            this.showRoomsView = false;
        }
    }

    private syncJoinedRoomsToService(): void {
        const currentUid = this.authService.currentUser?.uid;
        if (!currentUid) return;

        this.chatService.setJoinedRooms(currentUid, this.joinedRooms);
    }

    private mergeSystemRooms(rooms: ChatRoomSummary[]): ChatRoomSummary[] {
        const systemRooms: ChatRoomSummary[] = [this.buildGlobalRoom()];

        if (this.shouldIncludeGameRoom()) {
            systemRooms.unshift(this.buildGameRoom(this.gameId));
        }

        const dedupedCustomRooms = rooms.filter(
            (room, index, arr) => arr.findIndex((r) => r.id === room.id && r.ownerUid === room.ownerUid) === index && !room.isSystem,
        );

        return [...systemRooms, ...dedupedCustomRooms];
    }

    private buildGlobalRoom(): ChatRoomSummary {
        return {
            id: 'global',
            name: this.languageService.translate('chatroom.globalRoom'),
            owner: 'system',
            isSystem: true,
        };
    }

    private buildGameRoom(gameId: string): ChatRoomSummary {
        return {
            id: gameId,
            name: `${this.languageService.translate('chatroom.discussionRoom')} ${gameId}`,
            owner: 'system',
            isSystem: true,
        };
    }

    private shouldIncludeGameRoom(): boolean {
        return !!this.gameId && this.gameId !== 'global' && this.isLobby;
    }

    private isGameRoom(roomId: string): boolean {
        return !!this.gameId && this.gameId !== 'global' && roomId === this.gameId;
    }

    private removeGameRoomLocally(): void {
        if (!this.isGameRoom(this.gameId)) return;

        this.joinedRooms = this.joinedRooms.filter((room) => room.id !== this.gameId);
        this.availableRooms = this.availableRooms.filter((room) => room.id !== this.gameId);
        this.roomMessages.delete(this.gameId);
        this.syncJoinedRoomsToService();

        if (this.activeRoomId === this.gameId) {
            this.activateRoom('global');
            this.showRoomsView = false;
        }
    }

    private ensureVisualsForAuthor(author: string): void {
        if (!author || this.userVisuals.has(author) || this.visualsFetching.has(author)) return;

        if (author === this.authService.currentUsername) {
            const wallet = this.currencyStore.wallet;
            this.setAuthorVisuals(author, wallet?.owned?.visuals ?? []);
            return;
        }

        this.visualsFetching.add(author);
        this.currencyService.getWalletByUsername(author).then((wallet) => {
            if (wallet) this.setAuthorVisuals(author, wallet.owned?.visuals ?? []);
            else this.setAuthorVisuals(author, []);
            this.visualsFetching.delete(author);
        });
    }

    private setAuthorVisuals(author: string, visuals: string[]): void {
        this.userVisuals.set(author, visuals);
        this.visualClassesCache.delete(author);
    }

    private scrollToBottom(): void {
        if (!this.messagesContainer) return;
        const nativeEl = this.messagesContainer.nativeElement;
        nativeEl.scrollTop = nativeEl.scrollHeight;
    }

    private fetchAvatarIfNeeded(message: ChatUiMessage): void {
        const key = this.getAvatarCacheKey(message);
        if (this.avatarSrcs.has(key) || this.avatarsFetching.has(key)) return;
        this.avatarsFetching.add(key);

        const src$ = message.uid ? this.avatarService.getAvatarSrcByUid(message.uid) : this.avatarService.getAvatarSrcByUsername(message.author);

        this.avatarSubs.push(
            src$.subscribe((src) => {
                this.avatarSrcs.set(key, src);
                this.avatarsFetching.delete(key);
            }),
        );
    }

    private getAvatarCacheKey(message: ChatUiMessage): string {
        return message.uid ? `uid:${message.uid}` : `author:${message.author}`;
    }

    private getRoomKey(room: Pick<ChatRoomSummary, 'id' | 'ownerUid'>): string {
        return `${room.id}::${room.ownerUid ?? 'system'}`;
    }

    private isSameRoom(a: Pick<ChatRoomSummary, 'id' | 'ownerUid'>, b: Pick<ChatRoomSummary, 'id' | 'ownerUid'>): boolean {
        return a.id === b.id && (a.ownerUid ?? 'system') === (b.ownerUid ?? 'system');
    }
}
