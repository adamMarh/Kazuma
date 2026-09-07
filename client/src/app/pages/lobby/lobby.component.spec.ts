/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ErrorPopupComponent } from '@app/components/error-popup/error-popup.component';
import { GameService } from '@app/services/game/game.service';
import { ChatSocketService } from '@app/services/sockets/chatroom-socket/chatroom-socket.service';
import { LobbySocketService } from '@app/services/sockets/lobby-socket/lobby-socket.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { Game } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { of, Subscription } from 'rxjs';
import { GameLobbyComponent } from './lobby.component';

describe('GameLobbyComponent', () => {
    let component: GameLobbyComponent;
    let fixture: ComponentFixture<GameLobbyComponent>;
    let mockGameService: jasmine.SpyObj<GameService>;
    let mockLobbySocketService: jasmine.SpyObj<LobbySocketService>;
    let mockSocketService: jasmine.SpyObj<SocketService>;
    let mockRouter: jasmine.SpyObj<Router>;

    const mockGame: Game = {
        gameId: 'game1',
        players: [],
        inactivePlayers: [],
        map: {} as any,
        isLocked: false,
        dropInActive: false,
        started: false,
        ended: false,
        maxPlayers: 4,
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

    const mockPlayer: Player = {
        socketId: 'player1',
        name: 'Test Player',
        avatar: '1',
        speed: 5,
        defense: 3,
        attack: 4,
        healthpoints: 100,
        position: { x: 0, y: 0 },
        startPosition: { x: 0, y: 0 },
        fleeAttempts: 0,
        battlesWon: 0,
        inventory: [],
        isInventoryFull: false,
        dice: { atk: 0, def: 0 },
        isMyTurn: false,
        movementPoints: 3,
        actionPoints: 1,
        isAdmin: true,
    };

    beforeEach(async () => {
        mockGameService = jasmine.createSpyObj('GameService', ['onError', 'setGameInstance', 'setPlayers', 'setMyPlayer'], {
            gameInstance$: of(mockGame),
            players$: of([mockPlayer]),
            myPlayer$: of(mockPlayer),
        });

        mockGameService.onError.and.returnValue(of({ errorMessage: 'An error occurred', shouldRedirect: false }));

        mockLobbySocketService = jasmine.createSpyObj('LobbySocketService', [
            'onForceLockRoom',
            'onGameStarted',
            'onPlayerKicked',
            'onLobbyCanceled',
            'onPlayerLeft',
            'kickPlayer',
            'startGame',
            'lockRoom',
            'unlockRoom',
            'quitGame',
            'addBot',
        ]);

        mockLobbySocketService.onForceLockRoom.and.returnValue(of({ gameId: 'game1', target: 'lobby' }));
        mockLobbySocketService.onGameStarted.and.returnValue(of(null));
        mockLobbySocketService.onPlayerKicked.and.returnValue(of({ message: 'Kicked', shouldRedirect: false }));
        mockLobbySocketService.onLobbyCanceled.and.returnValue(of({ message: 'Canceled' }));
        mockLobbySocketService.onPlayerLeft.and.returnValue(of(null));
        mockLobbySocketService.kickPlayer.and.returnValue(of(null));
        mockLobbySocketService.startGame.and.returnValue(of(null));
        mockLobbySocketService.quitGame.and.returnValue(of(undefined));
        mockLobbySocketService.addBot.and.returnValue(of(null));
        mockLobbySocketService.lockRoom.and.callFake(() => {});
        mockLobbySocketService.unlockRoom.and.callFake(() => {});

        mockSocketService = jasmine.createSpyObj('SocketService', ['on', 'onError', 'emit']);
        mockSocketService.on.and.returnValue(of({}));
        mockSocketService.onError.and.returnValue(of({ message: 'Error', shouldRedirect: false }));
        mockSocketService.emit.and.returnValue(of({}));

        const mockChatSocketService = {
            messages$: of({}),
            history$: of([]),
            joinRoom: jasmine.createSpy('joinRoom').and.returnValue(of(true)),
            leaveRoom: jasmine.createSpy('leaveRoom').and.returnValue(of(true)),
            sendMessage: jasmine.createSpy('sendMessage').and.returnValue(of(true)),
            getMessageHistory: jasmine.createSpy('getMessageHistory').and.returnValue(of(true)),
        };

        mockRouter = jasmine.createSpyObj('Router', ['navigate']);

        await TestBed.configureTestingModule({
            imports: [CommonModule, FormsModule, ErrorPopupComponent, GameLobbyComponent],
            providers: [
                { provide: GameService, useValue: mockGameService },
                { provide: LobbySocketService, useValue: mockLobbySocketService },
                { provide: SocketService, useValue: mockSocketService },
                { provide: ChatSocketService, useValue: mockChatSocketService },
                { provide: Router, useValue: mockRouter },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(GameLobbyComponent);
        component = fixture.componentInstance;

        component.game = mockGame;
        component.players = [mockPlayer];
        component.myPlayer = mockPlayer;
        component.gameId = mockGame.gameId;
        component.currentSocketId = 'socket1';
        component.subscriptions = [];
        component.errorShouldRedirect = false;
        component.errorPopupMessage = '';
        component.errorPopupVisible = false;
        component.showReconnectButton = false;
        component.isAgressive = true;

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('ngOnInit', () => {
        it('should initialize subscriptions', () => {
            expect(component.subscriptions.length).toBeGreaterThan(0);
        });

        it('should set game data from service', () => {
            expect(component.game).toEqual(mockGame);
        });

        it('should set players data from service', () => {
            expect(component.players).toEqual([mockPlayer]);
        });

        it('should set myPlayer data from service', () => {
            expect(component.myPlayer).toEqual(mockPlayer);
        });
    });

    describe('ngOnDestroy', () => {
        it('should unsubscribe all subscriptions', () => {
            const sub = new Subscription();
            const unsubscribeSpy = spyOn(sub, 'unsubscribe');
            component.subscriptions.push(sub);
            component.ngOnDestroy();
            expect(unsubscribeSpy).toHaveBeenCalled();
        });
    });

    describe('sortPlayers', () => {
        it('should put admin before non-admin', () => {
            const admin = { ...mockPlayer, isAdmin: true };
            const nonAdmin = { ...mockPlayer, isAdmin: false };

            component.players = [nonAdmin, admin];
            component.sortPlayers();
            expect(component.players[0]).toBe(admin);
            expect(component.players[1]).toBe(nonAdmin);
        });

        it('should not change order between two admins', () => {
            const admin1 = { ...mockPlayer, isAdmin: true, name: 'Admin 1' };
            const admin2 = { ...mockPlayer, isAdmin: true, name: 'Admin 2' };

            component.players = [admin1, admin2];
            component.sortPlayers();
            expect(component.players[0]).toBe(admin1);
            expect(component.players[1]).toBe(admin2);
        });

        it('should not change order between two non-admins', () => {
            const player1 = { ...mockPlayer, isAdmin: false, name: 'Player 1' };
            const player2 = { ...mockPlayer, isAdmin: false, name: 'Player 2' };

            component.players = [player1, player2];
            component.sortPlayers();
            expect(component.players[0]).toBe(player1);
            expect(component.players[1]).toBe(player2);
        });

        it('should handle empty array', () => {
            component.players = [];
            component.sortPlayers();
            expect(component.players).toEqual([]);
        });

        it('should handle players with undefined isAdmin', () => {
            const player1 = { ...mockPlayer, isAdmin: undefined, name: 'Player1' };
            const player2 = { ...mockPlayer, isAdmin: true, name: 'Player2' };
            const player3 = { ...mockPlayer, isAdmin: false, name: 'Player3' };
            component.players = [player1, player2, player3];
            component.sortPlayers();
            expect(component.players[0]).toBe(player2);
            expect(component.players[1]).toBe(player1);
            expect(component.players[2]).toBe(player3);
        });
    });

    describe('subscribeToGameStart', () => {
        it('should navigate to in-game on game start', () => {
            component.subscribeToGameStart();
            expect(mockRouter.navigate).toHaveBeenCalledWith(['/in-game']);
        });
    });

    describe('subscribeToLobbyUpdates', () => {
        it('should handle lobby canceled', () => {
            const cancelMsg = 'The lobby has been canceled';
            mockLobbySocketService.onLobbyCanceled.and.returnValue(of({ message: cancelMsg }));

            component.subscribeToLobbyUpdates();

            expect(component.errorPopupMessage).toBe(cancelMsg);
            expect(mockLobbySocketService.onLobbyCanceled).toHaveBeenCalled();
        });
    });

    describe('kickPlayer', () => {
        it('should call lobbySocketService.kickPlayer', () => {
            component.kickPlayer('player2');
            expect(mockLobbySocketService.kickPlayer).toHaveBeenCalledWith('player2', mockGame.gameId);
        });
    });

    describe('startGame', () => {
        it('should call lobbySocketService.startGame', () => {
            component.game = mockGame;
            component.startGame();
            expect(mockLobbySocketService.startGame).toHaveBeenCalledWith('game1');
        });
    });

    describe('quitGame', () => {
        it('should navigate home on quit', () => {
            component.quitGame();
            expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
        });
    });

    describe('lockRoom', () => {
        it('should call lobbySocketService.lockRoom', () => {
            component.game = mockGame;
            component.lockRoom();
            expect(mockLobbySocketService.lockRoom).toHaveBeenCalledWith('game1');
        });
    });

    describe('unlockRoom', () => {
        it('should call lobbySocketService.unlockRoom', () => {
            component.game = mockGame;
            component.unlockRoom();
            expect(mockLobbySocketService.unlockRoom).toHaveBeenCalledWith('game1');
        });
    });
    describe('handleErrorPopupClosed', () => {
        it('should set errorPopupVisible to false and do nothing if errorShouldRedirect is false', () => {
            component.errorShouldRedirect = false;
            component.errorPopupMessage = '';
            (mockGameService.setGameInstance as jasmine.Spy).calls.reset();
            (mockGameService.setPlayers as jasmine.Spy).calls.reset();
            (mockGameService.setMyPlayer as jasmine.Spy).calls.reset();

            component.handleErrorPopupClosed();

            expect(component.errorPopupVisible).toBeFalse();
            expect(mockGameService.setGameInstance).not.toHaveBeenCalled();
            expect(mockGameService.setPlayers).not.toHaveBeenCalled();
            expect(mockGameService.setMyPlayer).not.toHaveBeenCalled();
        });

        it('should set errorPopupVisible to false, reset game data, and navigate to /home if errorShouldRedirect is true', () => {
            component.errorShouldRedirect = true;
            component.errorPopupMessage = 'Some error';
            (mockGameService.setGameInstance as jasmine.Spy).calls.reset();
            (mockGameService.setPlayers as jasmine.Spy).calls.reset();
            (mockGameService.setMyPlayer as jasmine.Spy).calls.reset();

            component.handleErrorPopupClosed();

            expect(component.errorPopupVisible).toBeFalse();
            expect(mockGameService.setGameInstance).toHaveBeenCalledWith(null);
            expect(mockGameService.setPlayers).toHaveBeenCalledWith([]);
            expect(mockGameService.setMyPlayer).toHaveBeenCalledWith(null);
            expect(mockRouter.navigate).toHaveBeenCalledWith(['/home']);
        });
    });

    describe('addBot', () => {
        it('should call lobbySocketService.addBot with the given aggression and push the subscription', () => {
            component.game = { gameId: 'game1' } as Game;
            const initialSubCount = component.subscriptions.length;
            mockLobbySocketService.addBot.and.returnValue(of(null));

            component.addBot(true);

            expect(mockLobbySocketService.addBot).toHaveBeenCalledWith(true, 'game1');
            expect(component.subscriptions.length).toBe(initialSubCount + 1);
        });
    });
});
