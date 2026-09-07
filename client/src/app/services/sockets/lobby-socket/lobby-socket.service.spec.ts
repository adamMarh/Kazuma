/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestBed } from '@angular/core/testing';
import { LobbySocketService } from '@app/services/sockets/lobby-socket/lobby-socket.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { Game } from '@common/interfaces/game.interface';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { LOBBY_EVENTS } from '@common/socket-events/lobby.events';
import { of } from 'rxjs';

describe('LobbySocketService', () => {
    let service: LobbySocketService;
    let socketServiceMock: jasmine.SpyObj<SocketService>;
    const mockGame: Game = { gameId: '1234', players: [] } as unknown as Game;

    beforeEach(() => {
        socketServiceMock = jasmine.createSpyObj('SocketService', ['emit', 'on']);
        TestBed.configureTestingModule({
            providers: [LobbySocketService, { provide: SocketService, useValue: socketServiceMock }],
        });
        service = TestBed.inject(LobbySocketService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should create a game', () => {
        socketServiceMock.emit.and.returnValue(of(mockGame));
        service.createGame('Léa', 1, {}, {}).subscribe((res) => {
            expect(res).toEqual(mockGame);
            expect(service.getGameInstance()).toEqual(mockGame);
        });
    });

    it('should join a game', () => {
        socketServiceMock.emit.and.returnValue(of(mockGame));
        service.joinGame('1234', 'Léa', 2, {}).subscribe((res) => {
            expect(res).toEqual(mockGame);
            expect(service.getGameInstance()).toEqual(mockGame);
        });
    });

    it('should check game ID', () => {
        socketServiceMock.emit.and.returnValue(of(mockGame));
        service.checkGameId('1234').subscribe((res) => {
            expect(res).toEqual(mockGame);
        });
    });

    it('should send player data', () => {
        socketServiceMock.emit.and.returnValue(of(mockGame));
        service.sendPlayerData('1234', 'Léa', 1, {}).subscribe((res) => {
            expect(res).toEqual(mockGame);
        });
    });

    it('should leave pending room', () => {
        service.leavePendingRoom('1234');
        expect(socketServiceMock.emit).toHaveBeenCalledWith(LOBBY_EVENTS.LEAVE_PENDING, '1234');
    });

    it('should start the game', () => {
        socketServiceMock.emit.and.returnValue(of('started'));
        service.startGame('1234').subscribe((res) => {
            expect(res).toBe('started');
        });
    });

    it('should kick player', () => {
        service.setGameInstance(mockGame);
        service.kickPlayer('socket-id', mockGame.gameId);
        expect(socketServiceMock.emit).toHaveBeenCalledWith(LOBBY_EVENTS.KICK_PLAYER, { gameId: '1234', targetSocketId: 'socket-id' });
    });

    it('should listen to GAME_STARTED', () => {
        const mockRes = { gameId: '1234' };
        socketServiceMock.on.and.returnValue(of(mockRes));
        service.onGameStarted().subscribe((res) => {
            expect(res).toEqual(mockRes);
        });
    });

    it('should handle lobby updates and update players', () => {
        const updatedGame = { gameId: '1234', players: [{ name: 'Léa' }] } as Game;
        socketServiceMock.on.and.returnValue(of(updatedGame));
        service.onLobbyUpdate().subscribe(() => {
            expect(service.getGameInstance()).toEqual(updatedGame);
        });
    });

    it('should select and deselect avatar', () => {
        socketServiceMock.emit.and.returnValue(of('selected'));
        service.selectAvatar('1234', 1).subscribe((res) => {
            expect(res).toBe('selected');
        });

        socketServiceMock.emit.and.returnValue(of('deselected'));
        service.deselectAvatar('1234').subscribe((res) => {
            expect(res).toBe('deselected');
        });
    });

    it('should return gameId or null', () => {
        service.setGameInstance(mockGame);
        expect(service.getGameId()).toBe('1234');

        service.setGameInstance(null as any);
        expect(service.getGameId()).toBeNull();
    });

    it('should lock and unlock room', () => {
        socketServiceMock.emit.and.returnValue(of(void 0));
        service.lockRoom('1234');
        expect(socketServiceMock.emit).toHaveBeenCalledWith(LOBBY_EVENTS.LOCK_ROOM, { gameId: '1234' });

        service.unlockRoom('1234');
        expect(socketServiceMock.emit).toHaveBeenCalledWith(LOBBY_EVENTS.UNLOCK_ROOM, { gameId: '1234' });
    });

    it('should quit game', () => {
        service.setGameInstance(mockGame);
        socketServiceMock.emit.and.returnValue(of(void 0));
        service.quitGame(mockGame.gameId).subscribe((res) => {
            expect(res).toBeUndefined();
        });
        expect(socketServiceMock.emit).toHaveBeenCalledWith(LOBBY_EVENTS.QUIT_GAME, { gameId: '1234' });
    });

    it('should toggle debug and receive debug updates', () => {
        socketServiceMock.emit.and.returnValue(of(void 0));
        service.toggleDebug('1234');
        expect(socketServiceMock.emit).toHaveBeenCalledWith(GAME_EVENTS.DEBUG, { gameId: '1234' });

        const debugInfo = { debug: true };
        socketServiceMock.on.and.returnValue(of(debugInfo));
        service.onDebug().subscribe((data) => {
            expect(data).toEqual(debugInfo);
        });
    });

    it('should listen to PLAYER_KICKED event', () => {
        const mockResponse = {
            message: "Vous avez été exclu de la partie par l'organisateur. Vous allez être redirigé vers la page d'accueil.",
            shouldRedirect: true,
        };
        socketServiceMock.on.and.returnValue(of(mockResponse));

        service.onPlayerKicked().subscribe((res) => {
            expect(res).toEqual(mockResponse);
        });
        expect(socketServiceMock.on).toHaveBeenCalledWith(LOBBY_EVENTS.PLAYER_KICKED);
    });

    it('should listen to CANCEL_LOBBY event', () => {
        const mockResponse = { cancelled: true };
        socketServiceMock.on.and.returnValue(of(mockResponse));

        service.onLobbyCanceled().subscribe((res) => {
            expect(res).toEqual(mockResponse);
        });
        expect(socketServiceMock.on).toHaveBeenCalledWith(LOBBY_EVENTS.CANCEL_LOBBY);
    });

    it('should listen to PLAYER_LEFT event', () => {
        const mockResponse = { left: true };
        socketServiceMock.on.and.returnValue(of(mockResponse));

        service.onPlayerLeft().subscribe((res) => {
            expect(res).toEqual(mockResponse);
        });
        expect(socketServiceMock.on).toHaveBeenCalledWith(LOBBY_EVENTS.PLAYER_LEFT);
    });

    it('should listen to FORCE_LOCK_ROOM event', () => {
        const mockResponse = { locked: true };
        socketServiceMock.on.and.returnValue(of(mockResponse));

        service.onForceLockRoom().subscribe((res) => {
            expect(res).toEqual(mockResponse);
        });
        expect(socketServiceMock.on).toHaveBeenCalledWith(LOBBY_EVENTS.FORCE_LOCK_ROOM);
    });
    it('should call socketService.emit with ADD_BOT event and correct payload', (done) => {
        const gameId = '1234';
        const isAgressive = true;
        socketServiceMock.emit.and.returnValue(of('bot added'));

        service.addBot(isAgressive, gameId).subscribe((result) => {
            expect(result).toEqual('bot added');
            done();
        });
        expect(socketServiceMock.emit).toHaveBeenCalledWith(LOBBY_EVENTS.ADD_BOT, { isAgressive, gameId });
    });
});
