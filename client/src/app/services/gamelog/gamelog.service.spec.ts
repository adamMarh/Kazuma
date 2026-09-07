/* tslint:disable:no-unused-variable */

import { TestBed } from '@angular/core/testing';
import { SocketService } from '@app/services/sockets/socket.service';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { Subject } from 'rxjs';
import { GameLogEntry, GameLogService } from './gamelog.service';

describe('GameLogService', () => {
    let service: GameLogService;

    let logSubject: Subject<GameLogEntry>;
    let gameStartedSubject: Subject<void>;

    beforeEach(() => {
        logSubject = new Subject<GameLogEntry>();
        gameStartedSubject = new Subject<void>();

        const socketServiceSpy = jasmine.createSpyObj('SocketService', ['on']);

        socketServiceSpy.on.withArgs(GAME_EVENTS.LOG).and.returnValue(logSubject.asObservable());
        socketServiceSpy.on.withArgs(GAME_EVENTS.GAME_STARTED).and.returnValue(gameStartedSubject.asObservable());

        TestBed.configureTestingModule({
            providers: [GameLogService, { provide: SocketService, useValue: socketServiceSpy }],
        });

        service = TestBed.inject(GameLogService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should append new log entry upon receiving a socket event', () => {
        let currentLogs: GameLogEntry[] = [];
        service.logs$.subscribe((logs) => {
            currentLogs = logs;
        });

        expect(currentLogs).toEqual([]);

        const newLog: GameLogEntry = {
            timestamp: '10:00:00',
            message: 'Test log',
            players: ['player1'],
            type: 'test',
        };

        logSubject.next(newLog);

        expect(currentLogs).toEqual([newLog]);
        const newLog2: GameLogEntry = {
            timestamp: '10:05:00',
            message: 'Second log',
            players: ['player2'],
            type: 'test',
        };
        logSubject.next(newLog2);
        expect(currentLogs).toEqual([newLog, newLog2]);
    });

    it('filterLogsForPlayer should return only logs containing the given player id', (done) => {
        const logs: GameLogEntry[] = [
            { timestamp: '10:00:00', message: 'Log for player1', players: ['player1'], type: 'test' },
            { timestamp: '10:05:00', message: 'Log for player2', players: ['player2'], type: 'test' },
            { timestamp: '10:10:00', message: 'Log for both', players: ['player1', 'player2'], type: 'test' },
        ];

        logs.forEach((log) => logSubject.next(log));

        service.filterLogsForPlayer('player1').subscribe((filteredLogs) => {
            expect(filteredLogs).toEqual([
                { timestamp: '10:00:00', message: 'Log for player1', players: ['player1'], type: 'test' },
                { timestamp: '10:10:00', message: 'Log for both', players: ['player1', 'player2'], type: 'test' },
            ]);
            done();
        });
    });

    it('should reset logs upon receiving GAME_STARTED', (done) => {
        let logs: GameLogEntry[] = [];

        service.logs$.subscribe((updatedLogs) => {
            logs = updatedLogs;
        });

        const initialLog: GameLogEntry = {
            timestamp: '10:00:00',
            message: 'Log avant reset',
            players: ['player1'],
            type: 'test',
        };
        logSubject.next(initialLog);

        expect(logs).toEqual([initialLog]);

        gameStartedSubject.next();

        setTimeout(() => {
            expect(logs).toEqual([]);
            done();
        }, 0);
    });
});
