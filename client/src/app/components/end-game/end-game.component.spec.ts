/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines */
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MAX_PLAYERS } from '@app/constants/end-game';
import { EndGameService } from '@app/services/end-game/end-game.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { GlobalStats } from '@common/interfaces/player-global-stats';
import { PlayerStats } from '@common/interfaces/player-stats.interface';
import { of, Subject } from 'rxjs';
import { EndGameComponent } from './end-game.component';

describe('EndGameComponent', () => {
    let component: EndGameComponent;
    let fixture: ComponentFixture<EndGameComponent>;
    let mockRouter: jasmine.SpyObj<Router>;
    let mockEndGameService: jasmine.SpyObj<EndGameService>;
    let mockSocketService: jasmine.SpyObj<SocketService>;
    let mockActivatedRoute: any;
    const connectSubject = new Subject<void>();

    const mockPlayerStats: PlayerStats[] = [
        {
            name: 'Player1',
            combats: 5,
            evasions: 2,
            victories: 3,
            defeats: 2,
            hpLost: 50,
            damageDone: 75,
            itemsPicked: 4,
            tilesVisitedPercentage: 65,
            hasLeft: false,
        },
        {
            name: 'Player2',
            combats: 8,
            evasions: 3,
            victories: 6,
            defeats: 2,
            hpLost: 30,
            damageDone: 120,
            itemsPicked: 7,
            tilesVisitedPercentage: 82,
            hasLeft: false,
        },
    ];

    const mockGlobalStats: GlobalStats = {
        formattedDuration: '00:45:23',
        totalTurns: 42,
        tilesVisitedPercentage: 72.5,
        doorManipulatedPercentage: 18.3,
        playersWithFlag: 2,
    };

    beforeEach(async () => {
        mockRouter = jasmine.createSpyObj('Router', ['navigate']);
        mockEndGameService = jasmine.createSpyObj('EndGameService', ['loadGlobalStats', 'getEndGameStats', 'sortStats']);
        mockSocketService = jasmine.createSpyObj('SocketService', ['isConnected', 'onConnect', 'on']);
        mockSocketService.onConnect.and.returnValue(connectSubject.asObservable());
        mockSocketService.on.and.returnValue(of());

        mockActivatedRoute = {
            params: of({ gameId: 'test123' }),
        };

        await TestBed.configureTestingModule({
            imports: [EndGameComponent],
            providers: [
                { provide: Router, useValue: mockRouter },
                { provide: EndGameService, useValue: mockEndGameService },
                { provide: SocketService, useValue: mockSocketService },
                { provide: ActivatedRoute, useValue: mockActivatedRoute },
            ],
        }).compileComponents();

        Object.defineProperty(window, 'history', {
            value: {
                state: { gameId: 'mockedGameId' },
            },
            writable: true,
        });

        Object.defineProperty(window, 'history', {
            value: { state: {} },
            writable: true,
        });

        fixture = TestBed.createComponent(EndGameComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('ngOnInit', () => {
        it('should load stats when socket is connected', () => {
            Object.defineProperty(window, 'history', {
                value: {
                    state: { gameId: 'mockedGameId' },
                    length: 1,
                    scrollRestoration: 'auto',
                    back: () => {},
                    forward: () => {},
                    go: () => {},
                    pushState: () => {},
                    replaceState: () => {},
                },
                writable: true,
            });

            mockSocketService.isConnected.and.returnValue(true);

            mockEndGameService.getEndGameStats.and.returnValue(of(mockPlayerStats));
            mockEndGameService.loadGlobalStats.and.returnValue(of(mockGlobalStats));

            const fixture = TestBed.createComponent(EndGameComponent);
            const component = fixture.componentInstance;

            spyOn(component as any, 'emitGetStats').and.callThrough();
            spyOn(component as any, 'emitGetGlobalStats').and.callThrough();

            fixture.detectChanges();

            expect((component as any).emitGetStats).toHaveBeenCalledWith('mockedGameId');
            expect((component as any).emitGetGlobalStats).toHaveBeenCalledWith('mockedGameId');
        });

        it('should load stats when socket connects later', fakeAsync(() => {
            Object.defineProperty(window, 'history', {
                value: {
                    state: { gameId: 'mockedGameId' },
                    length: 1,
                    scrollRestoration: 'auto',
                    back: () => {},
                    forward: () => {},
                    go: () => {},
                    pushState: () => {},
                    replaceState: () => {},
                },
                writable: true,
            });

            mockSocketService.isConnected.and.returnValue(false);
            mockSocketService.onConnect.and.returnValue(of(undefined));

            mockEndGameService.getEndGameStats.and.returnValue(of(mockPlayerStats));
            mockEndGameService.loadGlobalStats.and.returnValue(of(mockGlobalStats));

            const fixture = TestBed.createComponent(EndGameComponent);
            const component = fixture.componentInstance;

            spyOn(component as any, 'emitGetStats').and.callThrough();
            spyOn(component as any, 'emitGetGlobalStats').and.callThrough();

            fixture.detectChanges();
            tick();

            expect((component as any).emitGetStats).toHaveBeenCalledWith('mockedGameId');
            expect((component as any).emitGetGlobalStats).toHaveBeenCalledWith('mockedGameId');
        }));

        it('should not load stats if no gameId', () => {
            Object.defineProperty(window, 'history', {
                value: {
                    state: {},
                    length: 1,
                    scrollRestoration: 'auto',
                    back: () => {},
                    forward: () => {},
                    go: () => {},
                    pushState: () => {},
                    replaceState: () => {},
                },
                writable: true,
            });

            const fixture = TestBed.createComponent(EndGameComponent);
            const component = fixture.componentInstance;

            spyOn(component as any, 'emitGetStats').and.callThrough();
            spyOn(component as any, 'emitGetGlobalStats').and.callThrough();

            fixture.detectChanges();

            expect((component as any).emitGetStats).not.toHaveBeenCalled();
            expect((component as any).emitGetGlobalStats).not.toHaveBeenCalled();
        });
    });

    describe('emptyRowsCount', () => {
        it('should return correct empty rows count', () => {
            component.playerStats = mockPlayerStats;
            expect(component.emptyRowsCount).toBe(MAX_PLAYERS - mockPlayerStats.length);
        });

        it('should return 0 when player stats exceed MAX_PLAYERS', () => {
            component.playerStats = Array(MAX_PLAYERS + 2).fill({} as PlayerStats);
            expect(component.emptyRowsCount).toBe(0);
        });
    });

    describe('sortByStat', () => {
        it('should sort player stats by victories in ascending order', () => {
            const sortedStats = [...mockPlayerStats].sort((a, b) => a.victories - b.victories);
            mockEndGameService.sortStats.and.returnValue(sortedStats);

            component.playerStats = mockPlayerStats;
            component.sortByStat('victories', true);

            expect(mockEndGameService.sortStats).toHaveBeenCalledWith(mockPlayerStats, 'victories', true);
            expect(component.playerStats).toBe(sortedStats);
            expect(component.sortStat).toBe('victories');
            expect(component.sortOrderUp).toBeTrue();
        });

        it('should sort player stats by damageDone in descending order', () => {
            const sortedStats = [...mockPlayerStats].sort((a, b) => b.damageDone - a.damageDone);
            mockEndGameService.sortStats.and.returnValue(sortedStats);

            component.playerStats = mockPlayerStats;
            component.sortByStat('damageDone', false);

            expect(mockEndGameService.sortStats).toHaveBeenCalledWith(mockPlayerStats, 'damageDone', false);
            expect(component.playerStats).toBe(sortedStats);
            expect(component.sortStat).toBe('damageDone');
            expect(component.sortOrderUp).toBeFalse();
        });
    });

    describe('navBack', () => {
        it('should navigate to home', () => {
            component.navBack();
            expect(mockRouter.navigate).toHaveBeenCalledWith(['/'], { replaceUrl: true });
        });
    });

    describe('emitGetGlobalStats', () => {
        it('should set globalStats when loaded', fakeAsync(() => {
            mockEndGameService.loadGlobalStats.and.returnValue(of(mockGlobalStats));

            component.emitGetGlobalStats('test123');
            tick();

            expect(component.globalStats).toEqual(mockGlobalStats);
            expect(component.globalStats?.formattedDuration).toBe('00:45:23');
        }));
    });

    describe('emitGetStats', () => {
        it('should set playerStats when loaded', fakeAsync(() => {
            mockEndGameService.getEndGameStats.and.returnValue(of(mockPlayerStats));

            component.emitGetStats('test123');
            tick();

            expect(component.playerStats).toEqual(mockPlayerStats);
            expect(component.playerStats[0].name).toBe('Player1');
        }));

        it('should handle empty player stats', fakeAsync(() => {
            mockEndGameService.getEndGameStats.and.returnValue(of([]));

            component.emitGetStats('test123');
            tick();

            expect(component.playerStats).toEqual([]);
            expect(component.emptyRowsCount).toBe(MAX_PLAYERS);
        }));
    });
});
