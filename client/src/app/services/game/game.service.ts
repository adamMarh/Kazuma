/* eslint-disable @typescript-eslint/member-ordering */
import { inject, Injectable } from '@angular/core';
import { AuthService } from '@app/services/auth/auth.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { Attribute } from '@common/interfaces/attribute.interface';
import { Game } from '@common/interfaces/game.interface';
import { ItemType } from '@common/interfaces/item.interface';
import { Map } from '@common/interfaces/map.interface';
import { GlobalStats } from '@common/interfaces/player-global-stats';
import { PlayerStats } from '@common/interfaces/player-stats.interface';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/interfaces/position.interface';
import { TileInfo } from '@common/interfaces/tileInfo.interface';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { ITEM_EVENTS } from '@common/socket-events/item.events';
import { LOBBY_EVENTS } from '@common/socket-events/lobby.events';
import { MOVEMENT_EVENTS } from '@common/socket-events/movement.events';
import { BehaviorSubject, Observable, of, switchMap, tap } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class GameService {
    private socketService = inject(SocketService);
    private authService = inject(AuthService);
    private myPlayerSubject = new BehaviorSubject<Player | null>(null);
    private playersSubject = new BehaviorSubject<Player[] | null>(null);
    private inactivePlayersSubject = new BehaviorSubject<Player[] | null>(null);
    private eliminatedPlayersSubject = new BehaviorSubject<Player[] | null>(null);
    private gameInstanceSubject = new BehaviorSubject<Game | null>(null);
    private gameSubject = new BehaviorSubject<Game[] | null>(null);
    private statsSnapshotSubject = new BehaviorSubject<{ playerStats: PlayerStats[]; globalStats: GlobalStats } | null>(null);
    private myPlayer: Player;
    private gameId: string;
    private combatEnded: boolean = false;

    games$ = this.gameSubject.asObservable();
    myPlayer$ = this.myPlayerSubject.asObservable();
    players$ = this.playersSubject.asObservable();
    inactivePlayers$ = this.inactivePlayersSubject.asObservable();
    gameInstance$ = this.gameInstanceSubject.asObservable();
    eliminatedPlayers$ = this.eliminatedPlayersSubject.asObservable();
    statsSnapshot$ = this.statsSnapshotSubject.asObservable();

    constructor() {
        this.onPlayerJoined();
        this.onActionEnded();
        this.onTurnChange();
        this.onChooseItem();
        this.onGamesAltered();
        this.onGameOverStats();
    }

    get inCombat() {
        return this.combatEnded;
    }

    set inCombat(bool: boolean) {
        this.combatEnded = bool;
    }

    createGame(
        name: string,
        avatar: number,
        map: unknown,
        attributes: Record<string, Attribute>,
        entryFee?: number,
        friendsOnly?: boolean,
        creatorUid?: string,
    ): Observable<{ game: Game; myPlayer: Player }> {
        return this.socketService
            .emit<{ game: Game; myPlayer: Player }>(LOBBY_EVENTS.CREATE_ROOM, {
                name,
                avatar,
                map,
                attributes,
                entryFee: entryFee || 0,
                friendsOnly: !!friendsOnly,
                creatorUid: creatorUid || '',
            })
            .pipe(
                tap((payload) => {
                    this.gameInstanceSubject.next(payload.game);
                    this.gameId = payload.game.gameId;
                    this.playersSubject.next(payload.game.players);
                    this.myPlayerSubject.next(payload.myPlayer);
                }),
            );
    }

    joinGame(gameId: string, name: string, avatar: number, attributes: Record<string, Attribute>): Observable<{ game: Game; myPlayer: Player }> {
        sessionStorage.setItem('inLiveGame', 'true');
        return this.socketService
            .emit<{ game: Game; myPlayer: Player }>(LOBBY_EVENTS.JOIN_ROOM, {
                gameId,
                name,
                avatar,
                attributes,
                uid: this.authService.currentUser?.uid,
            })
            .pipe(
                tap((payload) => {
                    this.gameInstanceSubject.next(payload.game);
                    this.gameId = payload.game.gameId;
                    this.playersSubject.next(payload.game.players);
                    this.myPlayerSubject.next(payload.myPlayer);
                }),
            );
    }

    getGames(): Observable<Game[]> {
        return this.socketService.emit<Game[]>(LOBBY_EVENTS.GET_GAMES, {}).pipe(
            tap((games) => {
                this.gameSubject.next(games);
            }),
        );
    }

    onGamesAltered(): void {
        this.socketService.on<Game[]>(LOBBY_EVENTS.UPDATE_GAMES).subscribe((games) => {
            this.gameSubject.next(games);
        });
    }

    onPlayerJoined(): void {
        this.socketService
            .on<Game>(LOBBY_EVENTS.UPDATE_LOBBY)
            .pipe(
                tap((game) => {
                    this.gameInstanceSubject.next(game);
                    this.playersSubject.next(game.players);
                    this.inactivePlayersSubject.next(game.inactivePlayers);
                    const foundPlayer = game.players.find((p) => p.socketId === this.socketService.getSocketId());
                    if (foundPlayer) {
                        this.myPlayer = foundPlayer;
                        this.myPlayerSubject.next(this.myPlayer);
                    }
                    this.eliminatedPlayersSubject.next(game.eliminatedPlayers);
                }),
            )
            .subscribe();
    }

    onDoorOpen(): Observable<Map> {
        return this.socketService.on<Map>(MOVEMENT_EVENTS.DOOR_OPEN);
    }

    onError(): Observable<{ errorMessage: string; shouldRedirect: boolean }> {
        return this.socketService.on<{ errorMessage: string; shouldRedirect: boolean }>(GAME_EVENTS.ON_ERROR);
    }

    getInformation(position: Position, gameId: string): Observable<TileInfo> {
        return this.socketService.emit(GAME_EVENTS.RIGHT_CLICK, { position, gameId, myPlayer: this.myPlayer });
    }

    sendAction(targetPos: Position, isAction: boolean, gameId: string) {
        this.socketService.emit(GAME_EVENTS.LEFT_CLICK, { targetPos, isAction, gameId }).subscribe();
    }

    onActionEnded(): Observable<Position[]> {
        return this.socketService.on<{ player: Player; players: Player[]; path?: Position[] }>(GAME_EVENTS.ACTION_ENDED).pipe(
            tap((payload) => {
                if (payload.path && payload.path.length > 0) {
                    this.animatePlayerMovement(payload.player.socketId, payload.path);
                } else {
                    this.playersSubject.next(payload.players);
                }
                if (payload.player.socketId === this.myPlayer.socketId) {
                    this.myPlayerSubject.next(payload.player);
                }
            }),
            switchMap((payload) => {
                if (this.myPlayer.socketId === payload.player.socketId) {
                    return this.socketService.emit<Position[]>(MOVEMENT_EVENTS.GET_MOVEMENTS, { gameId: this.gameId });
                }
                return of([]);
            }),
        );
    }

    onChooseItem(): Observable<{ item: { position: Position; type: string } }> {
        return this.socketService.on<{ item: { position: Position; type: string } }>(GAME_EVENTS.CHOOSE_ITEM);
    }

    animatePlayerMovement(playerId: string, path: Position[]) {
        const durationPerStep = 150;
        let currentStep = 0;
        const animateStep = () => {
            if (currentStep >= path.length) {
                const finalPlayers = this.playersSubject.getValue();
                if (!finalPlayers) {
                    return;
                }
                const finalUpdatedPlayers = finalPlayers.map((p) => (p.socketId === playerId ? { ...p, position: path[path.length - 1] } : p));
                this.playersSubject.next(finalUpdatedPlayers);
                return;
            }
            const stepPlayers = this.playersSubject.getValue();
            if (!stepPlayers) {
                return;
            }
            const stepUpdatedPlayers = stepPlayers.map((p) => (p.socketId === playerId ? { ...p, position: path[currentStep] } : p));
            this.playersSubject.next(stepUpdatedPlayers);
            currentStep++;
            if (currentStep < path.length) {
                setTimeout(animateStep, durationPerStep);
            }
        };
        animateStep();
    }

    onTurnChange(): void {
        this.socketService
            .on(GAME_EVENTS.PLAYER_TURN_CHANGED)
            .pipe(
                tap((playerId) => {
                    const currentPlayers = this.playersSubject.getValue();
                    if (!currentPlayers) return;

                    const updatedPlayers = currentPlayers.map((p) => ({
                        ...p,
                        isMyTurn: p.socketId === playerId,
                    }));

                    this.playersSubject.next(updatedPlayers);
                    if (playerId === this.myPlayer?.socketId) {
                        this.changeTurn();
                    }
                }),
            )
            .subscribe();
    }

    onGameOverStats(): void {
        this.socketService
            .on<{ playerStats: PlayerStats[]; globalStats: GlobalStats }>(GAME_EVENTS.GAME_OVER_STATS)
            .pipe(
                tap((snapshot) => {
                    this.statsSnapshotSubject.next(snapshot);
                }),
            )
            .subscribe();
    }

    changeTurn() {
        this.socketService.emit(GAME_EVENTS.CLIENT_TURN_RESPONSE, { gameId: this.gameId }).subscribe();
    }

    skipTurn() {
        this.socketService.emit(GAME_EVENTS.SKIP_TURN, { gameId: this.gameId }).subscribe();
    }

    dropItem(item: { position: Position; type: ItemType }) {
        this.socketService.emit(ITEM_EVENTS.ITEM_DROPPED, { position: item.position, itemType: item.type, gameId: this.gameId }).subscribe();
    }

    onItemEffectApplied(): Observable<{ playerId: string; itemType: ItemType; activated?: boolean }> {
        return this.socketService.on<{ playerId: string; itemType: ItemType; activated?: boolean }>(ITEM_EVENTS.ITEM_EFFECT_APPLIED);
    }

    onItemEffectRemoved(): Observable<{ playerId: string; itemType: ItemType }> {
        return this.socketService.on<{ playerId: string; itemType: ItemType }>(ITEM_EVENTS.ITEM_EFFECT_REMOVED);
    }

    onItemDropped(): Observable<{ playerId: string }> {
        return this.socketService.on<{ playerId: string }>(ITEM_EVENTS.ITEM_DROPPED);
    }

    onPreTimerStart(): Observable<{ secondsRemaining: number }> {
        return this.socketService.on(GAME_EVENTS.PRE_TIMER_STARTED);
    }

    onPreTimerTick(): Observable<{ secondsRemaining: number }> {
        return this.socketService.on(GAME_EVENTS.PRE_TIMER_TICK);
    }

    onTurnTimerStart(): Observable<{ secondsRemaining: number }> {
        return this.socketService.on(GAME_EVENTS.TURN_TIMER_STARTED);
    }

    onTurnTimerTick(): Observable<{ secondsRemaining: number }> {
        return this.socketService.on(GAME_EVENTS.TURN_TIMER_TICK);
    }

    setPlayers(players: Player[]): void {
        this.playersSubject.next(players);
    }

    setMyPlayer(player: Player | null): void {
        this.myPlayerSubject.next(player);
    }

    setGameInstance(game: Game | null): void {
        this.gameInstanceSubject.next(game);
    }
}
