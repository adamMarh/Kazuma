import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StatusIndicatorComponent } from '@app/components/status-indicator/status-indicator.component';
import { FriendService } from '@app/services/friend/friend.service';
import { GameService } from '@app/services/game/game.service';
import { LanguageService } from '@app/services/language/language.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import {
    FriendEntry,
    FriendRequest,
    STATUS_COLOR,
    STATUS_SORT_ORDER,
    UserProfile,
    UserStatus
} from '@common/interfaces/friend.interface';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

type FriendTab = 'friends' | 'requests' | 'search' | 'blocked';

const ERROR_DISPLAY_DURATION = 4000;
const SEARCH_DEBOUNCE_MS = 300;

@Component({
    selector: 'app-friend-list',
    templateUrl: './friend-list.component.html',
    styleUrls: ['./friend-list.component.scss'],
    imports: [CommonModule, FormsModule, StatusIndicatorComponent, TranslatePipe],
})
export class FriendListComponent implements OnInit, OnDestroy {
    activeTab: FriendTab = 'friends';
    friends: FriendEntry[] = [];
    pendingRequests: FriendRequest[] = [];
    searchResults: UserProfile[] = [];
    blockedUsers: UserProfile[] = [];
    searchQuery = '';
    isOpen = false;
    errorMessage: string | null = null;
    pendingSentRequests = new Set<string>();
    currentGameId: string | null = null;
    lastSearchedQuery = '';

    private friendService = inject(FriendService);
    private gameService = inject(GameService);
    private languageService = inject(LanguageService);
    private subscriptions: Subscription[] = [];
    private searchSubject = new Subject<string>();

    ngOnInit(): void {
        this.subscriptions.push(
            this.gameService.gameInstance$.subscribe((game) => {
                this.currentGameId = game ? game.gameId : null;
            }),
        );

        this.subscriptions.push(
            this.friendService.friends$.subscribe((friends) => {
                this.friends = this.sortFriendsByStatus(friends);
            }),
        );

        this.subscriptions.push(
            this.friendService.pendingRequests$.subscribe((requests) => {
                this.pendingRequests = requests;
            }),
        );

        this.subscriptions.push(
            this.friendService.friendError$.subscribe((error) => {
                if (error) {
                    this.errorMessage = error.message;
                    setTimeout(() => {
                        this.errorMessage = null;
                    }, ERROR_DISPLAY_DURATION);
                }
            }),
        );

        this.subscriptions.push(
            this.friendService.requestDeclined$.subscribe((request) => {
                this.pendingSentRequests.delete(request.toUid);
            }),
        );

        this.subscriptions.push(
            this.friendService.requestAccepted$.subscribe((request) => {
                this.pendingSentRequests.delete(request.toUid);
            }),
        );

        this.subscriptions.push(
            this.friendService.searchResults$.subscribe((results) => {
                this.searchResults = results;
            }),
        );

        this.subscriptions.push(
            this.friendService.blockedUsers$.subscribe((users) => {
                this.blockedUsers = users;
            }),
        );

        this.subscriptions.push(
            this.friendService.usersUpdated$.subscribe(() => {
                if (this.activeTab === 'search' && this.searchQuery.trim().length >= 2) {
                    this.friendService.searchUsersViaSocket(this.searchQuery);
                }
            }),
        );

        this.subscriptions.push(
            this.searchSubject.pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged()).subscribe((query) => {
                const trimmed = query.trim();
                if (trimmed.length < 2) {
                    this.searchResults = [];
                    this.lastSearchedQuery = '';
                    return;
                }
                this.lastSearchedQuery = trimmed;
                this.friendService.searchUsersViaSocket(trimmed);
            }),
        );
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((sub) => sub.unsubscribe());
    }

    togglePanel(): void {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.friendService.loadFriends();
            this.friendService.loadPendingRequests();
        }
    }

    setTab(tab: FriendTab): void {
        this.activeTab = tab;
        if (tab === 'search') {
            this.searchResults = [];
            this.searchQuery = '';
            this.lastSearchedQuery = '';
        }
    }

    onSearchInput(): void {
        this.searchSubject.next(this.searchQuery);
    }

    async onSearchSubmit(): Promise<void> {
        const trimmed = this.searchQuery.trim();
        if (trimmed.length < 2) {
            this.searchResults = [];
            return;
        }
        this.lastSearchedQuery = trimmed;
        this.friendService.searchUsersViaSocket(trimmed);
    }

    sendRequest(user: UserProfile): void {
        this.friendService.sendFriendRequest(user.uid);
        this.pendingSentRequests.add(user.uid);
    }

    acceptRequest(request: FriendRequest): void {
        this.friendService.acceptRequest(request.id);
        this.pendingRequests = this.pendingRequests.filter((r) => r.id !== request.id);
    }

    declineRequest(request: FriendRequest): void {
        this.friendService.declineRequest(request.id);
        this.pendingRequests = this.pendingRequests.filter((r) => r.id !== request.id);
    }

    removeFriend(friend: FriendEntry): void {
        this.friendService.removeFriend(friend.uid);
    }

    blockFriend(friend: FriendEntry): void {
        this.friendService.blockUser(friend.uid);
    }

    blockSearchUser(user: UserProfile): void {
        this.friendService.blockUser(user.uid);
        this.searchResults = this.searchResults.filter((u) => u.uid !== user.uid);
    }

    unblockUser(user: UserProfile): void {
        this.friendService.unblockUser(user.uid);
    }

    inviteFriend(friend: FriendEntry): void {
        const gameId = this.currentGameId;
        if (gameId) {
            this.friendService.inviteToGame(friend.uid, gameId);
        }
    }

    canInvite(friend: FriendEntry): boolean {
        return !!this.currentGameId && friend.userStatus === 'online';
    }

    statusLabel(status: UserStatus | undefined): string {
        const key = status ?? 'offline';
        return this.languageService.translate('status.' + key);
    }

    statusColor(status: UserStatus | undefined): string {
        return STATUS_COLOR[status ?? 'offline'];
    }

    isRequestSent(uid: string): boolean {
        return this.pendingSentRequests.has(uid);
    }

    private sortFriendsByStatus(friends: FriendEntry[]): FriendEntry[] {
        return [...friends].sort((a, b) => (STATUS_SORT_ORDER[a.userStatus ?? 'offline'] ?? 4) - (STATUS_SORT_ORDER[b.userStatus ?? 'offline'] ?? 4));
    }
}
