import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ChatRoomComponent } from '@app/components/chatroom/chatroom.component';
import { ConfirmationPopupComponent } from '@app/components/confirmation-popup/confirmation-popup.component';
import { EndGameComponent } from '@app/components/end-game/end-game.component';
import { ErrorPopupComponent } from '@app/components/error-popup/error-popup.component';
import { GamelogComponent } from '@app/components/gamelog/gamelog/gamelog.component';
import { InventoryComponent } from '@app/components/inventory/inventory.component';
import { MovementTestComponent } from '@app/components/movement/movement.component';
import { PlayerInfoPanelComponent } from '@app/components/player-info-panel/player-info-panel.component';
import { PlayerListComponent } from '@app/components/player-list/player-list.component';
import { TimerComponent } from '@app/components/timer/timer.component';
import { CombatTestComponent } from '@app/pages/game-combat/game-combat.component';
import { ChallengeService } from '@app/services/challenge/challenge.service';
import { GameService } from '@app/services/game/game.service';
import { GameLogService } from '@app/services/gamelog/gamelog.service';
import { LanguageService } from '@app/services/language/language.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { CombatSocketService } from '@app/services/sockets/combat-socket/combat-socket.service';
import { LobbySocketService } from '@app/services/sockets/lobby-socket/lobby-socket.service';
import { MovementSocketService } from '@app/services/sockets/movement-socket/movement-socket.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { CombatState } from '@common/interfaces/combatState.interface';
import { Game } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/interfaces/position.interface';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-in-game-view',
    imports: [
        TimerComponent,
        PlayerInfoPanelComponent,
        InventoryComponent,
        ChatRoomComponent,
        PlayerListComponent,
        ErrorPopupComponent,
        MovementTestComponent,
        CombatTestComponent,
        CommonModule,
        GamelogComponent,
        EndGameComponent,
        ConfirmationPopupComponent,
        TranslatePipe,
    ],
    templateUrl: './in-game-view.component.html',
    styleUrl: './in-game-view.component.scss',
})
export class InGameViewComponent implements OnInit, OnDestroy {
    socketService = inject(SocketService);
    movementSocketService = inject(MovementSocketService);
    gameService = inject(GameService);
    gameLogService = inject(GameLogService);
    challengeService = inject(ChallengeService);
    languageService = inject(LanguageService);

    selectedTab: string = 'chatroom';
    activeTab: 'chat' | 'journal' = 'chat';
    debugActivation: string = '';
    pressedButton: string = '';
    isAction: boolean = false;
    selectedMap: boolean = false;
    selectedMapSize: number = 10;
    activePlayersCount: number = 0;
    subscriptions: Subscription[] = [];
    myPlayer: Player | null = null;
    diceType: 'D4' | 'D6' = 'D6';
    path: Position[] = [];
    players: Player[] = [];
    inactivePlayers: Player[] = [];
    eliminatedPlayers: Player[] = [];
    gameInstance: Game | null = null;
    errorPopupVisible = false;
    quitConfirmVisible = false;
    quitConfirmMessage = '';
    inCombat: boolean = false;
    combatState: CombatState = {
        attacker: null,
        target: null,
        inCombat: false,
        attackResult: {
            damage: 0,
            attackDiceRoll: 0,
            defenseDiceRoll: 0,
        },
        combatInitiator: null,
        hourglassConsumed: false,
        potionConsumed: false,
    };
    turnAnnouncerVisible: boolean = false;
    turnMessage: string = '';
    gameEndedMessage: string = '';
    errorMessage: string = '';
    shouldRedirect: boolean = false;
    loadStats: boolean = false;
    combatResultMessage: string = '';
    showCombatResultMessage: boolean = false;
    combatResultClass: string = '';
    invalidMovementMessage: string = '';

    private router = inject(Router);
    private lobbySocketService = inject(LobbySocketService);
    private combatSocketService = inject(CombatSocketService);
    private flagAudio: HTMLAudioElement | null = null;
    private wasFlagMusicConditionActive = false;

    get visiblePlayers(): Player[] {
        return this.players.filter((p) => !p.hasLeft);
    }

    get allPlayers(): Player[] {
        return this.players;
    }

    @HostListener('window:beforeunload', ['$event'])
    clearSessionStorage(event: Event): string {
        sessionStorage.removeItem('inLiveGame');
        if (this.gameInstance) {
            this.lobbySocketService.quitGame(this.gameInstance.gameId).subscribe();
        }
        event.preventDefault();
        return this.languageService.translate('inGame.quitConfirmBeforeUnload');
    }

    @HostListener('window:unload')
    handleUnload(): void {
        sessionStorage.removeItem('inLiveGame');
        if (this.gameInstance) {
            this.lobbySocketService.quitGame(this.gameInstance.gameId).subscribe();
        }
    }

    @HostListener('document:keydown', ['$event'])
    buttonDetect(event: KeyboardEvent): void {
        const targetElement = event.target as HTMLElement;
        const tagName = targetElement.tagName;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) {
            return;
        }
        if (event.key === 'd' && this.myPlayer?.isAdmin && this.gameInstance) {
            this.lobbySocketService.toggleDebug(this.gameInstance.gameId);
        }
    }

    ngOnInit(): void {
        if (!sessionStorage.getItem('inLiveGame')) {
            this.router.navigate(['/home']);
        } else {
            this.initializeTranslations();
            this.subscribeToPlayerUpdates();
            this.subscribeToDebug();
            this.subscribeToCombatStarted();
            this.subscribeToCombatEnded();
            this.subscribeToPreTimerStart();
            this.subscribeToPreTimerTick();
            this.subscribeToTurnTimerStart();
            this.subscribeToError();
            this.subscribeToDoorAction();
        }
    }

    subscribeToCombatStarted(): void {
        const combatSub = this.combatSocketService.onCombatStarted().subscribe((data: { combatState: CombatState }) => {
            this.combatState = data.combatState;
            if (this.gameInstance?.fastEliminationActive) {
                this.gameInstance?.eliminatedPlayers.forEach((p) => {
                    if (p.socketId === this.myPlayer?.socketId) {
                        this.gameService.inCombat = true;
                    }
                });
            }
            if (this.combatState.attacker?.socketId === this.myPlayer?.socketId || this.combatState.target?.socketId === this.myPlayer?.socketId) {
                this.gameService.inCombat = true;
                if (this.gameInstance) {
                    this.combatSocketService.startTimer(this.gameInstance.ended, this.gameInstance.gameId).subscribe();
                    if (this.combatState.attacker?.isBot && this.combatState.target?.socketId && this.gameInstance?.gameId) {
                        setTimeout(() => {
                            if (this.combatState.target && this.gameInstance) {
                                this.combatSocketService.attackOpponent(this.combatState.target.socketId, this.gameInstance.gameId).subscribe();
                            }
                        }, 3000);
                    }
                }
            }
        });
        this.subscriptions.push(combatSub);
    }

    subscribeToCombatEnded(): void {
        const combatEndedSub = this.combatSocketService
            .onCombatEnded()
            .subscribe((data: { combatState: CombatState; reason: string; actionPlayer: Player; gameEnded: boolean }) => {
                this.isAction = false;
                this.combatState = data.combatState;
                this.combatResultMessage = '';
                this.showCombatResultMessage = true;

                if (data.reason === 'death') {
                    const won = data.actionPlayer.socketId === this.myPlayer?.socketId;
                    this.combatResultMessage = won
                        ? this.languageService.translate('inGame.combatWonByMe')
                        : this.languageService.translate('inGame.combatWonByPlayer', { playerName: data.actionPlayer.name });
                    this.combatResultClass = won ? 'combat-result-win' : 'combat-result-loss';
                } else if (data.reason === 'fled') {
                    const fled = data.actionPlayer.socketId === this.myPlayer?.socketId;
                    this.combatResultMessage = fled
                        ? this.languageService.translate('inGame.fledByMe')
                        : this.languageService.translate('inGame.fledByPlayer', { playerName: data.actionPlayer.name });
                    this.combatResultClass = 'combat-result-flee';
                }
                setTimeout(() => {
                    this.showCombatResultMessage = false;
                    this.combatResultMessage = '';
                    this.combatResultClass = '';
                }, 3000);
            });

        this.subscriptions.push(combatEndedSub);
    }

    toggleActionButton(): void {
        this.isAction = !this.isAction;
    }

    subscribeToPreTimerStart(): void {
        const preStartSub = this.gameService.onPreTimerStart().subscribe(() => {
            this.turnAnnouncerVisible = true;
            this.isAction = false;
            this.generateTurnMessage();
        });
        this.subscriptions.push(preStartSub);
    }

    subscribeToPreTimerTick(): void {
        const preTickSub = this.gameService.onPreTimerTick().subscribe();
        this.subscriptions.push(preTickSub);
    }

    subscribeToTurnTimerStart(): void {
        const turnStartSub = this.gameService.onTurnTimerStart().subscribe(() => {
            this.turnAnnouncerVisible = false;
        });
        this.subscriptions.push(turnStartSub);
    }

    subscribeToDebug(): void {
        const debugSub = this.lobbySocketService.onDebug().subscribe((data: { message: string; gameDebug: boolean }) => {
            this.debugActivation = data.message;
            if (!this.gameInstance?.isInDebugMode) {
                setTimeout(() => (this.debugActivation = ''), 2000);
            }
        });
        this.subscriptions.push(debugSub);
    }

    subscribeToError(): void {
        const errorSub = this.gameService.onError().subscribe((data: { errorMessage: string; shouldRedirect: boolean }) => {
            this.errorPopupVisible = true;
            this.errorMessage = data.errorMessage;
            this.shouldRedirect = data.shouldRedirect;

            if (this.shouldRedirect) {
                setTimeout(() => {
                    this.errorPopupVisible = false;
                    this.gameLogService.resetLogs();
                    this.router.navigate(['/home']);
                }, 3000);
            }
        });
        this.subscriptions.push(errorSub);
    }

    subscribeToDoorAction(): void {
        const doorOpen = this.gameService.onDoorOpen().subscribe(() => {
            this.isAction = false;
        });
        this.subscriptions.push(doorOpen);
    }

    subscribeToPlayerUpdates(): void {
        this.gameService.myPlayer$.subscribe((myPlayer: Player | null) => {
            this.myPlayer = myPlayer;
            this.updateFlagMusicState();
        });
        this.gameService.players$.subscribe((players) => {
            this.players = players ?? [];
            this.updateFlagMusicState();
        });
        this.gameService.inactivePlayers$.subscribe((inactivePlayers) => {
            this.inactivePlayers = inactivePlayers ?? [];
        });
        this.gameService.eliminatedPlayers$.subscribe((eliminatedPlayers) => {
            this.eliminatedPlayers = eliminatedPlayers!;
        });
        this.gameService.gameInstance$.subscribe((game) => {
            this.gameInstance = game;
            if (game) {
                this.selectedMapSize = parseInt(game.map.size, 10);
                this.activePlayersCount = game.players.length;
            }
            if (this.gameInstance?.ended) {
                this.stopFlagMusic();
                this.generateGameEndedMessage();
                setTimeout(() => {
                    this.gameEndedMessage = '';
                    if (this.gameInstance?.ended) {
                        const gameId = this.gameInstance.gameId;
                        this.gameLogService.resetLogs();
                        this.router.navigate(['/end-game'], { state: { gameId } });
                    }
                }, 3000);
            }
            this.updateFlagMusicState();
        });
    }

    generateGameEndedMessage(): void {
        let message = '';
        if (this.gameInstance?.map.gameMode === 'CTF') {
            message =
                this.gameInstance.winner === 'red'
                    ? this.languageService.translate('inGame.redTeamWon')
                    : this.languageService.translate('inGame.blueTeamWon');
        } else {
            let winner;
            const numInactivePlayers = this.gameInstance?.inactivePlayers.length ?? 0;
            if (this.gameInstance?.fastEliminationActive) {
                winner = this.gameInstance?.players.find(
                    (player) => !this.gameInstance?.eliminatedPlayers.some((eliminated) => eliminated.socketId === player.socketId),
                );
            } else if (this.gameInstance?.players.length === numInactivePlayers + 1) {
                winner = this.gameInstance?.players.find((player) => !player.hasLeft);
            } else {
                winner = this.gameInstance?.players.find((player) => player.battlesWon === 3);
            }
            message =
                winner?.socketId === this.myPlayer?.socketId
                    ? this.languageService.translate('inGame.youWonGame')
                    : this.languageService.translate('inGame.playerWonGame', {
                          playerName: winner?.name ?? this.languageService.translate('inGame.defaultPlayerName'),
                      });
        }

        const activePlayers = this.gameInstance?.players.filter((p) => !p.hasLeft).map((p) => p.name) || [];

        const activePlaysersLabel = this.languageService.translate('inGame.activePlayers2');
        const endMessage = `${message} ${activePlaysersLabel} : ${activePlayers.join(', ')}`;

        this.gameEndedMessage = endMessage;

        const timestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false });
        const gameEndLogEntry = {
            timestamp,
            message: endMessage,
            players: activePlayers,
            type: 'game_end',
        };
        this.gameLogService.addLog(gameEndLogEntry);
    }

    generateTurnMessage(): void {
        const currentPlayer = this.gameInstance?.players.find((player) => player.isMyTurn === true && !player.hasLeft);

        if (!currentPlayer) {
            this.turnMessage = '';
            return;
        }
        if (currentPlayer.socketId === this.myPlayer?.socketId) {
            this.turnMessage = this.languageService.translate('inGame.yourTurn');
        } else {
            const translatedMessage = this.languageService.translate('inGame.playerTurn', { playerName: currentPlayer.name });
            this.turnMessage = translatedMessage;
        }
    }

    initializeTranslations(): void {
        this.quitConfirmMessage = this.languageService.translate('inGame.quitConfirmMessage');
        this.invalidMovementMessage = this.languageService.translate('inGame.invalidMovement');
    }

    quitGame(): void {
        this.quitConfirmVisible = true;
    }

    onQuitConfirmed(choice: boolean): void {
        this.quitConfirmVisible = false;
        if (choice && this.gameInstance) {
            this.lobbySocketService.quitGame(this.gameInstance.gameId).subscribe(() => {
                this.gameLogService.resetLogs();
                this.router.navigate(['/home']);
            });
        }
    }

    onErrorPopupClosed(): void {
        this.errorPopupVisible = false;
        if (this.shouldRedirect) {
            this.gameLogService.resetLogs();
            this.router.navigate(['/home']);
        }
    }

    passTurn(): void {
        this.gameService.skipTurn();
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((sub) => sub.unsubscribe());
        this.stopFlagMusic();
        sessionStorage.setItem('inLiveGame', 'false');
    }

    private updateFlagMusicState(): void {
        const shouldPlay = this.shouldPlayFlagMusic();

        if (shouldPlay && !this.wasFlagMusicConditionActive) {
            this.playFlagMusic();
        }

        this.wasFlagMusicConditionActive = shouldPlay;
    }

    private shouldPlayFlagMusic(): boolean {
        if (!this.gameInstance || !this.myPlayer) return false;
        if (this.gameInstance.ended || this.gameInstance.map.gameMode !== 'CTF') return false;

        const flagHolder = this.players.find((player) => player.inventory?.includes('flag'));
        if (!flagHolder) return false;

        const myTeam = this.getPlayerTeam(this.myPlayer.socketId);
        const holderTeam = this.getPlayerTeam(flagHolder.socketId);

        if (myTeam === null || holderTeam === null || myTeam !== holderTeam) return false;

        const teamPlayers = this.players.filter((player) => this.getPlayerTeam(player.socketId) === myTeam && !player.hasLeft);
        const teamHasFlagSoundOption = teamPlayers.some((player) => player.hasFlagMusicOption === true);

        return teamHasFlagSoundOption;
    }

    private getPlayerTeam(socketId: string): 'red' | 'blue' | null {
        if (!this.gameInstance) return null;
        if (this.gameInstance.teams.red.includes(socketId)) return 'red';
        if (this.gameInstance.teams.blue.includes(socketId)) return 'blue';
        return null;
    }

    private playFlagMusic(): void {
        if (this.flagAudio) {
            this.flagAudio.pause();
            this.flagAudio.currentTime = 0;
            this.flagAudio = null;
        }

        this.flagAudio = new Audio('assets/sounds/flag.wav');
        this.flagAudio.loop = false;
        this.flagAudio.volume = 0.35;
        this.flagAudio.onended = () => {
            this.flagAudio = null;
        };
        this.flagAudio.play().catch(() => null);
    }

    private stopFlagMusic(): void {
        if (!this.flagAudio) return;
        this.flagAudio.pause();
        this.flagAudio.currentTime = 0;
        this.flagAudio = null;
    }
}
