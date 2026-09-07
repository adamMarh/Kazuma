/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestBed } from '@angular/core/testing';
import { LobbySocketService } from '@app/services/sockets/lobby-socket/lobby-socket.service';
import { MovementSocketService } from '@app/services/sockets/movement-socket/movement-socket.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/interfaces/position.interface';
import { TileInfo } from '@common/interfaces/tileInfo.interface';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { MOVEMENT_EVENTS } from '@common/socket-events/movement.events';
import { of } from 'rxjs';

describe('MovementSocketService', () => {
    let service: MovementSocketService;
    let socketServiceMock: jasmine.SpyObj<SocketService>;
    let lobbySocketServiceMock: jasmine.SpyObj<LobbySocketService>;

    const GAME_ID = 'test-game-id';
    const SOCKET_ID = 'test-socket-id';

    beforeEach(() => {
        socketServiceMock = jasmine.createSpyObj('SocketService', ['emit', 'on', 'getSocketId']);
        lobbySocketServiceMock = jasmine.createSpyObj('LobbySocketService', ['getGameId']);

        TestBed.configureTestingModule({
            providers: [
                MovementSocketService,
                { provide: SocketService, useValue: socketServiceMock },
                { provide: LobbySocketService, useValue: lobbySocketServiceMock },
            ],
        });

        service = TestBed.inject(MovementSocketService);

        socketServiceMock.getSocketId.and.returnValue(SOCKET_ID);
        lobbySocketServiceMock.getGameId.and.returnValue(GAME_ID);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should get possible movements', () => {
        const mockPositions: Position[] = [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
        ];
        socketServiceMock.emit.and.returnValue(of(mockPositions));

        service.getPossibleMovements(GAME_ID).subscribe((positions) => {
            expect(positions).toEqual(mockPositions);
        });

        expect(socketServiceMock.emit).toHaveBeenCalledWith(MOVEMENT_EVENTS.GET_MOVEMENTS, { gameId: GAME_ID });
    });

    it('should return null when player is not found in players list', (done) => {
        const mockPlayers: Player[] = [
            { socketId: 'other-socket-id', position: { x: 1, y: 1 } } as Player,
            { socketId: 'another-socket-id', position: { x: 2, y: 2 } } as Player,
        ];
        socketServiceMock.game = {} as any;
        socketServiceMock.on.and.returnValue(of(mockPlayers));
        service.onPlayerMoved().subscribe(() => {
            service.myPlayer$.subscribe((myPlayer) => {
                expect(myPlayer).toBeNull();
                done();
            });
        });
    });

    it('should move player', () => {
        const targetPos: Position = { x: 3, y: 3 };
        const mockPath: Position[] = [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 3, y: 3 },
        ];
        socketServiceMock.emit.and.returnValue(of(mockPath));

        service.move(targetPos, false).subscribe((path) => {
            expect(path).toEqual(mockPath);
        });

        expect(socketServiceMock.emit).toHaveBeenCalledWith(MOVEMENT_EVENTS.PLAYER_MOVED, {
            targetPos,
            gameId: GAME_ID,
            isRightClick: false,
        });
    });

    it('should handle onPlayerMoved event', () => {
        const mockPlayers: Player[] = [
            { socketId: SOCKET_ID, position: { x: 1, y: 1 } } as Player,
            { socketId: 'other-id', position: { x: 2, y: 2 } } as Player,
        ];

        socketServiceMock.on.and.returnValue(of(mockPlayers));
        socketServiceMock.game = {} as any;

        service.onPlayerMoved().subscribe((players) => {
            expect(players).toEqual(mockPlayers);
        });

        expect(socketServiceMock.on).toHaveBeenCalledWith(MOVEMENT_EVENTS.PLAYER_MOVED);
    });

    it('should get information about a tile', () => {
        const targetPos: Position = { x: 3, y: 3 };
        const mockTileInfo: TileInfo = { isWalkable: true } as unknown as TileInfo;
        socketServiceMock.emit.and.returnValue(of(mockTileInfo));

        service.getInformation(targetPos).subscribe((info) => {
            expect(info).toEqual(mockTileInfo);
        });

        expect(socketServiceMock.emit).toHaveBeenCalledWith(MOVEMENT_EVENTS.INFO, {
            targetPos,
            gameId: GAME_ID,
        });
    });

    it('should get shortest path', () => {
        const targetPos: Position = { x: 3, y: 3 };
        const mockPath: Position[] = [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 3, y: 3 },
        ];
        socketServiceMock.emit.and.returnValue(of(mockPath));

        service.getShortestPath(targetPos, GAME_ID).subscribe((path) => {
            expect(path).toEqual(mockPath);
        });

        expect(socketServiceMock.emit).toHaveBeenCalledWith(MOVEMENT_EVENTS.GET_PATH, {
            targetPos,
            gameId: GAME_ID,
        });
    });

    it('should return current turn', () => {
        expect(service.getCurrentTurn()).toEqual(0);
    });

    it('should handle onPossibleMovements event', () => {
        const mockPositions: Position[] = [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
        ];
        socketServiceMock.on.and.returnValue(of(mockPositions));

        service.onPossibleMovements().subscribe((positions) => {
            expect(positions).toEqual(mockPositions);
        });

        expect(socketServiceMock.on).toHaveBeenCalledWith(MOVEMENT_EVENTS.GET_MOVEMENTS);
    });

    it('should update myPlayer when players change', () => {
        const mockPlayers: Player[] = [
            { socketId: SOCKET_ID, position: { x: 1, y: 1 } } as Player,
            { socketId: 'other-id', position: { x: 2, y: 2 } } as Player,
        ];

        socketServiceMock.game = {} as any;
        socketServiceMock.on.and.returnValue(of(mockPlayers));
        service.onPlayerMoved().subscribe();
        service.myPlayer$.subscribe((myPlayer) => {
            expect(myPlayer).toEqual(mockPlayers[0]);
        });
    });

    it('should listen to MAP_UPDATED event and return its data', (done) => {
        const expectedData = { someKey: 'someValue' };
        socketServiceMock.on.and.returnValue(of(expectedData));

        service.onMapUpdated().subscribe((data) => {
            expect(data).toEqual(expectedData);
            done();
        });
        expect(socketServiceMock.on).toHaveBeenCalledWith(GAME_EVENTS.MAP_UPDATED);
    });
});
