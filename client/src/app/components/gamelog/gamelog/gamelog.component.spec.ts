/* tslint:disable:no-unused-variable */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines */
import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { GameService } from '@app/services/game/game.service';
import { GameLogEntry, GameLogService } from '@app/services/gamelog/gamelog.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { Player } from '@common/interfaces/player.interface';
import { Subject } from 'rxjs';
import { GamelogComponent } from './gamelog.component';

describe('GamelogComponent', () => {
    let component: GamelogComponent;
    let fixture: ComponentFixture<GamelogComponent>;

    let myPlayerSubject: Subject<Player>;
    let logsSubject: Subject<GameLogEntry[]>;
    let fakeGameService: any;
    let fakeGameLogService: any;
    let fakeSocketService: any;

    beforeEach(async () => {
        myPlayerSubject = new Subject<Player>();
        logsSubject = new Subject<GameLogEntry[]>();

        fakeGameService = {
            myPlayer$: myPlayerSubject.asObservable(),
        };

        fakeGameLogService = {
            logs$: logsSubject.asObservable(),
        };

        fakeSocketService = {
            getSocketId: () => 'socket123',
        };

        await TestBed.configureTestingModule({
            imports: [GamelogComponent],
            providers: [
                { provide: GameService, useValue: fakeGameService },
                { provide: GameLogService, useValue: fakeGameLogService },
                { provide: SocketService, useValue: fakeSocketService },
            ],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(GamelogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should initialize currentPlayerId via socketService', () => {
        component.ngOnInit();
        expect(component.currentPlayerId).toEqual('socket123');
    });

    it('should update myPlayer and apply filter when myPlayer$ emits', () => {
        const player: Player = {
            socketId: 'socket1',
            name: 'Alice',
            avatar: 'https://example.com/avatar.png',
            speed: 5,
            defense: 3,
            attack: 7,
            healthpoints: 100,
            position: { x: 0, y: 0 },
            startPosition: { x: 0, y: 0 },
            fleeAttempts: 0,
            battlesWon: 0,
            inventory: [],
            isInventoryFull: false,
            dice: {
                atk: 2,
                def: 2,
            },
            isMyTurn: false,
            movementPoints: 3,
            actionPoints: 2,
        };
        component.ngOnInit();
        myPlayerSubject.next(player);
        expect(component.myPlayer).toEqual(player);
    });

    it('should update allLogs, apply filter and scroll to bottom when logs$ emits', fakeAsync(() => {
        component.ngOnInit();
        const logs: GameLogEntry[] = [
            { timestamp: '12:00:00', message: 'Log1', players: ['Alice'], type: 'test' },
            { timestamp: '12:01:00', message: 'Log2', players: ['Bob'], type: 'test' },
        ];
        spyOn(component, 'scrollToBottom');
        logsSubject.next(logs);
        tick(100);
        expect(component.allLogs).toEqual(logs);
        expect(component.displayedLogs).toEqual(logs);
        expect(component.scrollToBottom).toHaveBeenCalled();
    }));

    it('applyFilter should filter logs by myPlayer if filterByMe is enabled', () => {
        component.allLogs = [
            { timestamp: '12:00:00', message: 'Log1', players: ['Alice'], type: 'test' },
            { timestamp: '12:01:00', message: 'Log2', players: ['Bob'], type: 'test' },
            { timestamp: '12:02:00', message: 'Log3', players: ['Alice', 'Bob'], type: 'test' },
        ];
        component.myPlayer = {
            socketId: 'socket1',
            name: 'Alice',
            avatar: 'https://example.com/avatar.png',
            speed: 5,
            defense: 3,
            attack: 7,
            healthpoints: 100,
            position: { x: 0, y: 0 },
            startPosition: { x: 0, y: 0 },
            fleeAttempts: 0,
            battlesWon: 0,
            inventory: [],
            isInventoryFull: false,
            dice: {
                atk: 2,
                def: 2,
            },
            isMyTurn: false,
            movementPoints: 3,
            actionPoints: 2,
        };
        component.filterByMe = true;

        component.applyFilter();

        expect(component.displayedLogs).toEqual([
            { timestamp: '12:00:00', message: 'Log1', players: ['Alice'], type: 'test' },
            { timestamp: '12:02:00', message: 'Log3', players: ['Alice', 'Bob'], type: 'test' },
        ]);
    });

    it('applyFilter should set displayedLogs to allLogs if filterByMe is disabled', () => {
        const logs: GameLogEntry[] = [{ timestamp: '12:00:00', message: 'Log1', players: ['Alice'], type: 'test' }];
        component.allLogs = logs;
        component.myPlayer = {
            socketId: 'socket1',
            name: 'Alice',
            avatar: 'https://example.com/avatar.png',
            speed: 5,
            defense: 3,
            attack: 7,
            healthpoints: 100,
            position: { x: 0, y: 0 },
            startPosition: { x: 0, y: 0 },
            fleeAttempts: 0,
            battlesWon: 0,
            inventory: [],
            isInventoryFull: false,
            dice: {
                atk: 2,
                def: 2,
            },
            isMyTurn: false,
            movementPoints: 3,
            actionPoints: 2,
        };
        component.filterByMe = false;

        component.applyFilter();

        expect(component.displayedLogs).toEqual(logs);
    });

    it('toggleMyLogs should toggle filterByMe and call applyFilter', () => {
        spyOn(component, 'applyFilter');
        component.filterByMe = false;
        component.toggleMyLogs();
        expect(component.filterByMe).toBeTrue();
        expect(component.applyFilter).toHaveBeenCalled();
        component.toggleMyLogs();
        expect(component.filterByMe).toBeFalse();
        expect(component.applyFilter).toHaveBeenCalledTimes(2);
    });

    it('scrollToBottom should do nothing if the container is not found', () => {
        expect(() => component.scrollToBottom()).not.toThrow();
    });
});

describe('GamelogComponent - currentPlayerId initialization', () => {
    let component: GamelogComponent;
    let fixture: ComponentFixture<GamelogComponent>;

    let fakeSocketService: any;

    let fakeGameLogService: any;
    let fakeGameService: any;

    beforeEach(async () => {
        fakeSocketService = {
            getSocketId: jasmine.createSpy('getSocketId').and.returnValue('socket123'),
        };

        fakeGameLogService = {
            logs$: new Subject(),
        };

        fakeGameService = {
            myPlayer$: new Subject(),
        };

        await TestBed.configureTestingModule({
            imports: [CommonModule, FormsModule, GamelogComponent],
            providers: [
                { provide: SocketService, useValue: fakeSocketService },
                { provide: GameLogService, useValue: fakeGameLogService },
                { provide: GameService, useValue: fakeGameService },
            ],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(GamelogComponent);
        component = fixture.componentInstance;
    });

    it('should initialize currentPlayerId with the ID returned by socketService.getSocketId', () => {
        component.ngOnInit();
        expect(component.currentPlayerId).toEqual('socket123');
    });

    it('should assign an empty string to currentPlayerId if socketService.getSocketId returns null or undefined', () => {
        fakeSocketService.getSocketId.and.returnValue(null);
        component.ngOnInit();
        expect(component.currentPlayerId).toEqual('');
    });
});
