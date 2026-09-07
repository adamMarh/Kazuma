/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CORRECT_TIME } from '@app/constants/combat';
import { GameService } from '@app/services/game/game.service';
import { CombatSocketService } from '@app/services/sockets/combat-socket/combat-socket.service';
import { MovementSocketService } from '@app/services/sockets/movement-socket/movement-socket.service';
import { Game } from '@common/interfaces/game.interface';
import { Subject, of } from 'rxjs';
import { TimerComponent } from './timer.component';

describe('TimerComponent', () => {
    let component: TimerComponent;
    let fixture: ComponentFixture<TimerComponent>;

    let gameSubject: Subject<Game>;
    let turnTimerStartSubject: Subject<{ secondsRemaining: number }>;
    let turnTimerTickSubject: Subject<{ secondsRemaining: number }>;
    let timerValueSubject: Subject<{ timerStarted: boolean; timerPaused: boolean; delay: number }>;

    const dummyGame: Game = { gameId: 'dummyGame' } as Game;

    let mockGameService: Partial<GameService>;
    let mockCombatSocketService: Partial<CombatSocketService>;
    let mockMovementSocketService: Partial<MovementSocketService>;
    let _mockTime: number;

    beforeEach(async () => {
        gameSubject = new Subject<Game>();
        turnTimerStartSubject = new Subject<{ secondsRemaining: number }>();
        turnTimerTickSubject = new Subject<{ secondsRemaining: number }>();
        timerValueSubject = new Subject<{ timerStarted: boolean; timerPaused: boolean; delay: number }>();

        mockGameService = {
            gameInstance$: gameSubject.asObservable(),
            onTurnTimerStart: () => turnTimerStartSubject.asObservable(),
            onTurnTimerTick: () => turnTimerTickSubject.asObservable(),
        };
        _mockTime = 100;
        mockCombatSocketService = {
            getTimerValue: jasmine.createSpy('getTimerValue').and.returnValue(timerValueSubject.asObservable()),
            combatCountdown: jasmine.createSpy('combatCountdown').and.returnValue(of(null)),
            pause: jasmine.createSpy('pause'),
            get time() {
                return _mockTime;
            },
        };

        _mockTime = 100;

        mockMovementSocketService = {} as MovementSocketService;

        await TestBed.configureTestingModule({
            imports: [TimerComponent],
            providers: [
                { provide: GameService, useValue: mockGameService },
                { provide: CombatSocketService, useValue: mockCombatSocketService },
                { provide: MovementSocketService, useValue: mockMovementSocketService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(TimerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });
    it('should return true from shouldBlink when inCombat is true and time <= 3', () => {
        (mockGameService as any).inCombat = true;
        Object.defineProperty(component.combatSocketService, 'time', { get: () => 2 });
        expect(component.shouldBlink()).toBeTrue();
    });

    it('should initialize with turnTime equal to CORRECT_TIME', () => {
        expect(component.turnTime).toBe(CORRECT_TIME);
    });

    it('should subscribe to gameInstance$ and update gameInstance accordingly', () => {
        gameSubject.next(dummyGame);
        expect(component.gameInstance).toBe(dummyGame);
    });

    it('should set turnTime to 30 when onTurnTimerStart emits', () => {
        turnTimerStartSubject.next({ secondsRemaining: 30 });
        expect(component.turnTime).toBe(30);
    });

    it('should update turnTime when onTurnTimerTick emits a tick event', () => {
        const tickPayload = { secondsRemaining: 15 };
        turnTimerTickSubject.next(tickPayload);
        expect(component.turnTime).toBe(15);
    });

    it('should handle combat timer start: call combatCountdown and set inCombat to true when timerStarted is true and gameInstance exists', () => {
        component.gameInstance = dummyGame;
        timerValueSubject.next({ timerStarted: true, timerPaused: false, delay: 5 });
        expect(component.inCombat).toBeTrue();
        expect(mockCombatSocketService.combatCountdown).toHaveBeenCalledWith(5, dummyGame.gameId);
    });

    it('should handle combat timer pause: call pause and set inCombat to false when timerPaused is true', () => {
        timerValueSubject.next({ timerStarted: false, timerPaused: true, delay: 0 });
        expect(component.inCombat).toBeFalse();
        expect(mockCombatSocketService.pause).toHaveBeenCalled();
    });

    it('should return combatTime from the combatSocketService getter', () => {
        expect(component.combatTime).toBe(100);
    });

    it('should unsubscribe all subscriptions on component destruction', () => {
        component.subscriptions.forEach((sub) => spyOn(sub, 'unsubscribe'));
        component.ngOnDestroy();
        component.subscriptions.forEach((sub) => {
            expect(sub.unsubscribe).toHaveBeenCalled();
        });
    });
});
