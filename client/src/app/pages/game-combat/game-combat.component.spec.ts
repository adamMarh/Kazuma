/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines */
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { COMBAT_END_TIMEOUT } from '@app/constants/combat';
import { GameService } from '@app/services/game/game.service';
import { CombatSocketService } from '@app/services/sockets/combat-socket/combat-socket.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { CombatState } from '@common/interfaces/combatState.interface';
import { Game } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { Observable, of, Subject, Subscription } from 'rxjs';

import { CombatTestComponent } from './game-combat.component';

interface TimerValue {
    timerStarted: boolean;
    timerPaused: boolean;
    delay: number;
    targetPlayer: string;
}

interface TestCombatSocketService extends CombatSocketService {
    emitAttacked: (data: { combatState: CombatState }) => void;
    emitTurnChanged: (data: { currentTurn: string }) => void;
    emitCombatEnded: (data: { combatState: CombatState; reason: string; actionPlayer: Player; gameEnded: boolean }) => void;
    emitTimerValue: (value: TimerValue) => void;
}

interface TestGameService extends GameService {
    onTurnTimerStart: () => Observable<{ secondsRemaining: number }>;
    onTurnTimerTick: () => Observable<{ secondsRemaining: number }>;
}

describe('CombatTestComponent', () => {
    let component: CombatTestComponent;
    let fixture: ComponentFixture<CombatTestComponent>;
    let mockCombatSocketService: jasmine.SpyObj<TestCombatSocketService>;
    let mockSocketService: jasmine.SpyObj<SocketService>;
    let mockGameService: jasmine.SpyObj<TestGameService>;
    let turnTimerStartSubject: Subject<{ secondsRemaining: number }>;
    let turnTimerTickSubject: Subject<{ secondsRemaining: number }>;

    const mockPlayer: Player = {
        socketId: '123',
        name: 'Player 1',
        avatar: '1',
        speed: 1,
        defense: 1,
        attack: 1,
        healthpoints: 100,
        position: { x: 0, y: 0 },
        startPosition: { x: 0, y: 0 },
        battlesWon: 0,
        inventory: [],
        isInventoryFull: false,
        dice: { atk: 1, def: 1 },
        isMyTurn: false,
        movementPoints: 1,
        actionPoints: 1,
        fleeAttempts: 0,
    };

    const mockCombatState: CombatState = {
        attacker: mockPlayer,
        target: { ...mockPlayer, socketId: 'player2' },
        inCombat: true,
        attackResult: { damage: 10, attackDiceRoll: 5, defenseDiceRoll: 3 },
        combatInitiator: mockPlayer,
        hourglassConsumed: false,
        potionConsumed: false,
    };

    const mockGame: Game = {
        gameId: 'game123',
        players: [mockPlayer],
        inactivePlayers: [],
        map: {
            name: 'Test Map',
            gameMode: 'Test Mode',
            description: 'Test Description',
            lastSave: new Date(),
            tiles: [],
            size: '10x10',
            imageUrl: '',
            hidden: false,
            items: [],
            nbCheckpoints: '0',
            nbRandomItems: '0',
        },
        isLocked: false,
        dropInActive: false,
        started: false,
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

    beforeEach(async () => {
        turnTimerStartSubject = new Subject<{ secondsRemaining: number }>();
        turnTimerTickSubject = new Subject<{ secondsRemaining: number }>();

        const attackedSubject = new Subject<{ combatState: CombatState }>();
        const turnChangedSubject = new Subject<{ currentTurn: string }>();
        const combatEndedSubject = new Subject<{ combatState: CombatState; reason: string; actionPlayer: Player; gameEnded: boolean }>();
        const timerSubject = new Subject<{ timerStarted: boolean; timerPaused: boolean; delay: number; targetPlayer: Player }>();

        mockCombatSocketService = jasmine.createSpyObj<TestCombatSocketService>('CombatSocketService', [
            'onAttacked',
            'onTurnChanged',
            'onCombatEnded',
            'getTimerValue',
            'attackOpponent',
            'attemptFlee',
            'reset',
            'startTimer',
            'emitAttacked',
            'emitTurnChanged',
            'emitCombatEnded',
            'emitTimerValue',
        ]);

        mockCombatSocketService.onAttacked.and.returnValue(attackedSubject.asObservable());
        mockCombatSocketService.onTurnChanged.and.returnValue(turnChangedSubject.asObservable());
        mockCombatSocketService.onCombatEnded.and.returnValue(combatEndedSubject.asObservable());
        mockCombatSocketService.getTimerValue.and.returnValue(timerSubject.asObservable());
        mockCombatSocketService.attackOpponent.and.returnValue(of({}));
        mockCombatSocketService.attemptFlee.and.returnValue(of({}));
        mockCombatSocketService.startTimer.and.returnValue(of({}));

        mockCombatSocketService.emitAttacked.and.callFake((data) => attackedSubject.next(data));
        mockCombatSocketService.emitTurnChanged.and.callFake((data) => turnChangedSubject.next(data));
        mockCombatSocketService.emitCombatEnded.and.callFake((data) => combatEndedSubject.next(data));
        mockCombatSocketService.emitTimerValue.and.callFake(() =>
            timerSubject.next({ timerStarted: false, timerPaused: false, delay: 30, targetPlayer: mockPlayer }),
        );

        mockSocketService = jasmine.createSpyObj<SocketService>('SocketService', ['getSocketId']);
        mockSocketService.getSocketId.and.returnValue('123');

        mockGameService = jasmine.createSpyObj<TestGameService>(
            'GameService',
            ['onTurnTimerStart', 'onTurnTimerTick', 'onItemDropped', 'onItemEffectApplied'],
            {
                gameInstance$: of(mockGame),
                inCombat: false,
            },
        );

        mockGameService.onTurnTimerStart.and.returnValue(turnTimerStartSubject.asObservable());
        mockGameService.onTurnTimerTick.and.returnValue(turnTimerTickSubject.asObservable());
        mockGameService.onItemDropped = jasmine.createSpy().and.returnValue(of({ item: 'Health Potion', position: { x: 5, y: 5 } }));
        mockGameService.onItemEffectApplied = jasmine.createSpy().and.returnValue(of({ effect: 'Heal', target: mockPlayer }));

        await TestBed.configureTestingModule({
            imports: [CombatTestComponent],
            providers: [
                { provide: CombatSocketService, useValue: mockCombatSocketService },
                { provide: SocketService, useValue: mockSocketService },
                { provide: GameService, useValue: mockGameService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(CombatTestComponent);
        component = fixture.componentInstance;

        component.playersInCombat = [mockPlayer, { ...mockPlayer, socketId: 'player2' }];
        component.combatState = mockCombatState;

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('Timer Handling', () => {
        it('should react to turn timer start', () => {
            const testValue = { secondsRemaining: 10 };
            let receivedValue: unknown;

            component.ngOnInit();
            mockGameService.onTurnTimerStart().subscribe((val) => (receivedValue = val));

            turnTimerStartSubject.next(testValue);
            expect(receivedValue).toEqual(testValue);
        });

        it('should react to turn timer ticks', () => {
            const testValue = { secondsRemaining: 5 };
            component.ngOnInit();

            let receivedValue: unknown;
            mockGameService.onTurnTimerTick().subscribe((val) => (receivedValue = val));

            turnTimerTickSubject.next(testValue);
            expect(receivedValue).toEqual(testValue);
        });
    });

    describe('Initialization', () => {
        it('should initialize with default values', () => {
            expect(component.combatEndMessage).toBe('');
            expect(component.playersInCombat.length).toBe(2);
        });

        it('should subscribe to game instance', () => {
            expect(component.gameInstance).toEqual(mockGame);
        });

        it('should call all subscription methods during ngOnInit', () => {
            const attackSpy = spyOn(component, 'subscribeToPlayerAttacks');
            const turnSpy = spyOn(component, 'subscribeToTurnChanged');
            const combatSpy = spyOn(component, 'subscribeToCombatEnded');
            const gameInstanceSpy = spyOn(mockGameService.gameInstance$, 'subscribe');
            component.ngOnInit();
            expect(attackSpy).toHaveBeenCalled();
            expect(turnSpy).toHaveBeenCalled();
            expect(combatSpy).toHaveBeenCalled();
            expect(gameInstanceSpy).toHaveBeenCalled();
        });
    });

    describe('Attack Handling', () => {
        it('should call attackOpponent with correct parameters', () => {
            component.gameInstance = mockGame;
            component.onAttackOpponent('player2');

            expect(mockCombatSocketService.attackOpponent).toHaveBeenCalledWith('player2', 'game123');
        });
    });

    describe('Turn Handling', () => {
        it('should handle turn changes', () => {
            const turnData = { currentTurn: 'player2' };
            mockCombatSocketService.emitTurnChanged(turnData);

            expect(mockCombatSocketService.reset).toHaveBeenCalled();
            expect(mockCombatSocketService.startTimer).toHaveBeenCalled();
        });
    });

    describe('Combat End', () => {
        it('should handle flee correctly', fakeAsync(() => {
            const endData = {
                combatState: mockCombatState,
                reason: 'fled',
                actionPlayer: mockPlayer,
                gameEnded: false,
            };

            component.combatEndMessage = 'Vous avez fui avec succès !';
            mockCombatSocketService.emitCombatEnded(endData);

            expect(component.combatEndMessage).toBe('Vous avez fui avec succès !');
            expect((mockGameService as Partial<GameService>).inCombat).toBeFalse();

            tick(COMBAT_END_TIMEOUT);
            expect(component.combatEndMessage).toBe('');
        }));

        it('should handle death correctly', fakeAsync(() => {
            const endData = {
                combatState: mockCombatState,
                reason: 'death',
                actionPlayer: mockPlayer,
                gameEnded: true,
            };

            component.combatEndMessage = 'Vous avez gagné le combat !';
            mockCombatSocketService.emitCombatEnded(endData);

            expect(component.combatEndMessage).toContain('gagné');

            tick(COMBAT_END_TIMEOUT);
            expect(component.combatEndMessage).toBe('');
        }));
    });

    describe('Flee Handling', () => {
        it('should call attemptFlee with correct parameters', () => {
            component.gameInstance = mockGame;
            component.onAttemptFlee();

            expect(mockCombatSocketService.attemptFlee).toHaveBeenCalledWith('game123');
        });
    });

    describe('Cleanup', () => {
        it('should unsubscribe on destroy', () => {
            const sub = new Subscription();
            spyOn(sub, 'unsubscribe');
            component.subscriptions = [sub, sub, sub];

            component.ngOnDestroy();

            expect(sub.unsubscribe).toHaveBeenCalledTimes(3);
        });
    });

    describe('subscribeToPlayerAttacks', () => {
        let attackedSubject: Subject<{ combatState: CombatState }>;

        beforeEach(() => {
            attackedSubject = new Subject<{ combatState: CombatState }>();
            mockCombatSocketService.onAttacked.and.returnValue(attackedSubject.asObservable());
        });

        afterEach(() => {
            attackedSubject.complete();
        });

        it('should update combatState when receiving attack data', () => {
            const testData = {
                combatState: {
                    ...mockCombatState,
                    attackResult: { damage: 15, attackDiceRoll: 6, defenseDiceRoll: 2 },
                },
            };

            component.subscribeToPlayerAttacks();
            attackedSubject.next(testData);
            expect(component.combatState).toEqual(testData.combatState);
            expect(component.combatState.attackResult?.damage).toBe(15);
        });
        it('should show slash effect and hide it after 500ms', fakeAsync(() => {
            const testData = {
                combatState: {
                    ...mockCombatState,
                    attacker: { ...mockPlayer, socketId: 'anotherId' },
                    attackResult: { damage: 10, attackDiceRoll: 4, defenseDiceRoll: 2 },
                },
            };

            component.subscribeToPlayerAttacks();

            attackedSubject.next(testData);
            expect(component.showSlashEffect).toBeTrue();
            expect(component.slashOnLeft).toBeTrue();

            tick(499);
            expect(component.showSlashEffect).toBeTrue();

            tick(1);
            expect(component.showSlashEffect).toBeFalse();
        }));

        it('should clear previous timeout if another attack happens before 500ms', fakeAsync(() => {
            const firstAttack = {
                combatState: {
                    ...mockCombatState,
                    attacker: { ...mockPlayer, socketId: 'enemy1' },
                    attackResult: { damage: 8, attackDiceRoll: 5, defenseDiceRoll: 3 },
                },
            };

            const secondAttack = {
                combatState: {
                    ...mockCombatState,
                    attacker: { ...mockPlayer, socketId: 'enemy2' },
                    attackResult: { damage: 12, attackDiceRoll: 6, defenseDiceRoll: 4 },
                },
            };

            component.subscribeToPlayerAttacks();

            attackedSubject.next(firstAttack);
            const firstTimeout = component.slashTimeout;

            expect(component.showSlashEffect).toBeTrue();
            expect(firstTimeout).toBeDefined();

            tick(300);
            attackedSubject.next(secondAttack);

            expect(component.slashTimeout).not.toBe(firstTimeout);

            tick(500);
            expect(component.showSlashEffect).toBeFalse();
        }));
    });

    describe('subscribeToItemEffects', () => {
        let itemEffectSubject: Subject<any>;

        beforeEach(() => {
            itemEffectSubject = new Subject<any>();
            mockGameService.onItemEffectApplied.and.returnValue(itemEffectSubject.asObservable());
            component.ngOnInit();
        });

        afterEach(() => {
            itemEffectSubject.complete();
        });

        it('should show potion message if itemType is "potion" and activated is true for current player', fakeAsync(() => {
            mockSocketService.getSocketId.and.returnValue('player1');
            itemEffectSubject.next({
                playerId: 'player1',
                itemType: 'potion',
                activated: true,
            });

            expect(component.itemMessage).toBe('Votre potion a été activée automatiquement! +3 PV');
            expect(component.itemMessageClass).toBe('potion-message');
            expect(component.showItemMessage).toBeTrue();

            tick(3000);
            expect(component.showItemMessage).toBeFalse();
        }));

        it('should show hourglass message if itemType is "hourglass" and activated is true for current player', fakeAsync(() => {
            mockSocketService.getSocketId.and.returnValue('123');
            itemEffectSubject.next({
                playerId: '123',
                itemType: 'hourglass',
                activated: true,
            });

            expect(component.itemMessage).toBe('Le sablier a été activé! Le combat recommence!');
            expect(component.itemMessageClass).toBe('hourglass-message');
            expect(component.showItemMessage).toBeTrue();

            tick(3000);
            expect(component.showItemMessage).toBeFalse();
        }));

        it('should show crystal message if itemType is "crystal" and activated is true for current player', fakeAsync(() => {
            mockSocketService.getSocketId.and.returnValue('123');
            itemEffectSubject.next({
                playerId: '123',
                itemType: 'crystal',
                activated: true,
            });

            expect(component.itemMessage).toBe('Tu ne peux pas fuir! Ton adversaire possède un cristal!');
            expect(component.itemMessageClass).toBe('crystal-message');
            expect(component.showItemMessage).toBeTrue();

            tick(3000);
            expect(component.showItemMessage).toBeFalse();
        }));

        it('should do nothing if the effect is not activated', fakeAsync(() => {
            component.itemMessage = '';
            component.showItemMessage = false;

            mockSocketService.getSocketId.and.returnValue('123');
            itemEffectSubject.next({
                playerId: '123',
                itemType: 'potion',
                activated: false,
            });

            expect(component.itemMessage).toBe('');
            expect(component.showItemMessage).toBeFalse();
        }));

        it('should do nothing if the effect is for a different player', fakeAsync(() => {
            component.itemMessage = '';
            component.showItemMessage = false;

            mockSocketService.getSocketId.and.returnValue('current-player');
            itemEffectSubject.next({
                playerId: 'some-other-player',
                itemType: 'potion',
                activated: true,
            });

            expect(component.itemMessage).toBe('');
            expect(component.showItemMessage).toBeFalse();
        }));
    });
    describe('getHealthSegments', () => {
        it('should return [] if player is null', () => {
            const result = component.getHealthSegments(null);
            expect(result).toEqual([]);
        });

        it('should return [] if player.healthpoints is undefined', () => {
            const playerWithoutHp = { ...mockPlayer } as any;
            delete playerWithoutHp.healthpoints;

            const result = component.getHealthSegments(playerWithoutHp);
            expect(result).toEqual([]);
        });

        it('should return yellow segments when health is <= 50% but > 30%', () => {
            const player = { ...mockPlayer, healthpoints: 2 };
            (component as any).defaultHp.set(player.socketId, 4);

            const result = component.getHealthSegments(player);

            expect(result.length).toBe(4);
            expect(result.filter((s) => s.filled).length).toBe(2);
            expect(result.filter((s) => s.yellow).length).toBe(2);
            expect(result.filter((s) => s.red).length).toBe(0);
        });
        it('should return red segments when health is <= 30%', () => {
            const player = { ...mockPlayer, healthpoints: 1 };
            (component as any).defaultHp.set(player.socketId, 5);

            const result = component.getHealthSegments(player);

            expect(result.length).toBe(5);
            expect(result.filter((s) => s.filled).length).toBe(1);
            expect(result.filter((s) => s.yellow).length).toBe(1);
            expect(result.filter((s) => s.red).length).toBe(1);
        });

        it('should return empty filled segments when player has 0 healthpoints', () => {
            const player = { ...mockPlayer, healthpoints: 0 };
            (component as any).defaultHp.set(player.socketId, 5);

            const result = component.getHealthSegments(player);

            expect(result.length).toBe(5);
            expect(result.filter((s) => s.filled).length).toBe(0);
            expect(result.filter((s) => s.yellow).length).toBe(0);
            expect(result.filter((s) => s.red).length).toBe(0);
        });
    });
});
