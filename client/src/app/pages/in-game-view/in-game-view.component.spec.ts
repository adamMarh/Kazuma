/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-classes-per-file */
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { GameMap } from '@app/interfaces/game-map.interface';
import { GameService } from '@app/services/game/game.service';
import { CombatSocketService } from '@app/services/sockets/combat-socket/combat-socket.service';
import { LobbySocketService } from '@app/services/sockets/lobby-socket/lobby-socket.service';
import { MovementSocketService } from '@app/services/sockets/movement-socket/movement-socket.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { CombatState } from '@common/interfaces/combatState.interface';
import { Game } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { of, Subject } from 'rxjs';
import { InGameViewComponent } from './in-game-view.component';

class DummyGridService {}
class DummyMapService {}

const createFakeGame = (ended = false): Game => ({
    gameId: ended ? 'g-end' : 'g1',
    players: [{ socketId: 'p1', name: 'Tester' } as Player],
    inactivePlayers: [],
    map: {
        name: '',
        gameMode: 'classic',
        description: '',
        lastSave: new Date(),
        tiles: [],
        size: '',
        imageUrl: '',
        hidden: false,
        items: [],
        nbCheckpoints: '',
        nbRandomItems: '',
    },
    dropInActive: false,
    isLocked: false,
    started: true,
    ended,
    maxPlayers: 4,
    startTime: new Date(),
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
});

@Component({
    selector: 'app-movement-test',
    template: '',
})
export class DummyMovementTestComponent {}

describe('InGameViewComponent', () => {
    let component: InGameViewComponent;
    let fixture: ComponentFixture<InGameViewComponent>;
    let routerSpy: jasmine.SpyObj<Router>;

    const socketServiceSpy = jasmine.createSpyObj('SocketService', ['on', 'emit', 'getSocketId']);
    socketServiceSpy.on.and.returnValue(of());
    socketServiceSpy.getSocketId.and.returnValue('dummySocketId');
    socketServiceSpy.game = { players: [] };

    const movementSocketServiceSpy = jasmine.createSpyObj('MovementSocketService', ['getPossibleMovements', 'move', 'onPossibleMovements']);
    const lobbySocketServiceSpy = jasmine.createSpyObj('LobbySocketService', ['quitGame', 'toggleDebug', 'onDebug']);
    lobbySocketServiceSpy.onDebug.and.returnValue(of({ message: '', gameDebug: false }));

    const dummyGameInstance = {
        ended: false,
        gameId: 'dummyGameId',
        players: [],
        map: { size: '10' },
    };

    const gameServiceSpy = jasmine.createSpyObj(
        'GameService',
        ['onPreTimerStart', 'onPreTimerTick', 'onTurnTimerStart', 'onTurnTimerTick', 'onError', 'skipTurn', 'onDoorOpen'],
        {
            myPlayer$: of(null),
            inactivePlayers$: of([]),
            players$: of([]),
            gameInstance$: of(dummyGameInstance),
            inCombat: false,
        },
    );
    gameServiceSpy.onPreTimerStart.and.returnValue(of({ secondsRemaining: 10 }));
    gameServiceSpy.onPreTimerTick.and.returnValue(of({ secondsRemaining: 10 }));
    gameServiceSpy.onTurnTimerStart.and.returnValue(of({ secondsRemaining: 10 }));
    gameServiceSpy.onTurnTimerTick.and.returnValue(of({ secondsRemaining: 10 }));
    gameServiceSpy.onError.and.returnValue(of({ errorMessage: 'Test error', shouldRedirect: true }));
    gameServiceSpy.skipTurn.and.returnValue(of({}));
    gameServiceSpy.onDoorOpen.and.returnValue(of({}));

    const combatSocketServiceSpy = jasmine.createSpyObj('CombatSocketService', [
        'onCombatStarted',
        'onCombatEnded',
        'startTimer',
        'getTimerValue',
        'attackOpponent',
    ]);
    combatSocketServiceSpy.onCombatStarted.and.returnValue(
        of({
            combatState: {
                attacker: null,
                target: null,
                inCombat: false,
                attackResult: { damage: 0, attackDiceRoll: 0, defenseDiceRoll: 0 },
                combatInitiator: null,
            },
        }),
    );
    combatSocketServiceSpy.onCombatEnded.and.returnValue(
        of({
            combatState: {
                attacker: null,
                target: null,
                inCombat: false,
                attackResult: { damage: 0, attackDiceRoll: 0, defenseDiceRoll: 0 },
                combatInitiator: null,
            },
            reason: 'Test reason',
            actionPlayer: { socketId: 'dummy', name: 'Dummy' } as Player,
            gameEnded: false,
        }),
    );
    combatSocketServiceSpy.startTimer.and.returnValue(of({}));
    combatSocketServiceSpy.getTimerValue.and.returnValue(of(0));

    beforeEach(async () => {
        sessionStorage.setItem('inLiveGame', 'true');
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        await TestBed.configureTestingModule({
            imports: [InGameViewComponent, DummyMovementTestComponent],
            providers: [
                { provide: Router, useValue: routerSpy },
                { provide: SocketService, useValue: socketServiceSpy },
                { provide: MovementSocketService, useValue: movementSocketServiceSpy },
                { provide: LobbySocketService, useValue: lobbySocketServiceSpy },
                { provide: GameService, useValue: gameServiceSpy },
                { provide: CombatSocketService, useValue: combatSocketServiceSpy },
                { provide: 'GridService', useClass: DummyGridService },
                { provide: 'MapService', useClass: DummyMapService },
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting(),
            ],
        }).compileComponents();

        TestBed.overrideComponent(InGameViewComponent, {
            set: {
                imports: [DummyMovementTestComponent],
            },
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(InGameViewComponent);
        component = fixture.componentInstance;
        component.gameInstance = createFakeGame(false);
        fixture.detectChanges();
    });

    afterEach(() => {
        sessionStorage.removeItem('inLiveGame');
    });

    it('should create the component', () => {
        expect(component).toBeTruthy();
    });

    it('should redirect to /home if session is not present', () => {
        sessionStorage.removeItem('inLiveGame');

        const localFixture = TestBed.createComponent(InGameViewComponent);
        const localComponent = localFixture.componentInstance;

        localComponent.ngOnInit();

        expect(routerSpy.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('should display an error popup when onError is triggered', () => {
        expect(component.errorPopupVisible).toBeTrue();
        expect(component.errorMessage).toBe('Test error');
    });

    it('should redirect to /home when error popup is closed and shouldRedirect is true', () => {
        component.onErrorPopupClosed();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/home']);
    });

    describe('clearSessionStorage (beforeunload)', () => {
        beforeEach(() => {
            lobbySocketServiceSpy.quitGame.calls.reset();
        });

        it('should remove sessionStorage and call quitGame if gameInstance exists', () => {
            const mockEvent = new Event('beforeunload');
            spyOn(sessionStorage, 'removeItem');
            const quitSpy = lobbySocketServiceSpy.quitGame.and.returnValue(of(undefined));

            component.gameInstance = { gameId: 'testGame' } as Game;
            const returnValue = component.clearSessionStorage(mockEvent);

            expect(sessionStorage.removeItem).toHaveBeenCalledWith('inLiveGame');
            expect(quitSpy).toHaveBeenCalled();
            expect(returnValue).toBe('Êtes-vous sûr de vouloir quitter la partie ? Vous allez abandonner la partie.');
        });

        it('should not call quitGame if gameInstance is null', () => {
            const mockEvent = new Event('beforeunload');
            spyOn(sessionStorage, 'removeItem');
            component.gameInstance = null;

            const returnValue = component.clearSessionStorage(mockEvent);

            expect(sessionStorage.removeItem).toHaveBeenCalledWith('inLiveGame');
            expect(lobbySocketServiceSpy.quitGame).not.toHaveBeenCalled();
            expect(returnValue).toBe('Êtes-vous sûr de vouloir quitter la partie ? Vous allez abandonner la partie.');
        });
    });

    describe('handleUnload (window:unload)', () => {
        beforeEach(() => {
            lobbySocketServiceSpy.quitGame.calls.reset();
        });

        it('should remove sessionStorage and call quitGame if gameInstance exists', () => {
            const mockEvent = new Event('unload');
            spyOn(sessionStorage, 'removeItem');
            const quitSpy = lobbySocketServiceSpy.quitGame.and.returnValue(of(undefined));

            component.gameInstance = { gameId: 'testGame' } as Game;
            component.handleUnload(mockEvent);

            expect(sessionStorage.removeItem).toHaveBeenCalledWith('inLiveGame');
            expect(quitSpy).toHaveBeenCalled();
        });

        it('should remove sessionStorage but not call quitGame if gameInstance is null', () => {
            const mockEvent = new Event('unload');
            spyOn(sessionStorage, 'removeItem');
            component.gameInstance = null;

            component.handleUnload(mockEvent);

            expect(sessionStorage.removeItem).toHaveBeenCalledWith('inLiveGame');
            expect(lobbySocketServiceSpy.quitGame).not.toHaveBeenCalled();
        });
    });

    describe('buttonDetect (document:keydown)', () => {
        beforeEach(() => {
            lobbySocketServiceSpy.toggleDebug.calls.reset();
        });

        function createKeyboardEvent(key: string, tagName: string = 'BODY'): KeyboardEvent {
            const event = new KeyboardEvent('keydown', { key });
            Object.defineProperty(event, 'target', {
                value: { tagName },
                writable: false,
            });
            return event;
        }

        it('should call toggleDebug if key is "d" and player is admin', () => {
            component.myPlayer = { socketId: '1', isAdmin: true } as Player;
            component.gameInstance = { gameId: 'debug123' } as Game;

            const event = createKeyboardEvent('d');
            component.buttonDetect(event);
            expect(lobbySocketServiceSpy.toggleDebug).toHaveBeenCalledWith('debug123');
        });

        it('should not call toggleDebug if key is not "d"', () => {
            component.myPlayer = { socketId: '1', isAdmin: true } as Player;
            component.gameInstance = { gameId: 'debug123' } as Game;

            const event = createKeyboardEvent('x');
            component.buttonDetect(event);
            expect(lobbySocketServiceSpy.toggleDebug).not.toHaveBeenCalled();
        });

        it('should not call toggleDebug if player is not admin', () => {
            component.myPlayer = { socketId: '1', isAdmin: false } as Player;
            component.gameInstance = { gameId: 'debug123' } as Game;

            const event = createKeyboardEvent('d');
            component.buttonDetect(event);
            expect(lobbySocketServiceSpy.toggleDebug).not.toHaveBeenCalled();
        });

        it('should not call toggleDebug if event target is an input element', () => {
            component.myPlayer = { socketId: '1', isAdmin: true } as Player;
            component.gameInstance = { gameId: 'debug123' } as Game;

            const event = createKeyboardEvent('d', 'INPUT');
            component.buttonDetect(event);
            expect(lobbySocketServiceSpy.toggleDebug).not.toHaveBeenCalled();
        });
    });

    describe('subscribeToCombatEnded', () => {
        let combatEndedSubject: Subject<{ combatState: any; reason: string; actionPlayer: Player; gameEnded: boolean }>;

        beforeEach(() => {
            combatEndedSubject = new Subject();
            combatSocketServiceSpy.onCombatEnded.and.returnValue(combatEndedSubject.asObservable());
        });

        it('should show win message when current player wins the combat (death)', fakeAsync(() => {
            component.myPlayer = { socketId: 'p1', name: 'Moi' } as Player;
            component.subscribeToCombatEnded();
            combatEndedSubject.next({
                combatState: {} as CombatState,
                reason: 'death',
                actionPlayer: { socketId: 'p1', name: 'Moi' } as Player,
                gameEnded: false,
            });
            expect(component.combatResultMessage).toBe('Vous avez gagné le combat !');
            expect(component.combatResultClass).toBe('combat-result-win');
            expect(component.showCombatResultMessage).toBeTrue();
            tick(3000);
            expect(component.combatResultMessage).toBe('');
            expect(component.combatResultClass).toBe('');
            expect(component.showCombatResultMessage).toBeFalse();
        }));

        it('should show loss message when opponent wins the combat (death)', fakeAsync(() => {
            component.myPlayer = { socketId: 'p1', name: 'Moi' } as Player;
            component.subscribeToCombatEnded();
            combatEndedSubject.next({
                combatState: {} as CombatState,
                reason: 'death',
                actionPlayer: { socketId: 'p2', name: 'Enemy' } as Player,
                gameEnded: false,
            });
            expect(component.combatResultMessage).toBe('Enemy a gagné le combat !');
            expect(component.combatResultClass).toBe('combat-result-loss');
            expect(component.showCombatResultMessage).toBeTrue();
            tick(3000);
            expect(component.combatResultMessage).toBe('');
            expect(component.combatResultClass).toBe('');
            expect(component.showCombatResultMessage).toBeFalse();
        }));

        it('should show flee success message when current player fled', fakeAsync(() => {
            component.myPlayer = { socketId: 'p1', name: 'Moi' } as Player;
            component.subscribeToCombatEnded();
            combatEndedSubject.next({
                combatState: {} as CombatState,
                reason: 'fled',
                actionPlayer: { socketId: 'p1', name: 'Moi' } as Player,
                gameEnded: false,
            });
            expect(component.combatResultMessage).toBe('Vous avez fui avec succès !');
            expect(component.combatResultClass).toBe('combat-result-flee');
            expect(component.showCombatResultMessage).toBeTrue();
            tick(3000);
            expect(component.combatResultMessage).toBe('');
            expect(component.combatResultClass).toBe('');
            expect(component.showCombatResultMessage).toBeFalse();
        }));

        it('should show opponent fled message when opponent fled', fakeAsync(() => {
            component.myPlayer = { socketId: 'p1', name: 'Moi' } as Player;
            component.subscribeToCombatEnded();
            combatEndedSubject.next({
                combatState: {} as CombatState,
                reason: 'fled',
                actionPlayer: { socketId: 'p2', name: 'Enemy' } as Player,
                gameEnded: false,
            });
            expect(component.combatResultMessage).toBe('Enemy a fui !');
            expect(component.combatResultClass).toBe('combat-result-flee');
            expect(component.showCombatResultMessage).toBeTrue();
            tick(3000);
            expect(component.combatResultMessage).toBe('');
            expect(component.combatResultClass).toBe('');
            expect(component.showCombatResultMessage).toBeFalse();
        }));
    });

    describe('toggleActionButton', () => {
        it('should toggle isAction from false to true and back', () => {
            component.isAction = false;

            component.toggleActionButton();
            expect(component.isAction).toBeTrue();

            component.toggleActionButton();
            expect(component.isAction).toBeFalse();
        });
    });

    describe('subscribeToPlayerUpdates', () => {
        let myPlayerSubject: Subject<Player | null>;
        let playersSubject: Subject<Player[]>;
        let gameInstanceSubject: Subject<Game>;

        beforeEach(() => {
            myPlayerSubject = new Subject<Player | null>();
            playersSubject = new Subject<Player[]>();
            gameInstanceSubject = new Subject<Game>();

            Object.defineProperty(gameServiceSpy, 'myPlayer$', { get: () => myPlayerSubject.asObservable() });
            Object.defineProperty(gameServiceSpy, 'players$', { get: () => playersSubject.asObservable() });
            Object.defineProperty(gameServiceSpy, 'gameInstance$', { get: () => gameInstanceSubject.asObservable() });

            component.players = [
                { socketId: 'A', name: 'Alice', battlesWon: 0, hasLeft: false } as Player,
                { socketId: 'B', name: 'Bob', battlesWon: 0, hasLeft: false } as Player,
            ];
            component.subscriptions = [];
        });

        it('should update players, detect left players, and build completePlayerList', fakeAsync(() => {
            const playerA: Player = { socketId: 'pA', name: 'Alice' } as Player;
            const playerB: Player = { socketId: 'pB', name: 'Bob', hasLeft: false } as Player;
            component.players = [playerA, playerB];
            component.subscribeToPlayerUpdates();

            playersSubject.next([playerA]);
            tick();

            expect(component.players).toEqual([playerA]);
        }));

        it('should update myPlayer when myPlayer$ emits', fakeAsync(() => {
            const testPlayer: Player = { socketId: 'p1', name: 'Tester' } as Player;
            component.subscribeToPlayerUpdates();

            myPlayerSubject.next(testPlayer);
            tick();

            expect(component.myPlayer).toEqual(testPlayer);
        }));
        it('should update gameInstance and, if ended, call generateGameEndedMessage and navigate after timeout', fakeAsync(() => {
            const endedGame = createFakeGame(true);
            spyOn(component, 'generateGameEndedMessage');

            component.subscribeToPlayerUpdates();

            gameInstanceSubject.next(endedGame);
            tick();

            expect(component.gameInstance).toEqual(endedGame);
            expect(component.generateGameEndedMessage).toHaveBeenCalled();

            tick(3000);
            expect(component.gameEndedMessage).toBe('');
            expect(routerSpy.navigate).toHaveBeenCalledWith(['/end-game'], { state: { gameId: endedGame.gameId } });
        }));

        it('should update myPlayer, players, and gameInstance from observables', fakeAsync(() => {
            const fakePlayer = { socketId: 'p1', name: 'Tester' } as Player;
            const fakePlayers = [fakePlayer];
            const fakeGame = createFakeGame();
            fakeGame.players = fakePlayers;

            Object.defineProperty(gameServiceSpy, 'myPlayer$', { get: () => of(fakePlayer) });
            Object.defineProperty(gameServiceSpy, 'players$', { get: () => of(fakePlayers) });
            Object.defineProperty(gameServiceSpy, 'gameInstance$', { get: () => of(fakeGame) });

            fixture = TestBed.createComponent(InGameViewComponent);
            component = fixture.componentInstance;
            component.gameInstance = fakeGame;
            fixture.detectChanges();

            component.subscribeToPlayerUpdates();
            tick();

            expect(component.myPlayer).toEqual(fakePlayer);
            expect(component.players).toEqual(fakePlayers);
            expect(component.gameInstance).toEqual(fakeGame);
        }));

        it('should not call generateGameEndedMessage or navigate if game is not ended', fakeAsync(() => {
            const myPlayer = { socketId: 'p1', name: 'Player' } as Player;
            const fakePlayers = [myPlayer];
            const activeGame = createFakeGame(false);
            activeGame.players = fakePlayers;

            Object.defineProperty(gameServiceSpy, 'myPlayer$', { get: () => of(myPlayer) });
            Object.defineProperty(gameServiceSpy, 'players$', { get: () => of(fakePlayers) });
            Object.defineProperty(gameServiceSpy, 'gameInstance$', { get: () => of(activeGame) });

            fixture = TestBed.createComponent(InGameViewComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();

            spyOn(component, 'generateGameEndedMessage');

            component.subscribeToPlayerUpdates();
            tick();

            expect(component.generateGameEndedMessage).not.toHaveBeenCalled();
            expect(routerSpy.navigate).not.toHaveBeenCalled();
        }));

        it('should set gameEndedMessage to winner message including player name', () => {
            component.myPlayer = { socketId: 'p1', name: 'Gagnant' } as Player;
            component.gameInstance = {
                players: [{ socketId: 'p1', name: 'Gagnant', battlesWon: 3 } as Player, { socketId: 'p2', name: 'Perdant', battlesWon: 1 } as Player],
                map: {
                    name: 'Test Map',
                    gameMode: 'classic',
                    description: 'A test map for classic mode',
                    lastSave: new Date(),
                    tiles: [],
                    size: '10x10',
                    imageUrl: '',
                    hidden: false,
                    items: [],
                    nbCheckpoints: '',
                    nbRandomItems: '',
                } as GameMap,
            } as Game;

            component.generateGameEndedMessage();

            expect(component.gameEndedMessage).toBe('Félicitation! Vous avez gagné la partie ! Joueurs actifs : Gagnant, Perdant');
        });

        it('should set gameEndedMessage to other player winner name if not myPlayer', () => {
            component.myPlayer = { socketId: 'p2', name: 'Perdant' } as Player;
            component.gameInstance = {
                players: [{ socketId: 'p1', name: 'Gagnant', battlesWon: 3 } as Player, { socketId: 'p2', name: 'Perdant', battlesWon: 1 } as Player],
                map: {
                    name: 'Test Map',
                    gameMode: 'classic',
                    description: 'A test map for classic mode',
                    lastSave: new Date(),
                    tiles: [],
                    size: '10x10',
                    imageUrl: '',
                    hidden: false,
                    items: [],
                    nbCheckpoints: '',
                    nbRandomItems: '',
                } as GameMap,
            } as Game;

            component.generateGameEndedMessage();

            expect(component.gameEndedMessage).toBe('Gagnant a gagné la partie ! Joueurs actifs : Gagnant, Perdant');
        });
    });

    describe('subscribeToPlayerUpdates - branching tests', () => {
        let playersSubject: Subject<Player[]>;
        beforeEach(() => {
            playersSubject = new Subject<Player[]>();
            Object.defineProperty(gameServiceSpy, 'players$', { get: () => playersSubject.asObservable() });
            component.players = [];
        });

        it('devrait extraire les socketId quand players existe', () => {
            component.players = [];

            const players = [{ socketId: 'p1', name: 'Player 1' } as Player, { socketId: 'p2', name: 'Player 2' } as Player];

            component.subscribeToPlayerUpdates();
            playersSubject.next(players);
            expect(component.players).toEqual(players);
        });
    });
    describe('generateGameEndedMessage - activePlayers branching', () => {
        it('devrait filtrer les joueurs ayant quitté et mapper leurs noms', () => {
            component.myPlayer = { socketId: 'p1', name: 'Current' } as Player;
            component.gameInstance = {
                map: { gameMode: 'classic' },
                players: [
                    { socketId: 'p1', name: 'Current', battlesWon: 3, hasLeft: false } as Player,
                    { socketId: 'p2', name: 'LeftPlayer', battlesWon: 0, hasLeft: true } as Player,
                    { socketId: 'p3', name: 'ActivePlayer', battlesWon: 1, hasLeft: false } as Player,
                ],
            } as Game;
            component.generateGameEndedMessage();
            expect(component.gameEndedMessage).toContain('Current');
            expect(component.gameEndedMessage).toContain('ActivePlayer');
            expect(component.gameEndedMessage).not.toContain('LeftPlayer');
        });
    });

    describe('quitting functions', () => {
        it('should show quit confirmation popup when quitGame is called', () => {
            component.quitGame();
            expect(component.quitConfirmVisible).toBeTrue();
        });

        it('should hide quit confirmation popup when onQuitConfirmed is called with false', () => {
            component.quitConfirmVisible = true;
            component.onQuitConfirmed(false);
            expect(component.quitConfirmVisible).toBeFalse();
        });

        it('should call quitGame and navigate to /home when onQuitConfirmed is called with true', () => {
            const quitSpy = lobbySocketServiceSpy.quitGame.and.returnValue(of(undefined));

            component.onQuitConfirmed(true);

            expect(quitSpy).toHaveBeenCalled();
            expect(routerSpy.navigate).toHaveBeenCalledWith(['/home']);
        });
    });

    describe('skipTurn', () => {
        it('should call skipTurn when passTurn is called', () => {
            component.passTurn();
            expect(gameServiceSpy.skipTurn).toHaveBeenCalled();
        });
    });

    describe('generateTurnMessage', () => {
        it('should set turnMessage to empty string if no player has isMyTurn', () => {
            component.myPlayer = { socketId: 'p1', name: 'Moi' } as Player;
            component.gameInstance = {
                players: [{ socketId: 'p1', name: 'Moi', isMyTurn: false } as Player, { socketId: 'p2', name: 'Autre', isMyTurn: false } as Player],
            } as Game;

            component.generateTurnMessage();

            expect(component.turnMessage).toBe('');
        });

        it('should set turnMessage to "C\'est votre tour !" if it is current player\'s turn', () => {
            component.myPlayer = { socketId: 'p1', name: 'Moi' } as Player;
            component.gameInstance = {
                players: [{ socketId: 'p1', name: 'Moi', isMyTurn: true } as Player],
            } as Game;

            component.generateTurnMessage();

            expect(component.turnMessage).toBe("C'est votre tour !");
        });

        it("should set turnMessage to indicate other player's turn", () => {
            component.myPlayer = { socketId: 'p1', name: 'Moi' } as Player;
            component.gameInstance = {
                players: [{ socketId: 'p1', name: 'Moi', isMyTurn: false } as Player, { socketId: 'p2', name: 'Autre', isMyTurn: true } as Player],
            } as Game;

            component.generateTurnMessage();

            expect(component.turnMessage).toBe("C'est le tour de Autre");
        });
    });

    describe('subscribeToCombatStarted', () => {
        let combatStartedSubject: Subject<{ combatState: CombatState }>;

        beforeEach(() => {
            combatStartedSubject = new Subject<{ combatState: CombatState }>();
            combatSocketServiceSpy.onCombatStarted.and.returnValue(combatStartedSubject.asObservable());

            component.subscriptions = [];

            Object.defineProperty(gameServiceSpy, 'inCombat', { value: false, writable: true });

            (combatSocketServiceSpy.startTimer as jasmine.Spy).calls.reset();
            (combatSocketServiceSpy.attackOpponent as jasmine.Spy).calls.reset();
        });

        it('should not call startTimer or attackOpponent if current player is not involved', () => {
            component.myPlayer = { socketId: 'p1' } as Player;
            component.gameInstance = { gameId: 'game1', ended: false } as Game;
            const combatState: CombatState = {
                attacker: { socketId: 'p2' } as Player,
                target: { socketId: 'p3' } as Player,
                inCombat: true,
                attackResult: { damage: 5, attackDiceRoll: 4, defenseDiceRoll: 2 },
                combatInitiator: {} as Player,
                hourglassConsumed: false,
                potionConsumed: false,
            };

            component.subscribeToCombatStarted();
            combatStartedSubject.next({ combatState });

            expect((gameServiceSpy as any).inCombat).toBeFalse();
            expect(combatSocketServiceSpy.startTimer).not.toHaveBeenCalled();
            expect(combatSocketServiceSpy.attackOpponent).not.toHaveBeenCalled();
        });

        it('should set inCombat to true, call startTimer, and call attackOpponent if current player is attacker and isBot is true', fakeAsync(() => {
            component.myPlayer = { socketId: 'p1' } as Player;
            component.gameInstance = { gameId: 'game1', ended: false } as Game;
            const combatState: CombatState = {
                attacker: { socketId: 'p1', isBot: true } as Player,
                target: { socketId: 'p2' } as Player,
                inCombat: true,
                attackResult: { damage: 10, attackDiceRoll: 6, defenseDiceRoll: 3 },
                combatInitiator: {} as Player,
                hourglassConsumed: false,
                potionConsumed: false,
            };

            combatSocketServiceSpy.startTimer.and.returnValue(of({}));
            combatSocketServiceSpy.attackOpponent.and.returnValue(of({}));

            (gameServiceSpy as any).inCombat = false;

            component.subscribeToCombatStarted();
            combatStartedSubject.next({ combatState });

            expect(component.combatState).toEqual(combatState);
            expect((gameServiceSpy as any).inCombat).toBeTrue();
            expect(combatSocketServiceSpy.startTimer).toHaveBeenCalledWith(component.gameInstance.ended, 'game1');
            expect(combatSocketServiceSpy.attackOpponent).not.toHaveBeenCalled();

            tick(3000);
            expect(combatSocketServiceSpy.attackOpponent).toHaveBeenCalledWith('p2', 'game1');
        }));
    });

    describe('generateGameEndedMessage', () => {
        let gameLogServiceSpy: jasmine.SpyObj<any>;

        beforeEach(() => {
            gameLogServiceSpy = jasmine.createSpyObj('GameLogService', ['addLog']);
            component.gameLogService = gameLogServiceSpy;
        });

        it('should generate correct message in CTF mode when winner is "red"', () => {
            component.myPlayer = { socketId: 'pX', name: 'Current' } as Player;
            component.gameInstance = {
                gameId: 'g1',
                players: [
                    { socketId: 'p1', name: 'Alice', battlesWon: 0, hasLeft: false } as Player,
                    { socketId: 'p2', name: 'Bob', battlesWon: 0, hasLeft: false } as Player,
                ],
                inactivePlayers: [],
                map: {
                    _id: 'm1',
                    name: 'CTF Map',
                    gameMode: 'CTF',
                    description: '',
                    lastSave: new Date(),
                    tiles: [],
                    size: '10x10',
                    imageUrl: '',
                    hidden: false,
                    items: [],
                    nbCheckpoints: '',
                    nbRandomItems: '',
                },
                ended: true,
                isLocked: false,
                dropInActive: false,
                started: true,
                maxPlayers: 4,
                startTime: new Date(),
                playerTurns: [],
                currentPlayerIndex: 0,
                startingPoints: [],
                selectedAvatars: {},
                isInDebugMode: false,
                teams: { red: [], blue: [] },
                winner: 'red',
            } as Game;

            component.generateGameEndedMessage();
            expect(component.gameEndedMessage).toBe("L'équipe rouge a gagné ! Joueurs actifs : Alice, Bob");
            expect(gameLogServiceSpy.addLog).toHaveBeenCalled();
        });

        it('should generate correct message in CTF mode when winner is not "red"', () => {
            component.myPlayer = { socketId: 'pX', name: 'Current' } as Player;
            component.gameInstance = {
                gameId: 'g1',
                players: [
                    { socketId: 'p1', name: 'Alice', battlesWon: 0, hasLeft: false } as Player,
                    { socketId: 'p2', name: 'Bob', battlesWon: 0, hasLeft: false } as Player,
                ],
                inactivePlayers: [],
                map: {
                    _id: 'm1',
                    name: 'CTF Map',
                    gameMode: 'CTF',
                    description: '',
                    lastSave: new Date(),
                    tiles: [],
                    size: '10x10',
                    imageUrl: '',
                    hidden: false,
                    items: [],
                    nbCheckpoints: '',
                    nbRandomItems: '',
                },
                ended: true,
                isLocked: false,
                dropInActive: false,
                started: true,
                maxPlayers: 4,
                startTime: new Date(),
                playerTurns: [],
                currentPlayerIndex: 0,
                startingPoints: [],
                selectedAvatars: {},
                isInDebugMode: false,
                teams: { red: [], blue: [] },
                winner: 'blue',
            } as Game;

            component.generateGameEndedMessage();

            expect(component.gameEndedMessage).toBe("L'équipe bleue a gagné ! Joueurs actifs : Alice, Bob");
            expect(gameLogServiceSpy.addLog).toHaveBeenCalled();
        });

        it('should generate correct message in classic mode when current player is the winner', () => {
            const currentPlayer: Player = { socketId: 'p1', name: 'Current', battlesWon: 3, hasLeft: false } as Player;
            const otherPlayer: Player = { socketId: 'p2', name: 'Opponent', battlesWon: 1, hasLeft: false } as Player;
            component.myPlayer = currentPlayer;
            component.gameInstance = {
                gameId: 'g2',
                players: [currentPlayer, otherPlayer],
                inactivePlayers: [],
                map: {
                    _id: 'm2',
                    name: 'Classic Map',
                    gameMode: 'classic',
                    description: '',
                    lastSave: new Date(),
                    tiles: [],
                    size: '10x10',
                    imageUrl: '',
                    hidden: false,
                    items: [],
                    nbCheckpoints: '',
                    nbRandomItems: '',
                },
                ended: true,
                isLocked: false,
                dropInActive: false,
                started: true,
                maxPlayers: 4,
                startTime: new Date(),
                playerTurns: [],
                currentPlayerIndex: 0,
                startingPoints: [],
                selectedAvatars: {},
                isInDebugMode: false,
                teams: { red: [], blue: [] },
                winner: '',
            } as Game;

            component.generateGameEndedMessage();

            expect(component.gameEndedMessage).toBe('Félicitation! Vous avez gagné la partie ! Joueurs actifs : Current, Opponent');
            expect(gameLogServiceSpy.addLog).toHaveBeenCalled();
        });

        it('should generate correct message in classic mode when an opponent is the winner', () => {
            const currentPlayer: Player = { socketId: 'p1', name: 'Current', battlesWon: 1, hasLeft: false } as Player;
            const winnerPlayer: Player = { socketId: 'p2', name: 'Winner', battlesWon: 3, hasLeft: false } as Player;
            component.myPlayer = currentPlayer;
            component.gameInstance = {
                gameId: 'g2',
                players: [currentPlayer, winnerPlayer],
                inactivePlayers: [],
                map: {
                    _id: 'm2',
                    name: 'Classic Map',
                    gameMode: 'classic',
                    description: '',
                    lastSave: new Date(),
                    tiles: [],
                    size: '10x10',
                    imageUrl: '',
                    hidden: false,
                    items: [],
                    nbCheckpoints: '',
                    nbRandomItems: '',
                },
                ended: true,
                isLocked: false,
                dropInActive: false,
                started: true,
                maxPlayers: 4,
                startTime: new Date(),
                playerTurns: [],
                currentPlayerIndex: 0,
                startingPoints: [],
                selectedAvatars: {},
                isInDebugMode: false,
                teams: { red: [], blue: [] },
                winner: '',
            } as Game;

            component.generateGameEndedMessage();

            expect(component.gameEndedMessage).toBe('Winner a gagné la partie ! Joueurs actifs : Current, Winner');
            expect(gameLogServiceSpy.addLog).toHaveBeenCalled();
        });
    });
});
