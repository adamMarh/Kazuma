import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CharacterFormComponent } from '@app/components/character-form/character-form.component';
import { ErrorPopupComponent } from '@app/components/error-popup/error-popup.component';
import { ALLOWED_ELEMENTS, ALLOWED_NUMBERS } from '@app/constants/join-page';
import { AuthService } from '@app/services/auth/auth.service';
import { CurrencyStoreService } from '@app/services/currency/currency-store.service';
import { FriendService } from '@app/services/friend/friend.service';
import { GameService } from '@app/services/game/game.service';
import { LanguageService } from '@app/services/language/language.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { LobbySocketService } from '@app/services/sockets/lobby-socket/lobby-socket.service';
import { Attribute, AttributeInput } from '@common/interfaces/attribute.interface';
import { Game } from '@common/interfaces/game.interface';
import { Observable, Subscription } from 'rxjs';

@Component({
    standalone: true,
    selector: 'app-join-game-page',
    templateUrl: './join-game-page.component.html',
    styleUrls: ['./join-game-page.component.scss'],
    imports: [FormsModule, RouterLink, CharacterFormComponent, ErrorPopupComponent, AsyncPipe, CommonModule, TranslatePipe],
})
export class JoinGamePageComponent implements OnInit, OnDestroy {
    gameAccessCode: string = '';
    errorMessage: string = '';
    showCharacterForm: boolean = false;
    errorPopupVisible: boolean = false;
    playerName: string = '';
    playerAvatar: number | null = null;
    playerAttributes: unknown = null;
    games: Game[] = [];
    games$: Observable<Game[] | null>;
    blockConflictVisible = false;
    blockConflictGameId = '';
    blockConflictUsers: string[] = [];

    private router = inject(Router);
    private lobbySocketService = inject(LobbySocketService);
    private gameService = inject(GameService);
    private authService = inject(AuthService);
    private currencyStore = inject(CurrencyStoreService);
    private friendService = inject(FriendService);
    private dialogSubscriptions: Subscription[] = [];
    private languageService = inject(LanguageService);

    get myBalance(): number {
        return this.currencyStore.balance;
    }

    isFriendsOnlyBlocked(game: Game): boolean {
        if (!game.friendsOnly || !game.creatorUid) return false;
        const myUid = this.authService.currentUser?.uid;
        if (!myUid) return true;
        if (myUid === game.creatorUid) return false;
        return !this.friendService.friends.some((f) => f.uid === game.creatorUid);
    }

    ngOnInit() {
        this.getGames();
        this.games$ = this.gameService.games$;
        if (!this.currencyStore.isInitialized) {
            this.currencyStore.refresh();
        }
        this.friendService.loadFriends();

        this.dialogSubscriptions.push(
            this.friendService.lobbyBlockConflict$.subscribe((data) => {
                this.blockConflictGameId = data.gameId;
                this.blockConflictUsers = data.conflictUsers;
                this.blockConflictVisible = true;
            }),
        );
    }

    ngOnDestroy(): void {
        this.dialogSubscriptions.forEach((sub) => sub.unsubscribe());
    }

    confirmBlockConflict(confirm: boolean): void {
        this.blockConflictVisible = false;
        if (confirm) {
            this.friendService.confirmLobbyBlockJoin(this.blockConflictGameId);
        }
    }

    allowOnlyNumbers(event: KeyboardEvent) {
        const allowedElements = ALLOWED_ELEMENTS;
        const isAllowed = allowedElements.includes(event.key);
        const isNumber = ALLOWED_NUMBERS.test(event.key);
        if (!isAllowed && !isNumber) {
            event.preventDefault();
        }
    }

    joinGame(accessCode?: string) {
        this.errorMessage = '';
        if (accessCode) {
            this.gameAccessCode = accessCode;
        }
        this.lobbySocketService.checkGameId(this.gameAccessCode, this.authService.currentUser?.uid).subscribe({
            next: (game: Game) => {
                // Check balance before showing character form
                if (game.entryFee && game.entryFee > 0 && this.myBalance < game.entryFee) {
                    this.errorMessage = this.languageService.translate('messages.insufficientFunds', {
                        fee: game.entryFee?.toString() || '0',
                        balance: this.myBalance?.toString() || '0',
                    });
                    this.errorPopupVisible = true;
                    this.gameAccessCode = '';
                    return;
                }
                this.lobbySocketService.setGameInstance(game);
                this.showCharacterForm = true;
            },
            error: (err) => {
                // Map server error messages to translation keys
                let errorKey = 'messages.gameAccessError';
                if (err === 'Code invalide, veuillez essayer à nouveau.') {
                    errorKey = 'messages.invalidCode';
                } else if (err === 'La salle est verrouillée, veuillez essayer à nouveau.') {
                    errorKey = 'messages.lockedRoom';
                } else if (err === 'Le drop-in est inactif, veuillez essayer à nouveau.') {
                    errorKey = 'messages.dropInInactive';
                } else if (err === 'La partie est terminée, il est impossible de la rejoindre.') {
                    errorKey = 'messages.gameEnded';
                }
                this.errorMessage = this.languageService.translate(errorKey);
                this.errorPopupVisible = true;
                this.gameAccessCode = '';
            },
        });
    }

    getGames() {
        this.gameService.getGames().subscribe({
            next: (games: Game[]) => {
                this.games = games;
            },
            error: () => {
                this.errorPopupVisible = true;
                this.errorMessage = this.languageService.translate('messages.gamesRetrievalError');
                this.games = [];
            },
        });
    }

    submitCharacterForm(playerData: { name: string; avatar: number; attributes: AttributeInput[] }) {
        this.playerName = this.authService.currentUsername || '';
        this.playerAvatar = playerData.avatar;

        const attributes = playerData.attributes.reduce(
            (acc: Record<string, Attribute>, attr: AttributeInput) => {
                acc[attr.name] = { value: attr.value, dice: attr.dice };
                return acc;
            },
            {} as Record<string, Attribute>,
        );

        this.gameService.joinGame(this.gameAccessCode, this.playerName, this.playerAvatar, attributes).subscribe({
            next: () => {
                const game = this.games[this.games.findIndex((g) => g.gameId === this.gameAccessCode)];
                if (game && game.started) {
                    this.router.navigate(['/in-game']);
                } else {
                    this.router.navigate(['/waiting-room']);
                }
            },
            error: (err) => {
                this.errorMessage = err.message || this.languageService.translate('messages.joinGameError');
                this.errorPopupVisible = true;
                this.showCharacterForm = false;
            },
        });
    }

    closeCharacterForm() {
        this.showCharacterForm = false;
        this.gameAccessCode = '';
    }
}
