import { inject, Injectable } from '@angular/core';
import { LobbySocketService } from '@app/services/sockets/lobby-socket/lobby-socket.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/interfaces/position.interface';
import { TileInfo } from '@common/interfaces/tileInfo.interface';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { MOVEMENT_EVENTS } from '@common/socket-events/movement.events';
import { BehaviorSubject, Observable, tap } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class MovementSocketService {
    private socketService = inject(SocketService);
    private lobbySocketService = inject(LobbySocketService);

    private playersSubject = new BehaviorSubject<Player[]>([]);
    players$ = this.playersSubject.asObservable();

    private myPlayerSubject = new BehaviorSubject<Player | null>(null);
    myPlayer$ = this.myPlayerSubject.asObservable();

    private currentTurn: number = 0;

    constructor() {
        this.players$.subscribe((players) => {
            const socketId = this.socketService.getSocketId();
            if (this.socketService.game && socketId) {
                const myPlayer = players.find((p) => p.socketId === socketId) || null;
                this.myPlayerSubject.next(myPlayer);
            }
        });
    }

    getPossibleMovements(gameId: string): Observable<{ x: number; y: number }[]> {
        return this.socketService.emit(MOVEMENT_EVENTS.GET_MOVEMENTS, { gameId });
    }

    move(targetPos: Position, isRightClick: boolean): Observable<Position[]> {
        return this.socketService.emit<Position[]>(MOVEMENT_EVENTS.PLAYER_MOVED, {
            targetPos,
            gameId: this.lobbySocketService.getGameId(),

            isRightClick,
        });
    }

    onPlayerMoved(): Observable<Player[]> {
        return this.socketService.on<Player[]>(MOVEMENT_EVENTS.PLAYER_MOVED).pipe(
            tap((players: Player[]) => {
                this.playersSubject.next(players);
            }),
        );
    }

    getInformation(targetPos: Position): Observable<TileInfo> {
        return this.socketService.emit(MOVEMENT_EVENTS.INFO, { targetPos, gameId: this.lobbySocketService.getGameId() });
    }

    getShortestPath(targetPos: { x: number; y: number }, gameId: string): Observable<Position[]> {
        return this.socketService.emit(MOVEMENT_EVENTS.GET_PATH, {
            targetPos,
            gameId,
        });
    }

    getCurrentTurn(): number {
        return this.currentTurn;
    }

    onPossibleMovements(): Observable<Position[]> {
        return this.socketService.on<Position[]>(MOVEMENT_EVENTS.GET_MOVEMENTS);
    }

    onMapUpdated(): Observable<any> {
        return this.socketService.on(GAME_EVENTS.MAP_UPDATED);
    }
}
