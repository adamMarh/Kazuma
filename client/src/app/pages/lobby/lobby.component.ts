import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatRoomComponent } from '@app/components/chatroom/chatroom.component';
import { ErrorPopupComponent } from '@app/components/error-popup/error-popup.component';
import { FriendListComponent } from '@app/components/friend-list/friend-list.component';
import { QrCodeComponent } from '@app/components/qr-code/qr-code.component';
import { FriendService } from '@app/services/friend/friend.service';
import { GameService } from '@app/services/game/game.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { LobbySocketService } from '@app/services/sockets/lobby-socket/lobby-socket.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { Game } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { LOBBY_EVENTS } from '@common/socket-events/lobby.events';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-lobby',
    templateUrl: './lobby.component.html',
    styleUrls: ['./lobby.component.scss'],
    imports: [CommonModule, FormsModule, ErrorPopupComponent, ChatRoomComponent, TranslatePipe, QrCodeComponent, FriendListComponent],
})
export class GameLobbyComponent implements OnInit, OnDestroy {
    game: Game | null = null;
    players: Player[] | null = null;
    myPlayer: Player | null = null;
    gameId: string = '';

    currentSocketId: string | null = '';
    subscriptions: Subscription[] = [];
    errorShouldRedirect: boolean = false;

    errorPopupMessage: string = '';
    errorPopupVisible: boolean = false;
    showReconnectButton: boolean = false;
    isAgressive: boolean = true;

    isStartingGame: boolean = false;
    stayOrLeaveVisible = false;
    stayOrLeaveGameId = '';
    stayOrLeaveBlockedUsername = '';

    private socketService = inject(SocketService);
    private lobbySocketService = inject(LobbySocketService);
    private router = inject(Router);
    private gameService = inject(GameService);
    private friendService = inject(FriendService);

    ngOnInit(): void {
        this.gameService.gameInstance$.subscribe((gameInstance) => {
            this.game = gameInstance;
            if (gameInstance && gameInstance.gameId) {
                this.gameId = gameInstance.gameId;
            }
        });
        this.gameService.players$.subscribe((players) => {
            this.players = players;
        });
        this.gameService.myPlayer$.subscribe((myPlayer) => {
            this.myPlayer = myPlayer;
        });
        this.subscribeToLobbyUpdates();
        this.subscribeToGameStart();
        this.subscribeToError();
        const stayOrLeaveSub = this.friendService.lobbyBlockStayOrLeave$.subscribe((data) => {
            this.stayOrLeaveGameId = data.gameId;
            this.stayOrLeaveBlockedUsername = data.blockedUsername;
            this.stayOrLeaveVisible = true;
        });
        this.subscriptions.push(stayOrLeaveSub);
        const forceLockSub = this.lobbySocketService.onForceLockRoom().subscribe((payload: { gameId: string; target: string }) => {
            if (payload.target === 'lobby') return;
        });
        this.subscriptions.push(forceLockSub);
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((sub) => sub.unsubscribe());
        if (!this.isStartingGame && this.game) {
            this.lobbySocketService.quitGame(this.game.gameId).subscribe();
        }
    }

    sortPlayers(): void {
        if (!this.players) return;
        this.players.sort((a, b) => {
            if (a.isAdmin && !b.isAdmin) return -1;
            if (!a.isAdmin && b.isAdmin) return 1;
            return 0;
        });
    }

    subscribeToGameStart(): void {
        const gameStartSub = this.lobbySocketService.onGameStarted().subscribe(() => {
            sessionStorage.setItem('inLiveGame', 'true');
            this.isStartingGame = true;
            this.router.navigate(['/in-game']);
        });
        this.subscriptions.push(gameStartSub);
    }

    subscribeToLobbyUpdates(): void {
        const errorSub = this.socketService.onError().subscribe((data) => {
            this.errorPopupMessage = data.message;
            this.errorPopupVisible = true;
            this.errorShouldRedirect = data.shouldRedirect || false;
        });
        this.subscriptions.push(errorSub);

        const kickSub = this.lobbySocketService.onPlayerKicked().subscribe((data) => {
            this.errorPopupMessage = data.message;
            this.errorPopupVisible = true;
            this.errorShouldRedirect = true;
        });
        this.subscriptions.push(kickSub);

        const cancelSub = this.lobbySocketService.onLobbyCanceled().subscribe((data) => {
            this.errorPopupMessage = data.message;
            this.errorPopupVisible = true;
            this.errorShouldRedirect = true;
        });
        this.subscriptions.push(cancelSub);

        const playerLeftSub = this.lobbySocketService.onPlayerLeft().subscribe(() => {
            this.router.navigate(['/home']);
        });
        this.subscriptions.push(playerLeftSub);
    }

    subscribeToError(): void {
        const errorSub = this.gameService.onError().subscribe((data: { errorMessage: string; shouldRedirect: boolean }) => {
            this.errorPopupVisible = true;
            this.errorPopupMessage = data.errorMessage;
            this.errorShouldRedirect = data.shouldRedirect;
        });
        this.subscriptions.push(errorSub);
    }

    handleErrorPopupClosed(): void {
        this.errorPopupVisible = false;
        if (this.errorShouldRedirect) {
            this.gameService.setGameInstance(null);
            this.lobbySocketService.setGameInstance(null);
            this.gameService.setPlayers([]);
            this.gameService.setMyPlayer(null);
            this.router.navigate(['/home']);
        }
    }

    kickPlayer(targetPlayerId: string): void {
        if (!this.game) return;
        const kickPlayerSub = this.lobbySocketService.kickPlayer(targetPlayerId, this.game.gameId).subscribe();
        this.subscriptions.push(kickPlayerSub);
    }

    addBot(isAgressive: boolean): void {
        if (!this.game) return;
        const addBotSub = this.lobbySocketService.addBot(isAgressive, this.game.gameId).subscribe();
        this.subscriptions.push(addBotSub);
    }

    startGame(): void {
        if (!this.game) return;
        const startGameSub = this.lobbySocketService.startGame(this.game.gameId).subscribe();
        this.subscriptions.push(startGameSub);
    }

    lockRoom(): void {
        if (!this.game) return;
        this.lobbySocketService.lockRoom(this.game.gameId);
    }

    handleStayOrLeave(leave: boolean): void {
        this.stayOrLeaveVisible = false;
        if (leave) {
            this.socketService.send(LOBBY_EVENTS.QUIT_GAME, { gameId: this.stayOrLeaveGameId });
            this.router.navigate(['/home']);
        }
    }

    unlockRoom(): void {
        if (!this.game) return;
        this.lobbySocketService.unlockRoom(this.game.gameId);
    }

    activateDropIn(): void {
        if (!this.game) return;
        this.lobbySocketService.activateDropIn(this.game.gameId);
    }

    deactivateDropIn(): void {
        if (!this.game) return;
        this.lobbySocketService.deactivateDropIn(this.game.gameId);
    }

    activateFastEliminationMode(): void {
        this.lobbySocketService.activateFastEliminationMode(this.game!.gameId);
    }

    deactivateFastEliminationMode(): void {
        this.lobbySocketService.deactivateFastEliminationMode(this.game!.gameId);
    }

    quitGame() {
        if (!this.game) return;
        this.isStartingGame = true; // Use this to prevent ngOnDestroy from firing another quit
        const quitGameSub = this.lobbySocketService.quitGame(this.game.gameId).subscribe({
            next: () => {
                this.router.navigate(['/']);
            },
        });
        this.subscriptions.push(quitGameSub);
    }
}
