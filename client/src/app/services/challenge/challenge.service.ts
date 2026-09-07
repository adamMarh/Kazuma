import { inject, Injectable, OnDestroy } from '@angular/core';
import { AuthService } from '@app/services/auth/auth.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { ChallengeRecord, PlayerChallenge } from '@common/interfaces/challenge.interface';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class ChallengeService implements OnDestroy {
    activeChallenge$: Observable<PlayerChallenge | null>;
    challengeResult$: Observable<PlayerChallenge | null>;
    challengeHistory$: Observable<ChallengeRecord[]>;

    private activeChallengeSubject = new BehaviorSubject<PlayerChallenge | null>(null);
    private challengeResultSubject = new BehaviorSubject<PlayerChallenge | null>(null);
    private challengeHistorySubject = new BehaviorSubject<ChallengeRecord[]>([]);

    private socketService = inject(SocketService);
    private authService = inject(AuthService);
    private subscriptions: Subscription[] = [];

    constructor() {
        this.activeChallenge$ = this.activeChallengeSubject.asObservable();
        this.challengeResult$ = this.challengeResultSubject.asObservable();
        this.challengeHistory$ = this.challengeHistorySubject.asObservable();
        this.setupListeners();
    }

    get activeChallenge(): PlayerChallenge | null {
        return this.activeChallengeSubject.value;
    }

    get challengeHistory(): ChallengeRecord[] {
        return this.challengeHistorySubject.value;
    }

    loadChallengeHistory(): void {
        const username = this.authService.currentUsername;
        if (username) {
            this.socketService.send(GAME_EVENTS.GET_CHALLENGE_HISTORY, { username });
        }
    }

    clearActiveChallenge(): void {
        this.activeChallengeSubject.next(null);
        this.challengeResultSubject.next(null);
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((sub) => sub.unsubscribe());
    }

    private setupListeners(): void {
        this.subscriptions.push(
            this.socketService.on<PlayerChallenge>(GAME_EVENTS.CHALLENGE_ASSIGNED).subscribe((challenge) => {
                this.activeChallengeSubject.next(challenge);
                this.challengeResultSubject.next(null);
            }),
        );

        this.subscriptions.push(
            this.socketService.on<PlayerChallenge>(GAME_EVENTS.CHALLENGE_RESULT).subscribe((result) => {
                this.challengeResultSubject.next(result);
                if (result.completed) {
                    this.loadChallengeHistory();
                }
            }),
        );

        this.subscriptions.push(
            this.socketService.on<ChallengeRecord[]>(GAME_EVENTS.CHALLENGE_HISTORY).subscribe((history) => {
                this.challengeHistorySubject.next(history);
            }),
        );
    }
}
