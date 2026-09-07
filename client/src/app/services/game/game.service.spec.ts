/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines */
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { GameService } from '@app/services/game/game.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { Game } from '@common/interfaces/game.interface';
import { ItemType } from '@common/interfaces/item.interface';
import { Map as GameMap } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/interfaces/position.interface';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { ITEM_EVENTS } from '@common/socket-events/item.events';
import { LOBBY_EVENTS } from '@common/socket-events/lobby.events';
import { MOVEMENT_EVENTS } from '@common/socket-events/movement.events';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';

describe('GameService', () => {
    let service: GameService;
    let socketServiceSpy: jasmine.SpyObj<SocketService>;

    const MOCK_PLAYER: Player = {
        socketId: 'abc123',
        name: 'Léa',
        avatar: 'avatar1',
        speed: 3,
        defense: 2,
        attack: 5,
        healthpoints: 100,
        position: { x: 0, y: 0 },
        startPosition: { x: 0, y: 0 },
        fleeAttempts: 0,
        battlesWon: 0,
        inventory: [],
        dice: { atk: 1, def: 1 },
        isMyTurn: false,
        movementPoints: 0,
        actionPoints: 0,
        isInventoryFull: false,
    };

    const MOCK_GAME: Game = {
        gameId: 'game1',
        players: [MOCK_PLAYER],
        inactivePlayers: [],
        map: { name: 'testMap', hidden: false } as GameMap,
        started: false,
        isLocked: false,
        ended: false,
        maxPlayers: 0,
        playerTurns: [],
        currentPlayerIndex: 0,
        startingPoints: [],
        selectedAvatars: {},
        isInDebugMode: false,
        teams: {
            red: [],
            blue: [],
        },
        winner: '',
    };

    const POSITION_TEST: Position = { x: 5, y: 5 };

    let updateLobbySubject: Subject<Game>;
    let doorOpenSubject: Subject<GameMap>;
    let errorSubject: Subject<{ errorMessage: string; shouldRedirect: boolean }>;
    let actionEndedSubject: Subject<{ player: Player; players: Player[]; path?: Position[] }>;
    let turnChangeSubject: Subject<string>;
    let preTimerStartSubject: Subject<{ secondsRemaining: number }>;
    let preTimerTickSubject: Subject<{ secondsRemaining: number }>;
    let turnTimerStartSubject: Subject<{ secondsRemaining: number }>;
    let turnTimerTickSubject: Subject<{ secondsRemaining: number }>;

    beforeEach(() => {
        socketServiceSpy = jasmine.createSpyObj('SocketService', ['emit', 'on', 'getSocketId']);

        updateLobbySubject = new Subject<Game>();
        doorOpenSubject = new Subject<GameMap>();
        errorSubject = new Subject<{ errorMessage: string; shouldRedirect: boolean }>();
        actionEndedSubject = new Subject<{ player: Player; players: Player[]; path?: Position[] }>();
        turnChangeSubject = new Subject<string>();
        preTimerStartSubject = new Subject<{ secondsRemaining: number }>();
        preTimerTickSubject = new Subject<{ secondsRemaining: number }>();
        turnTimerStartSubject = new Subject<{ secondsRemaining: number }>();
        turnTimerTickSubject = new Subject<{ secondsRemaining: number }>();

        socketServiceSpy.on.and.callFake(<T>(eventName: string): Observable<T> => {
            switch (eventName) {
                case LOBBY_EVENTS.UPDATE_LOBBY:
                    return updateLobbySubject.asObservable() as Observable<T>;
                case MOVEMENT_EVENTS.DOOR_OPEN:
                    return doorOpenSubject.asObservable() as Observable<T>;
                case GAME_EVENTS.ON_ERROR:
                    return errorSubject.asObservable() as Observable<T>;
                case GAME_EVENTS.ACTION_ENDED:
                    return actionEndedSubject.asObservable() as Observable<T>;
                case GAME_EVENTS.PLAYER_TURN_CHANGED:
                    return turnChangeSubject.asObservable() as Observable<T>;
                case GAME_EVENTS.PRE_TIMER_STARTED:
                    return preTimerStartSubject.asObservable() as Observable<T>;
                case GAME_EVENTS.PRE_TIMER_TICK:
                    return preTimerTickSubject.asObservable() as Observable<T>;
                case GAME_EVENTS.TURN_TIMER_STARTED:
                    return turnTimerStartSubject.asObservable() as Observable<T>;
                case GAME_EVENTS.TURN_TIMER_TICK:
                    return turnTimerTickSubject.asObservable() as Observable<T>;
                default:
                    return new Subject<T>().asObservable();
            }
        });

        socketServiceSpy.emit.and.returnValue(of({}));
        socketServiceSpy.getSocketId.and.returnValue('abc123');

        TestBed.configureTestingModule({
            providers: [GameService, { provide: SocketService, useValue: socketServiceSpy }],
        });

        service = TestBed.inject(GameService);
    });

    afterEach(() => {
        updateLobbySubject.complete();
        doorOpenSubject.complete();
        errorSubject.complete();
        actionEndedSubject.complete();
        turnChangeSubject.complete();
        preTimerStartSubject.complete();
        preTimerTickSubject.complete();
        turnTimerStartSubject.complete();
        turnTimerTickSubject.complete();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('Basic Functionality', () => {
        it('should create a game', (done) => {
            socketServiceSpy.emit.and.returnValue(of({ game: MOCK_GAME, myPlayer: MOCK_PLAYER }));
            service.createGame('Léa', 1, {}, {}).subscribe(({ game, myPlayer }) => {
                expect(game).toEqual(MOCK_GAME);
                expect(myPlayer).toEqual(MOCK_PLAYER);
                done();
            });
        });

        it('should join a game', (done) => {
            socketServiceSpy.emit.and.returnValue(of({ game: MOCK_GAME, myPlayer: MOCK_PLAYER }));
            service.joinGame('game1', 'Léa', 1, {}).subscribe(({ game, myPlayer }) => {
                expect(game).toEqual(MOCK_GAME);
                expect(myPlayer).toEqual(MOCK_PLAYER);
                done();
            });
        });
    });

    describe('Player Management', () => {
        it('should handle player joined update', () => {
            service['onPlayerJoined']();
            updateLobbySubject.next(MOCK_GAME);
            service.myPlayer$.subscribe((p) => expect(p).toEqual(MOCK_PLAYER));
        });

        it('should update turn state on turn change', () => {
            service['playersSubject'].next([MOCK_PLAYER]);
            service['myPlayer'] = MOCK_PLAYER;
            service['onTurnChange']();
            turnChangeSubject.next('abc123');
            service.players$.subscribe((players) => expect(players?.[0].isMyTurn).toBeTrue());
        });
    });

    describe('Game Actions', () => {
        it('should return tile info', (done) => {
            service['myPlayer'] = MOCK_PLAYER;
            const mockTileInfo = {
                tileType: 'wall',
                tileCost: '1',
                isActionTile: false,
                description: 'Tile info',
            };
            socketServiceSpy.emit.and.returnValue(of(mockTileInfo));
            service.getInformation(POSITION_TEST, 'game1').subscribe((tile) => {
                expect(tile).toEqual(mockTileInfo);
                done();
            });
        });

        it('should send action', () => {
            socketServiceSpy.emit.and.returnValue(of(null));
            service['gameId'] = 'game1';
            service.sendAction(POSITION_TEST, true, 'game1');
            expect(socketServiceSpy.emit).toHaveBeenCalledWith(GAME_EVENTS.LEFT_CLICK, {
                targetPos: POSITION_TEST,
                isAction: true,
                gameId: 'game1',
            });
        });

        it('should handle action ended with path', (done) => {
            service['myPlayer'] = { ...MOCK_PLAYER, socketId: 'abc123' };
            service['gameId'] = 'game1';

            const path = [POSITION_TEST];
            const updatedPlayer = { ...MOCK_PLAYER, position: POSITION_TEST };
            const payload = { player: updatedPlayer, players: [updatedPlayer], path };

            spyOn(service as GameService, 'animatePlayerMovement').and.callThrough();
            socketServiceSpy.emit.withArgs(MOVEMENT_EVENTS.GET_MOVEMENTS, jasmine.anything()).and.returnValue(of(path));

            service.onActionEnded().subscribe((result) => {
                expect((service as GameService).animatePlayerMovement).toHaveBeenCalledWith('abc123', path);
                expect(result).toEqual(path);
                done();
            });

            actionEndedSubject.next(payload);
        });
    });

    describe('Turn Management', () => {
        it('should call changeTurn()', () => {
            service['gameId'] = 'game1';
            socketServiceSpy.emit.and.returnValue(of(null));
            service.changeTurn();
            expect(socketServiceSpy.emit).toHaveBeenCalledWith(GAME_EVENTS.CLIENT_TURN_RESPONSE, { gameId: 'game1' });
        });

        it('should call skipTurn()', () => {
            service['gameId'] = 'game1';
            socketServiceSpy.emit.and.returnValue(of(null));
            service.skipTurn();
            expect(socketServiceSpy.emit).toHaveBeenCalledWith(GAME_EVENTS.SKIP_TURN, { gameId: 'game1' });
        });
    });

    describe('onTurnChange', () => {
        it('should do nothing if playersSubject.getValue() returns null', fakeAsync(() => {
            service['playersSubject'] = new BehaviorSubject<Player[] | null>(null);
            const turnSubject = new Subject<string>();
            socketServiceSpy.on.and.returnValue(turnSubject.asObservable());

            spyOn(service, 'changeTurn');
            service['myPlayer'] = { socketId: 'myPlayerId' } as Player;

            service.onTurnChange();
            turnSubject.next('somePlayerId');
            tick();

            expect(service['playersSubject'].getValue()).toBeNull();
            expect(service.changeTurn).not.toHaveBeenCalled();
        }));
    });

    describe('Event Handling', () => {
        it('should handle door open', () => {
            const testMap: GameMap = {
                name: 'dungeon',
                hidden: false,
                size: '',
                gameMode: '',
                description: '',
                lastSave: new Date(),
                imageUrl: '',
                tiles: [],
                items: [],
                nbCheckpoints: '',
                nbRandomItems: '',
            };
            service.onDoorOpen().subscribe((res) => expect(res).toEqual(testMap));
            doorOpenSubject.next(testMap);
        });

        it('should handle error event', () => {
            service.onError().subscribe((res) => expect(res.errorMessage).toContain('error'));
            errorSubject.next({ errorMessage: 'error', shouldRedirect: false });
        });

        it('should handle timers', () => {
            service.onPreTimerStart().subscribe((t) => expect(t.secondsRemaining).toBe(10));
            preTimerStartSubject.next({ secondsRemaining: 10 });
        });
    });

    describe('Combat State', () => {
        it('should get/set inCombat', () => {
            service.inCombat = true;
            expect(service.inCombat).toBeTrue();
            service.inCombat = false;
            expect(service.inCombat).toBeFalse();
        });
    });

    describe('Player Movement', () => {
        it('should animate movement (fakeAsync)', fakeAsync(() => {
            const path = [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 2, y: 0 },
            ];
            service['playersSubject'].next([MOCK_PLAYER]);
            service['animatePlayerMovement']('abc123', path);
            tick(150 * 3);
            service.players$.subscribe((players) => {
                expect(players?.[0].position).toEqual({ x: 2, y: 0 });
            });
        }));
    });

    describe('Edge Cases', () => {
        it('should handle undefined gameId in various methods', () => {
            service['gameId'] = '';
            expect(() => {
                service.changeTurn();
                service.skipTurn();
            }).not.toThrow();
        });

        it('should handle undefined myPlayer in action methods', () => {
            service['myPlayer'] = undefined as unknown as Player;
            expect(() => {
                service.getInformation({ x: 0, y: 0 }, 'game1');
                service.onActionEnded().subscribe();
            }).not.toThrow();
        });

        it('should handle null players in animatePlayerMovement', () => {
            service['playersSubject'].next(null);
            expect(() => {
                service['animatePlayerMovement']('player1', [{ x: 1, y: 1 }]);
            }).not.toThrow();
        });
    });

    describe('animatePlayerMovement', () => {
        const initialPlayers: Player[] = [
            {
                socketId: 'player1',
                position: { x: 0, y: 0 },
                name: 'Player 1',
                avatar: '1',
                healthpoints: 100,
            } as Player,
            {
                socketId: 'player2',
                position: { x: 5, y: 5 },
                name: 'Player 2',
                avatar: '2',
                healthpoints: 100,
            } as Player,
        ];

        beforeEach(() => {
            service['playersSubject'] = new BehaviorSubject<Player[] | null>([...initialPlayers]);
            jasmine.clock().install();
        });

        afterEach(() => {
            jasmine.clock().uninstall();
        });

        it('should move player through each path position with correct timing', () => {
            const path = [
                { x: 1, y: 0 },
                { x: 2, y: 0 },
                { x: 3, y: 0 },
            ];

            service['animatePlayerMovement']('player1', path);

            expect(service['playersSubject'].getValue()?.find((p) => p.socketId === 'player1')?.position).toEqual({ x: 1, y: 0 });

            jasmine.clock().tick(150);
            expect(service['playersSubject'].getValue()?.find((p) => p.socketId === 'player1')?.position).toEqual({ x: 2, y: 0 });

            jasmine.clock().tick(150);
            expect(service['playersSubject'].getValue()?.find((p) => p.socketId === 'player1')?.position).toEqual({ x: 3, y: 0 });
        });

        it('should stop animation if players list becomes null', () => {
            const path = [
                { x: 1, y: 0 },
                { x: 2, y: 0 },
            ];
            service['animatePlayerMovement']('player1', path);

            expect(service['playersSubject'].getValue()?.find((p) => p.socketId === 'player1')?.position).toEqual({ x: 1, y: 0 });

            service['playersSubject'].next(null);
            jasmine.clock().tick(150);

            expect(service['playersSubject'].getValue()).toBeNull();
        });

        it('should maintain all player properties except position', () => {
            const path = [{ x: 1, y: 1 }];
            service['animatePlayerMovement']('player1', path);
            jasmine.clock().tick(150);

            const updatedPlayer = service['playersSubject'].getValue()?.find((p) => p.socketId === 'player1');
            expect(updatedPlayer).toBeDefined();
            expect(updatedPlayer?.position).toEqual({ x: 1, y: 1 });
            expect(updatedPlayer?.name).toBe('Player 1');
            expect(updatedPlayer?.avatar).toBe('1');
            expect(updatedPlayer?.healthpoints).toBe(100);
        });

        it('should not modify other players', () => {
            const path = [{ x: 1, y: 1 }];
            service['animatePlayerMovement']('player1', path);
            jasmine.clock().tick(150);

            const players = service['playersSubject'].getValue();
            const unaffected = players?.find((p) => p.socketId === 'player2');
            expect(unaffected?.position).toEqual({ x: 5, y: 5 });
            expect(unaffected?.name).toBe('Player 2');
        });

        it('should do nothing if players list is null when step is complete', () => {
            const path = [{ x: 1, y: 1 }];
            service['playersSubject'] = new BehaviorSubject<Player[] | null>(null);

            expect(() => {
                service['animatePlayerMovement']('player1', path);
            }).not.toThrow();

            expect(service['playersSubject'].getValue()).toBeNull();
        });

        it('should handle single-point path correctly', () => {
            const singlePointPath = [{ x: 10, y: 10 }];

            service['animatePlayerMovement']('player1', singlePointPath);
            jasmine.clock().tick(150);

            const updatedPlayer = service['playersSubject'].getValue()?.find((p) => p.socketId === 'player1');
            expect(updatedPlayer?.position).toEqual({ x: 10, y: 10 });
        });
    });

    describe('animatePlayerMovement - empty path branch', () => {
        it('should update the position of the player to undefined when path is empty', fakeAsync(() => {
            const initialPlayers: Player[] = [
                {
                    socketId: 'player1',
                    name: 'Player 1',
                    avatar: '1',
                    speed: 0,
                    defense: 0,
                    attack: 0,
                    healthpoints: 100,
                    position: { x: 0, y: 0 },
                    battlesWon: 0,
                    inventory: [],
                    isInventoryFull: false,
                    dice: { atk: 0, def: 0 },
                    movementPoints: 0,
                    actionPoints: 0,
                    fleeAttempts: 0,
                    startPosition: { x: 0, y: 0 },
                    isMyTurn: false,
                } as Player,
            ];

            (service as any).playersSubject = new BehaviorSubject<Player[]>(initialPlayers);
            const nextSpy = spyOn((service as any).playersSubject, 'next').and.callThrough();

            service['animatePlayerMovement']('player1', []);
            expect(nextSpy).toHaveBeenCalled();
            const calledWithArg = nextSpy.calls.mostRecent().args[0] as Player[];
            expect(calledWithArg[0].socketId).toBe('player1');
            expect(calledWithArg[0].position).toBeUndefined();
        }));
    });

    describe('animatePlayerMovement - branch when currentPlayers is falsy', () => {
        it('should return immediately if playersSubject returns null in the final branch', fakeAsync(() => {
            service['playersSubject'] = new BehaviorSubject<Player[] | null>(null);
            expect(() => {
                service['animatePlayerMovement']('player1', []);
            }).not.toThrow();
            expect(service['playersSubject'].getValue()).toBeNull();
        }));

        it('should update player position to undefined if path is empty and playersSubject is defined', fakeAsync(() => {
            const initialPlayers: Player[] = [
                {
                    socketId: 'player1',
                    name: 'Player 1',
                    avatar: '1',
                    speed: 0,
                    defense: 0,
                    attack: 0,
                    healthpoints: 100,
                    position: { x: 0, y: 0 },
                    startPosition: { x: 0, y: 0 },
                    battlesWon: 0,
                    inventory: [],
                    isInventoryFull: false,
                    dice: { atk: 0, def: 0 },
                    movementPoints: 0,
                    actionPoints: 0,
                    fleeAttempts: 0,
                    isMyTurn: false,
                } as Player,
            ];
            service['playersSubject'] = new BehaviorSubject<Player[] | null>(initialPlayers);

            service['animatePlayerMovement']('player1', []);
            tick();
            const updatedPlayers = service['playersSubject'].getValue();
            expect(updatedPlayers?.find((p) => p.socketId === 'player1')?.position).toBeUndefined();
        }));
    });

    describe('onActionEnded', () => {
        it('should update players directly if no path is given', (done) => {
            const updatedPlayer = { ...MOCK_PLAYER, position: { x: 2, y: 2 } };
            const payload = { player: updatedPlayer, players: [updatedPlayer] };

            service['myPlayer'] = MOCK_PLAYER;
            service['gameId'] = 'game1';

            const playersSpy = spyOn((service as GameService)['playersSubject'], 'next').and.callThrough();

            service.onActionEnded().subscribe(() => {
                expect(playersSpy).toHaveBeenCalledWith([updatedPlayer]);
                done();
            });

            actionEndedSubject.next(payload);
        });

        it('should NOT fetch movements if player is not myPlayer', (done) => {
            const updatedPlayer = { ...MOCK_PLAYER, socketId: 'other123' };
            const payload = { player: updatedPlayer, players: [updatedPlayer], path: [] };

            service['myPlayer'] = { ...MOCK_PLAYER, socketId: 'abc123' };
            service['gameId'] = 'game1';
            const emitSpy = socketServiceSpy.emit;

            service.onActionEnded().subscribe((res) => {
                expect(res).toEqual([]);
                expect(emitSpy).not.toHaveBeenCalledWith(MOVEMENT_EVENTS.GET_MOVEMENTS, jasmine.anything());
                done();
            });

            actionEndedSubject.next(payload);
        });
    });

    describe('onPreTimerTick', () => {
        it('should emit pre-timer tick events', () => {
            let emittedValue: { secondsRemaining: number } | undefined;
            service.onPreTimerTick().subscribe((val) => {
                emittedValue = val;
            });

            preTimerTickSubject.next({ secondsRemaining: 3 });
            expect(emittedValue?.secondsRemaining).toBe(3);
        });
    });

    describe('Méthodes de gestion des items', () => {
        it('dropItem() should emit ITEM_DROPPED event with correct payload', () => {
            (service as any).gameId = 'game123';

            const item = { position: { x: 2, y: 3 }, type: 'shield' as any /* ou ItemType si défini */ };

            socketServiceSpy.emit.and.returnValue(of({}));

            service.dropItem(item);

            expect(socketServiceSpy.emit).toHaveBeenCalledWith(ITEM_EVENTS.ITEM_DROPPED, {
                position: item.position,
                itemType: item.type,
                gameId: 'game123',
            });
        });

        it('onItemEffectApplied() should return an observable with item effect applied data', (done) => {
            const expectedData = { playerId: 'p1', itemType: 'potion' as ItemType, activated: true };

            socketServiceSpy.on.and.returnValue(of(expectedData));

            service.onItemEffectApplied().subscribe((data) => {
                expect(data).toEqual(expectedData);
                done();
            });
            expect(socketServiceSpy.on).toHaveBeenCalledWith(ITEM_EVENTS.ITEM_EFFECT_APPLIED);
        });

        it('onItemEffectRemoved() should return an observable with item effect removed data', (done) => {
            const expectedData = { playerId: 'p1', itemType: 'hourglass' as ItemType };

            socketServiceSpy.on.and.returnValue(of(expectedData));

            service.onItemEffectRemoved().subscribe((data) => {
                expect(data).toEqual(expectedData);
                done();
            });
            expect(socketServiceSpy.on).toHaveBeenCalledWith(ITEM_EVENTS.ITEM_EFFECT_REMOVED);
        });

        it('onItemDropped() should return an observable with item dropped data', (done) => {
            const expectedData = { playerId: 'p1' };
            socketServiceSpy.on.and.returnValue(of(expectedData));

            service.onItemDropped().subscribe((data) => {
                expect(data).toEqual(expectedData);
                done();
            });
            expect(socketServiceSpy.on).toHaveBeenCalledWith(ITEM_EVENTS.ITEM_DROPPED);
        });
    });

    describe('GameService - Timer and Setters', () => {
        it('onTurnTimerStart() should return observable with secondsRemaining', (done) => {
            const timerData = { secondsRemaining: 15 };
            socketServiceSpy.on.and.returnValue(of(timerData));

            service.onTurnTimerStart().subscribe((data) => {
                expect(data).toEqual(timerData);
                done();
            });
            expect(socketServiceSpy.on).toHaveBeenCalledWith(GAME_EVENTS.TURN_TIMER_STARTED);
        });

        it('onTurnTimerTick() should return observable with secondsRemaining', (done) => {
            const tickData = { secondsRemaining: 5 };
            socketServiceSpy.on.and.returnValue(of(tickData));

            service.onTurnTimerTick().subscribe((data) => {
                expect(data).toEqual(tickData);
                done();
            });
            expect(socketServiceSpy.on).toHaveBeenCalledWith(GAME_EVENTS.TURN_TIMER_TICK);
        });

        it('setPlayers() should push provided players to playersSubject', () => {
            const players: Player[] = [
                {
                    socketId: '1',
                    name: 'Test',
                    avatar: 'defaultAvatar',
                    speed: 0,
                    defense: 0,
                    attack: 0,
                    healthpoints: 100,
                    position: { x: 0, y: 0 },
                    startPosition: { x: 0, y: 0 },
                    battlesWon: 0,
                    inventory: [],
                    isInventoryFull: false,
                    dice: { atk: 0, def: 0 },
                    movementPoints: 0,
                    actionPoints: 0,
                    fleeAttempts: 0,
                    isMyTurn: false,
                } as Player,
            ];

            service.setPlayers(players);

            const currentPlayers = (service as any).playersSubject.getValue();
            expect(currentPlayers).toEqual(players);
        });

        it('setMyPlayer() should push provided player to myPlayerSubject', () => {
            const player: Player = {
                socketId: '1',
                name: 'Test',
                avatar: 'defaultAvatar',
                speed: 0,
                defense: 0,
                attack: 0,
                healthpoints: 100,
                position: { x: 0, y: 0 },
                startPosition: { x: 0, y: 0 },
                battlesWon: 0,
                inventory: [],
                isInventoryFull: false,
                dice: { atk: 0, def: 0 },
                movementPoints: 0,
                actionPoints: 0,
                fleeAttempts: 0,
                isMyTurn: false,
            } as Player;

            service.setMyPlayer(player);

            const currentPlayer = (service as any).myPlayerSubject.getValue();
            expect(currentPlayer).toEqual(player);
        });

        it('setGameInstance() should push provided game instance to gameInstanceSubject', () => {
            service.setGameInstance(MOCK_GAME);

            const currentGame = (service as any).gameInstanceSubject.getValue();
            expect(currentGame).toEqual(MOCK_GAME);

            service.setGameInstance(null);
            const currentGameNull = (service as any).gameInstanceSubject.getValue();
            expect(currentGameNull).toBeNull();
        });
    });

    describe('animatePlayerMovement - final step', () => {
        it('should update only the target player position to the last position in path array', fakeAsync(() => {
            const player1 = {
                socketId: 'player1',
                name: 'Player 1',
                position: { x: 0, y: 0 },
            } as Player;
            const player2 = {
                socketId: 'player2',
                name: 'Player 2',
                position: { x: 10, y: 10 },
            } as Player;
            const initialPlayers = [player1, player2];
            service['playersSubject'] = new BehaviorSubject<Player[] | null>(initialPlayers);
            const nextSpy = spyOn(service['playersSubject'], 'next').and.callThrough();
            const finalPosition = { x: 5, y: 5 };
            const path = [finalPosition];
            service['animatePlayerMovement']('player1', path);
            tick(150);
            expect(nextSpy).toHaveBeenCalled();
            const updatedPlayers = nextSpy.calls.mostRecent().args[0] as Player[];
            const updatedPlayer1 = updatedPlayers.find((p) => p.socketId === 'player1');
            const updatedPlayer2 = updatedPlayers.find((p) => p.socketId === 'player2');
            expect(updatedPlayer1?.position).toEqual(finalPosition);
            expect(updatedPlayer2?.position).toEqual({ x: 10, y: 10 });
        }));
    });

    describe('animatePlayerMovement - specific final mapping', () => {
        it('should update only the matching player when path is completed', () => {
            const finalPosition = { x: 10, y: 10 };
            const path = [finalPosition];
            const playerId = 'player2';
            const mapFn = (p: Player) => (p.socketId === playerId ? { ...p, position: path[path.length - 1] } : p);
            const player1 = { socketId: 'player1', position: { x: 1, y: 1 } } as Player;
            const player2 = { socketId: 'player2', position: { x: 2, y: 2 } } as Player;
            const player1Result = mapFn(player1);
            const player2Result = mapFn(player2);
            expect(player1Result.position).toEqual({ x: 1, y: 1 });
            expect(player2Result.position).toEqual(finalPosition);
        });
    });

    describe('animatePlayerMovement - complete ternary operator coverage', () => {
        it('should handle all branching possibilities in the ternary operator with non-empty path', fakeAsync(() => {
            const matchingPlayer = { socketId: 'match', position: { x: 0, y: 0 } } as Player;
            const nonMatchingPlayer = { socketId: 'nonMatch', position: { x: 5, y: 5 } } as Player;
            const players = [matchingPlayer, nonMatchingPlayer];
            service['playersSubject'] = new BehaviorSubject<Player[] | null>(players);
            const nextSpy = spyOn(service['playersSubject'], 'next').and.callThrough();
            const targetPosition = { x: 10, y: 10 };
            const path = [targetPosition];
            jasmine.clock().install();
            service['animatePlayerMovement']('match', path);
            jasmine.clock().tick(500);
            jasmine.clock().uninstall();
            expect(nextSpy).toHaveBeenCalled();
            const result = nextSpy.calls.mostRecent().args[0] as Player[];
            expect(result.length).toBe(2);
            const updatedMatchingPlayer = result.find((p) => p.socketId === 'match');
            const updatedNonMatchingPlayer = result.find((p) => p.socketId === 'nonMatch');
            expect(updatedMatchingPlayer?.position).toEqual(targetPosition);
            expect(updatedNonMatchingPlayer?.position).toEqual({ x: 5, y: 5 });
        }));

        it('should handle the ternary operator with empty path', fakeAsync(() => {
            const matchingPlayer = { socketId: 'match', position: { x: 1, y: 1 } } as Player;
            const nonMatchingPlayer = { socketId: 'nonMatch', position: { x: 2, y: 2 } } as Player;
            const players = [matchingPlayer, nonMatchingPlayer];
            service['playersSubject'] = new BehaviorSubject<Player[] | null>(players);
            const nextSpy = spyOn(service['playersSubject'], 'next').and.callThrough();
            const emptyPath: Position[] = [];
            jasmine.clock().install();
            service['animatePlayerMovement']('match', emptyPath);
            jasmine.clock().tick(500);
            jasmine.clock().uninstall();
            expect(nextSpy).toHaveBeenCalled();
            const result = nextSpy.calls.mostRecent().args[0] as Player[];
            const updatedMatchingPlayer = result.find((p) => p.socketId === 'match');
            const updatedNonMatchingPlayer = result.find((p) => p.socketId === 'nonMatch');
            expect(updatedMatchingPlayer?.position).toBeUndefined();
            expect(updatedNonMatchingPlayer?.position).toEqual({ x: 2, y: 2 });
        }));
    });
});
