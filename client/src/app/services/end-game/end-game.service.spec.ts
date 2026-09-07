import { TestBed } from '@angular/core/testing';
import { SocketService } from '@app/services/sockets/socket.service';
import { GlobalStats } from '@common/interfaces/player-global-stats';
import { PlayerStats } from '@common/interfaces/player-stats.interface';
import { of } from 'rxjs';
import { EndGameService } from './end-game.service';

describe('EndGameService', () => {
    let service: EndGameService;
    let socketServiceSpy: jasmine.SpyObj<SocketService>;

    const mockPlayerStats: PlayerStats[] = [
        {
            name: 'player1',
            combats: 2,
            evasions: 0,
            victories: 2,
            defeats: 0,
            hpLost: 5,
            damageDone: 10,
            itemsPicked: 3,
            tilesVisitedPercentage: 25,
            hasLeft: false,
        },
        {
            name: 'player2',
            combats: 4,
            evasions: 0,
            victories: 1,
            defeats: 3,
            hpLost: 8,
            damageDone: 7,
            itemsPicked: 1,
            tilesVisitedPercentage: 20,
            hasLeft: false,
        },
        {
            name: 'player3',
            combats: 3,
            evasions: 1,
            victories: 2,
            defeats: 1,
            hpLost: 10,
            damageDone: 5,
            itemsPicked: 2,
            tilesVisitedPercentage: 30,
            hasLeft: false,
        },
    ];

    const mockGlobalStats: GlobalStats = {
        formattedDuration: '00:30:45',
        totalTurns: 15,
        tilesVisitedPercentage: 65.5,
        doorManipulatedPercentage: 12.3,
        playersWithFlag: 1,
    };

    beforeEach(() => {
        socketServiceSpy = jasmine.createSpyObj('SocketService', ['send', 'on']);

        TestBed.configureTestingModule({
            providers: [EndGameService, { provide: SocketService, useValue: socketServiceSpy }],
        });

        service = TestBed.inject(EndGameService);
    });

    describe('getEndGameStats', () => {
        it('should request and return player stats', () => {
            const gameId = 'test-game';
            socketServiceSpy.on.and.returnValue(of(mockPlayerStats));

            const result = service.getEndGameStats(gameId);

            expect(socketServiceSpy.send).toHaveBeenCalledWith('get-end-game-stats', { gameId });

            expect(socketServiceSpy.on).toHaveBeenCalledWith('end-game-stats');

            result.subscribe((stats) => {
                expect(stats).toEqual(mockPlayerStats);
            });
        });
    });

    describe('loadGlobalStats', () => {
        it('should request and return global stats', () => {
            const gameId = 'test-game';
            socketServiceSpy.on.and.returnValue(of(mockGlobalStats));

            const result = service.loadGlobalStats(gameId);

            expect(socketServiceSpy.send).toHaveBeenCalledWith('get-end-game-global-stats', { gameId });
            expect(socketServiceSpy.on).toHaveBeenCalledWith('end-game-global-stats');

            result.subscribe((stats) => {
                expect(stats).toEqual(mockGlobalStats);
            });
        });
    });

    describe('sortStats', () => {
        it('should sort by name ascending', () => {
            const sorted = service.sortStats(mockPlayerStats, 'name', true);
            expect(sorted.map((p) => p.name)).toEqual(['player1', 'player2', 'player3']);
        });

        it('should sort by name descending', () => {
            const sorted = service.sortStats(mockPlayerStats, 'name', false);
            expect(sorted.map((p) => p.name)).toEqual(['player3', 'player2', 'player1']);
        });

        it('should sort by combats ascending', () => {
            const sorted = service.sortStats(mockPlayerStats, 'combats', true);
            expect(sorted.map((p) => p.name)).toEqual(['player1', 'player3', 'player2']);
        });

        it('should sort by combats descending', () => {
            const sorted = service.sortStats(mockPlayerStats, 'combats', false);
            expect(sorted.map((p) => p.name)).toEqual(['player2', 'player3', 'player1']);
        });

        it('should sort by victories ascending', () => {
            const sorted = service.sortStats(mockPlayerStats, 'victories', true);
            expect(sorted.map((p) => p.name)).toEqual(['player2', 'player1', 'player3']);
        });

        it('should sort by damageDone descending', () => {
            const sorted = service.sortStats(mockPlayerStats, 'damageDone', false);
            expect(sorted.map((p) => p.name)).toEqual(['player1', 'player2', 'player3']);
        });

        it('should use name as tiebreaker when stats are equal', () => {
            const tiedStats = [
                { ...mockPlayerStats[0], name: 'Charlie', victories: 1 },
                { ...mockPlayerStats[1], name: 'Anna', victories: 1 },
            ];
            const sorted = service.sortStats(tiedStats, 'victories', true);
            expect(sorted.map((p) => p.name)).toEqual(['Anna', 'Charlie']);
        });

        it('should handle empty array', () => {
            const sorted = service.sortStats([], 'name', true);
            expect(sorted).toEqual([]);
        });
    });
});
