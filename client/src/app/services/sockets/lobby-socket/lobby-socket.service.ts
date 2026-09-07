import { inject, Injectable } from '@angular/core';
import { AuthService } from '@app/services/auth/auth.service';
import { ChatSocketService } from '@app/services/sockets/chatroom-socket/chatroom-socket.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { Game } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { LOBBY_EVENTS } from '@common/socket-events/lobby.events';
import { BehaviorSubject, Observable, tap } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class LobbySocketService {
    private socketService = inject(SocketService);
    private chatService = inject(ChatSocketService);
    private authService = inject(AuthService);
    private gameInstance: Game | null = null;
    private playersSubject = new BehaviorSubject<Player[]>([]);
    public players$ = this.playersSubject.asObservable();

    createGame(name: string, avatar: number, map: any, attributes: any): Observable<Game> {
        return this.socketService.emit<Game>(LOBBY_EVENTS.CREATE_ROOM, { name, avatar, map, attributes }).pipe(
            tap((game: Game) => {
                this.gameInstance = game;
            }),
        );
    }

    joinGame(gameId: string, name: string, avatar: number, attributes: any): Observable<Game> {
        return this.socketService
            .emit<Game>(LOBBY_EVENTS.JOIN_ROOM, { gameId, name, avatar, attributes, uid: this.authService.currentUser?.uid })
            .pipe(
                tap((game: Game) => {
                    this.gameInstance = game;
                }),
            );
    }

    addBot(isAgressive: boolean, gameId: string) {
        return this.socketService.emit(LOBBY_EVENTS.ADD_BOT, { isAgressive, gameId });
    }

    checkGameId(gameId: string, joinerUid?: string): Observable<Game> {
        return this.socketService.emit(LOBBY_EVENTS.CHECK_GAME_ID, { gameId, joinerUid });
    }

    sendPlayerData(gameId: string, name: string, avatar: number, attributes: any): Observable<Game> {
        return this.socketService.emit(LOBBY_EVENTS.JOIN_ROOM, { gameId, name, avatar, attributes, uid: this.authService.currentUser?.uid });
    }

    leavePendingRoom(gameId: string) {
        this.gameInstance = null;
        this.chatService.leaveRoom(gameId).subscribe();
        this.socketService.emit(LOBBY_EVENTS.LEAVE_PENDING, gameId);
    }

    startGame(gameId: string): Observable<any> {
        return this.socketService.emit(LOBBY_EVENTS.START_GAME, { gameId });
    }

    kickPlayer(targetSocketId: string, gameId: string) {
        return this.socketService.emit(LOBBY_EVENTS.KICK_PLAYER, { gameId, targetSocketId });
    }

    onGameStarted(): Observable<any> {
        return this.socketService.on(LOBBY_EVENTS.GAME_STARTED);
    }

    onPlayerKicked(): Observable<{ message: string; shouldRedirect: boolean }> {
        return this.socketService.on(LOBBY_EVENTS.PLAYER_KICKED);
    }

    onLobbyUpdate(): Observable<Game> {
        return this.socketService.on<Game>(LOBBY_EVENTS.UPDATE_LOBBY).pipe(
            tap((game: Game) => {
                this.gameInstance = game;
                this.playersSubject.next(game.players);
            }),
        );
    }

    selectAvatar(gameId: string, avatar: number | null): Observable<any> {
        return this.socketService.emit(LOBBY_EVENTS.SELECT_AVATAR, { gameId, avatar });
    }

    deselectAvatar(gameId: string): Observable<any> {
        return this.socketService.emit(LOBBY_EVENTS.DESELECT_AVATAR, { gameId });
    }

    onLobbyCanceled(): Observable<any> {
        return this.socketService.on(LOBBY_EVENTS.CANCEL_LOBBY);
    }

    getGameInstance(): any {
        return this.gameInstance;
    }

    setGameInstance(game: Game | null): void {
        this.gameInstance = game;
    }

    getGameId(): string | null {
        return this.gameInstance ? this.gameInstance.gameId : null;
    }

    onPlayerLeft(): Observable<any> {
        return this.socketService.on(LOBBY_EVENTS.PLAYER_LEFT);
    }

    onForceLockRoom(): Observable<any> {
        return this.socketService.on(LOBBY_EVENTS.FORCE_LOCK_ROOM);
    }

    lockRoom(gameId: string) {
        this.socketService.emit(LOBBY_EVENTS.LOCK_ROOM, { gameId }).subscribe();
    }

    unlockRoom(gameId: string) {
        this.socketService.emit(LOBBY_EVENTS.UNLOCK_ROOM, { gameId }).subscribe();
    }

    activateDropIn(gameId: string) {
        this.socketService.emit(LOBBY_EVENTS.ACTIVATE_DROP_IN, { gameId }).subscribe();
    }

    deactivateDropIn(gameId: string) {
        this.socketService.emit(LOBBY_EVENTS.DEACTIVATE_DROP_IN, { gameId }).subscribe();
    }

    activateFastEliminationMode(gameId: string) {
        this.socketService.emit(LOBBY_EVENTS.ACTIVATE_FAST_ELIMINATION, { gameId }).subscribe();
    }

    deactivateFastEliminationMode(gameId: string) {
        this.socketService.emit(LOBBY_EVENTS.DEACTIVATE_FAST_ELIMINATION, { gameId }).subscribe();
    }

    quitGame(gameId: string): Observable<void> {
        this.gameInstance = null;
        this.chatService.leaveRoom(gameId).subscribe();
        return this.socketService.emit<void>(LOBBY_EVENTS.QUIT_GAME, { gameId, uid: this.authService.currentUser?.uid });
    }

    toggleDebug(gameId: string) {
        return this.socketService.emit(GAME_EVENTS.DEBUG, { gameId }).subscribe();
    }

    onDebug(): Observable<any> {
        return this.socketService.on(GAME_EVENTS.DEBUG);
    }
}
