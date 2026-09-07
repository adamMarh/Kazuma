/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { CombatSocketService } from '@app/services/sockets/combat-socket/combat-socket.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/interfaces/position.interface';
import { COMBAT_EVENTS } from '@common/socket-events/combat.events';
import { of, throwError } from 'rxjs';

describe('CombatSocketService', () => {
    let service: CombatSocketService;
    let socketServiceMock: jasmine.SpyObj<SocketService>;

    const GAME_ID = 'game-123';
    const TARGET_PLAYER = 'player-456';

    beforeEach(() => {
        jasmine.getEnv().allowRespy(true);
        socketServiceMock = jasmine.createSpyObj('SocketService', ['on', 'emit', 'getSocketId']);

        TestBed.configureTestingModule({
            providers: [CombatSocketService, { provide: SocketService, useValue: socketServiceMock }],
        });

        service = TestBed.inject(CombatSocketService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('onAttacked should listen to COMBAT_STATE_UPDATE event', () => {
        service.onAttacked();
        expect(socketServiceMock.on).toHaveBeenCalledWith(COMBAT_EVENTS.COMBAT_STATE_UPDATE);
    });

    it('onCombatStarted should listen to COMBAT_STARTED event', () => {
        service.onCombatStarted();
        expect(socketServiceMock.on).toHaveBeenCalledWith(COMBAT_EVENTS.COMBAT_STARTED);
    });

    it('onPlayersInCombat should listen to PLAYERS_IN_COMBAT event', () => {
        service.onPlayersInCombat();
        expect(socketServiceMock.on).toHaveBeenCalledWith(COMBAT_EVENTS.PLAYERS_IN_COMBAT);
    });

    it('onTurnChanged should listen to TURN_CHANGED event', () => {
        service.onTurnChanged();
        expect(socketServiceMock.on).toHaveBeenCalledWith(COMBAT_EVENTS.TURN_CHANGED);
    });

    it('onCombatEnded should listen to COMBAT_ENDED event', () => {
        service.onCombatEnded();
        expect(socketServiceMock.on).toHaveBeenCalledWith(COMBAT_EVENTS.COMBAT_ENDED);
    });

    it('getTimerValue should update targetPlayer and listen to TIMER_STATE', () => {
        socketServiceMock.on.and.returnValue(
            of({
                timerStarted: true,
                timerPaused: false,
                delay: 10,
                targetPlayer: TARGET_PLAYER,
            }),
        );
    });

    it('startTimer should emit START_TIMER if game not ended', () => {
        service.startTimer(false, GAME_ID);
        expect(socketServiceMock.emit).toHaveBeenCalledWith(COMBAT_EVENTS.START_TIMER, { gameId: GAME_ID });
    });

    it('startTimer should return null observable if game ended', (done) => {
        service.startTimer(true, GAME_ID).subscribe((result) => {
            expect(result).toBeNull();
            done();
        });
    });

    it('pauseTimer should emit RESET_TIMER', () => {
        service.pauseTimer(GAME_ID);
        expect(socketServiceMock.emit).toHaveBeenCalledWith(COMBAT_EVENTS.RESET_TIMER, { gameId: GAME_ID });
    });

    it('initCombat should emit INIT_COMBAT with position and gameId', () => {
        const pos: Position = { x: 1, y: 1 };
        service.initCombat(pos, GAME_ID);
        expect(socketServiceMock.emit).toHaveBeenCalledWith(COMBAT_EVENTS.INIT_COMBAT, { gameId: GAME_ID, position: pos });
    });

    it('attackOpponent should emit ATTACK_OPPONENT with gameId and target', () => {
        service.attackOpponent(TARGET_PLAYER, GAME_ID);
        expect(socketServiceMock.emit).toHaveBeenCalledWith(COMBAT_EVENTS.ATTACK_OPPONENT, { gameId: GAME_ID, targetPlayer: TARGET_PLAYER });
    });

    it('attemptFlee should emit ATTEMPT_FLEE', () => {
        service.attemptFlee(GAME_ID);
        expect(socketServiceMock.emit).toHaveBeenCalledWith(COMBAT_EVENTS.ATTEMPT_FLEE, { gameId: GAME_ID });
    });

    it('pause should clear interval and set paused to true', () => {
        (service as any).interval = window.setInterval(() => {}, 1000);
        service.pause();
        expect((service as any).interval).toBeUndefined();
        expect((service as any).paused).toBeTrue();
    });

    it('reset should clear interval and reset time and paused', () => {
        (service as any).interval = window.setInterval(() => {}, 1000);
        (service as any).time = 5;
        (service as any).paused = true;
        service.reset();
        expect((service as any).interval).toBeUndefined();
        expect((service as any).time).toBe(0);
        expect((service as any).paused).toBeFalse();
    });

    describe('combatCountdown', () => {
        const delay = 3;
        const gameId = 'game-123';

        beforeEach(() => {
            spyOn(socketServiceMock, 'getSocketId').and.returnValue('socket-1');
            spyOn(service, 'attackOpponent').and.returnValue(of('attacked'));
        });

        afterEach(() => {
            service.reset();
        });

        it('should emit the initial delay immediately', () => {
            service['targetPlayerId'] = 'other-id';
            const results: number[] = [];

            service.combatCountdown(delay, gameId).subscribe((value) => results.push(value));
            expect(results[0]).toBe(delay);
        });

        it('should emit each second and complete if user is targetPlayer', fakeAsync(() => {
            const emitted: number[] = [];
            service['targetPlayerId'] = 'socket-1';

            service.combatCountdown(2, gameId).subscribe({
                next: (val) => emitted.push(val),
            });
            tick(1000);
            tick(1000);
            expect(emitted).toEqual([2, 1, 0]);
        }));

        it('should attack opponent automatically if user is not targetPlayer', fakeAsync(() => {
            const emitted: number[] = [];
            service['targetPlayerId'] = 'other-id';

            service.combatCountdown(2, gameId).subscribe({
                next: (val) => emitted.push(val),
            });

            tick(2000);
            expect(service.attackOpponent).toHaveBeenCalledWith('other-id', gameId);
            expect(emitted).toEqual([2, 1, 0]);
        }));

        it('should clear an existing interval when starting combatCountdown', () => {
            service['interval'] = 123;
            spyOn(window, 'clearInterval').and.callThrough();

            service.combatCountdown(delay, gameId).subscribe();

            expect(window.clearInterval).toHaveBeenCalledWith(123);
        });

        it('should call observer.error if attackOpponent errors', fakeAsync(() => {
            service['targetPlayerId'] = 'other-id';

            spyOn(service, 'attackOpponent').and.returnValue(throwError(() => new Error('Test error')));

            let errorReceived: any;
            service.combatCountdown(2, gameId).subscribe({
                next: () => {},
                error: (err) => {
                    errorReceived = err;
                },
            });

            tick(2100);

            expect(errorReceived).toBeTruthy();
            expect(errorReceived.message).toBe('Test error');
        }));
    });

    it('getTimerValue should call socketService.on with TIMER_STATE and update targetPlayerId', (done) => {
        const expectedData = {
            timerStarted: true,
            timerPaused: false,
            delay: 30,
            targetPlayer: {
                socketId: 'player123',
                name: 'Test Player',
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
        };

        socketServiceMock.on.and.returnValue(of(expectedData));
        service.getTimerValue().subscribe((data) => {
            expect(data).toEqual(expectedData);
            expect(socketServiceMock.on).toHaveBeenCalledWith(COMBAT_EVENTS.TIMER_STATE);
            expect((service as any).targetPlayerId).toBe('player123');

            done();
        });
    });
});
