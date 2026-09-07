import { HttpClient } from '@angular/common/http';
import { inject, Injectable, OnDestroy } from '@angular/core';
import { AuthService } from '@app/services/auth/auth.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { FriendEntry, FriendRequest, GameInvitation, UserProfile, UserStatus } from '@common/interfaces/friend.interface';
import { FRIEND_EVENTS } from '@common/socket-events/friend.events';
import { environment } from '@environments/environment';
import { BehaviorSubject, firstValueFrom, Observable, Subject, Subscription } from 'rxjs';

export interface LobbyBlockConflict {
    gameId: string;
    conflictUsers: string[];
}

export interface LobbyBlockStayOrLeave {
    gameId: string;
    blockedUsername: string;
}

@Injectable({
    providedIn: 'root',
})
export class FriendService implements OnDestroy {
    friends$: Observable<FriendEntry[]>;
    pendingRequests$: Observable<FriendRequest[]>;
    friendError$: Observable<{ message: string }>;
    requestDeclined$: Observable<FriendRequest>;
    requestAccepted$: Observable<FriendRequest>;
    usersUpdated$: Observable<void>;
    isBusy$: Observable<boolean>;
    invitation$: Observable<GameInvitation>;
    searchResults$: Observable<UserProfile[]>;
    blockedUsers$: Observable<UserProfile[]>;
    lobbyBlockConflict$: Observable<LobbyBlockConflict>;
    lobbyBlockStayOrLeave$: Observable<LobbyBlockStayOrLeave>;

    private friendsSubject = new BehaviorSubject<FriendEntry[]>([]);
    private pendingRequestsSubject = new BehaviorSubject<FriendRequest[]>([]);
    private friendErrorSubject = new BehaviorSubject<{ message: string } | null>(null);
    private requestDeclinedSubject = new Subject<FriendRequest>();
    private requestAcceptedSubject = new Subject<FriendRequest>();
    private usersUpdatedSubject = new Subject<void>();
    private isBusySubject = new BehaviorSubject<boolean>(false);
    private invitationSubject = new Subject<GameInvitation>();
    private searchResultsSubject = new BehaviorSubject<UserProfile[]>([]);
    private blockedUsersSubject = new BehaviorSubject<UserProfile[]>([]);
    private lobbyBlockConflictSubject = new Subject<LobbyBlockConflict>();
    private lobbyBlockStayOrLeaveSubject = new Subject<LobbyBlockStayOrLeave>();

    private http = inject(HttpClient);
    private authService = inject(AuthService);
    private socketService = inject(SocketService);

    private apiUrl = `${environment.serverUrl}/friends`;
    private subscriptions: Subscription[] = [];
    private registered = false;

    constructor() {
        this.friends$ = this.friendsSubject.asObservable();
        this.pendingRequests$ = this.pendingRequestsSubject.asObservable();
        this.friendError$ = this.friendErrorSubject.asObservable() as Observable<{ message: string }>;
        this.requestDeclined$ = this.requestDeclinedSubject.asObservable();
        this.requestAccepted$ = this.requestAcceptedSubject.asObservable();
        this.usersUpdated$ = this.usersUpdatedSubject.asObservable();
        this.isBusy$ = this.isBusySubject.asObservable();
        this.invitation$ = this.invitationSubject.asObservable();
        this.searchResults$ = this.searchResultsSubject.asObservable();
        this.blockedUsers$ = this.blockedUsersSubject.asObservable();
        this.lobbyBlockConflict$ = this.lobbyBlockConflictSubject.asObservable();
        this.lobbyBlockStayOrLeave$ = this.lobbyBlockStayOrLeaveSubject.asObservable();
        this.setupSocketListeners();
        this.setupAutoRegister();
    }

    get friends(): FriendEntry[] {
        return this.friendsSubject.value;
    }

    get pendingRequests(): FriendRequest[] {
        return this.pendingRequestsSubject.value;
    }

    get isBusy(): boolean {
        return this.isBusySubject.value;
    }

    registerUser(): void {
        const user = this.authService.currentUser;
        if (user && !this.registered) {
            this.socketService.send(FRIEND_EVENTS.REGISTER_USER, {
                uid: user.uid,
                username: user.displayName ?? user.uid,
            });
            this.registered = true;
            this.loadFriends();
            this.loadPendingRequests();
        }
    }

    loadFriends(): void {
        const user = this.authService.currentUser;
        if (user) {
            this.socketService.send(FRIEND_EVENTS.GET_FRIENDS, { userUid: user.uid });
        }
    }

    loadPendingRequests(): void {
        const user = this.authService.currentUser;
        if (user) {
            this.socketService.send(FRIEND_EVENTS.GET_PENDING_REQUESTS, { userUid: user.uid });
        }
    }

    sendFriendRequest(toUid: string): void {
        const user = this.authService.currentUser;
        if (user) {
            this.socketService.send(FRIEND_EVENTS.SEND_REQUEST, { fromUid: user.uid, toUid });
        }
    }

    acceptRequest(requestId: string): void {
        const user = this.authService.currentUser;
        if (user) {
            this.socketService.send(FRIEND_EVENTS.ACCEPT_REQUEST, { requestId, userUid: user.uid });
        }
    }

    declineRequest(requestId: string): void {
        const user = this.authService.currentUser;
        if (user) {
            this.socketService.send(FRIEND_EVENTS.DECLINE_REQUEST, { requestId, userUid: user.uid });
        }
    }

    removeFriend(friendUid: string): void {
        const user = this.authService.currentUser;
        if (user) {
            this.socketService.send(FRIEND_EVENTS.REMOVE_FRIEND, { userUid: user.uid, friendUid });
        }
    }

    setBusy(busy: boolean): void {
        const user = this.authService.currentUser;
        if (user) {
            this.isBusySubject.next(busy);
            this.socketService.send(FRIEND_EVENTS.SET_BUSY, { uid: user.uid, busy });
        }
    }

    inviteToGame(friendUid: string, gameId: string): void {
        const user = this.authService.currentUser;
        if (user) {
            this.socketService.send(FRIEND_EVENTS.INVITE_TO_GAME, {
                fromUid: user.uid,
                toUid: friendUid,
                gameId,
            });
        }
    }

    searchUsersViaSocket(query: string): void {
        const user = this.authService.currentUser;
        if (user && query.trim().length >= 2) {
            this.socketService.send(FRIEND_EVENTS.SEARCH_USERS, { query: query.trim(), userUid: user.uid });
        } else {
            this.searchResultsSubject.next([]);
        }
    }

    blockUser(blockedUid: string): void {
        const user = this.authService.currentUser;
        if (user) {
            this.socketService.send(FRIEND_EVENTS.BLOCK_USER, { blockerUid: user.uid, blockedUid });
        }
    }

    unblockUser(blockedUid: string): void {
        const user = this.authService.currentUser;
        if (user) {
            this.socketService.send(FRIEND_EVENTS.UNBLOCK_USER, { blockerUid: user.uid, blockedUid });
        }
    }

    confirmLobbyBlockJoin(gameId: string): void {
        this.socketService.send(FRIEND_EVENTS.LOBBY_BLOCK_CONFIRM, { gameId });
    }

    async searchUsers(query: string): Promise<UserProfile[]> {
        const token = this.authService.getStoredToken();
        if (!token || !query.trim()) return [];

        try {
            return await firstValueFrom(
                this.http.get<UserProfile[]>(`${this.apiUrl}/search`, {
                    params: { q: query },
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );
        } catch {
            return [];
        }
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((sub) => sub.unsubscribe());
        this.registered = false;
    }

    private setupAutoRegister(): void {
        this.subscriptions.push(
            this.authService.currentUser$.subscribe((user) => {
                if (user) {
                    this.registerUser();
                } else {
                    this.registered = false;
                    this.friendsSubject.next([]);
                    this.pendingRequestsSubject.next([]);
                }
            }),
        );
    }

    private setupSocketListeners(): void {
        this.subscriptions.push(
            this.socketService.on<FriendEntry[]>(FRIEND_EVENTS.FRIEND_LIST_UPDATED).subscribe((friends) => {
                this.friendsSubject.next(friends);
            }),
        );

        this.subscriptions.push(
            this.socketService.on<FriendRequest[]>(FRIEND_EVENTS.PENDING_REQUESTS_UPDATED).subscribe((requests) => {
                this.pendingRequestsSubject.next(requests);
            }),
        );

        this.subscriptions.push(
            this.socketService.on<FriendRequest>(FRIEND_EVENTS.RECEIVE_REQUEST).subscribe((request) => {
                const current = this.pendingRequestsSubject.value;
                if (!current.find((r) => r.id === request.id)) {
                    this.pendingRequestsSubject.next([request, ...current]);
                }
            }),
        );

        this.subscriptions.push(
            this.socketService.on<FriendRequest>(FRIEND_EVENTS.REQUEST_ACCEPTED).subscribe((request) => {
                this.loadFriends();
                this.requestAcceptedSubject.next(request);
            }),
        );

        this.subscriptions.push(
            this.socketService.on<FriendRequest>(FRIEND_EVENTS.REQUEST_DECLINED).subscribe((request) => {
                this.requestDeclinedSubject.next(request);
            }),
        );

        this.subscriptions.push(
            this.socketService.on<{ uid: string }>(FRIEND_EVENTS.FRIEND_REMOVED).subscribe(() => {
                this.loadFriends();
            }),
        );

        this.subscriptions.push(
            this.socketService.on<void>(FRIEND_EVENTS.USERS_UPDATED).subscribe(() => {
                this.usersUpdatedSubject.next();
            }),
        );

        this.subscriptions.push(
            this.socketService.on<{ message: string }>(FRIEND_EVENTS.ERROR).subscribe((error) => {
                this.friendErrorSubject.next(error);
            }),
        );

        this.subscriptions.push(
            this.socketService.on<{ uid: string; status: UserStatus }>(FRIEND_EVENTS.STATUS_CHANGED).subscribe((data) => {
                const friends = this.friendsSubject.value;
                const idx = friends.findIndex((f) => f.uid === data.uid);
                if (idx !== -1) {
                    friends[idx] = { ...friends[idx], userStatus: data.status };
                    this.friendsSubject.next([...friends]);
                }
            }),
        );

        this.subscriptions.push(
            this.socketService.on<GameInvitation>(FRIEND_EVENTS.GAME_INVITATION).subscribe((invitation) => {
                this.invitationSubject.next(invitation);
            }),
        );

        this.subscriptions.push(
            this.socketService.on<UserProfile[]>(FRIEND_EVENTS.SEARCH_RESULTS).subscribe((results) => {
                this.searchResultsSubject.next(results);
            }),
        );

        this.subscriptions.push(
            this.socketService.on<UserProfile[]>(FRIEND_EVENTS.BLOCKED_LIST_UPDATED).subscribe((list) => {
                this.blockedUsersSubject.next(list);
            }),
        );

        this.subscriptions.push(
            this.socketService.on<void>(FRIEND_EVENTS.NEW_USER).subscribe(() => {
                this.usersUpdatedSubject.next();
            }),
        );

        this.subscriptions.push(
            this.socketService.on<LobbyBlockConflict>(FRIEND_EVENTS.LOBBY_BLOCK_CONFLICT).subscribe((data) => {
                this.lobbyBlockConflictSubject.next(data);
            }),
        );

        this.subscriptions.push(
            this.socketService.on<LobbyBlockStayOrLeave>(FRIEND_EVENTS.LOBBY_BLOCK_STAY_OR_LEAVE).subscribe((data) => {
                this.lobbyBlockStayOrLeaveSubject.next(data);
            }),
        );
    }
}
