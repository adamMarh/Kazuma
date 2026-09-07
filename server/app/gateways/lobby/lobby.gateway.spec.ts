/* eslint-disable max-lines */
import { REASON } from '@common/socket-constants/game.constants';
import { COMBAT_EVENTS } from '@common/socket-events/combat.events';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { Server } from 'socket.io';
import { LOBBY_EVENTS } from '../../../../common/socket-events/lobby.events';
import { LobbyGateway } from './lobby.gateway';

describe('LobbyGateway', () => {
    let gateway: LobbyGateway;
    let lobbyService: any;
    let newGameService: any;
    let movementService: any;
    let botService: any;
    let server: any;
    let turnService: any;
    let chatService: any;
    let combatService: any;
    let currencyService: any;
    beforeEach(() => {
        lobbyService = {
            joinGame: jest.fn(),
            lockRoom: jest.fn(),
            unlockRoom: jest.fn(),
            addBot: jest.fn(),
            generateTeams: jest.fn(),
            removePlayer: jest.fn(),
        };

        movementService = {
            placePlayers: jest.fn(),
        };

        turnService = {
            orderPlayerTurns: jest.fn(),
            startTimers: jest.fn(),
            cancelTimers: jest.fn(),
            resumeTimers: jest.fn(),
            turnBehaviour: jest.fn(),
        };

        newGameService = {
            createGame: jest.fn(),
            getPlayer: jest.fn(),
            getGame: jest.fn(),
            removePlayer: jest.fn(),
            isPlayerInCombat: jest.fn(),
            handleCombatantDisonnection: jest.fn(),
            nextTurn: jest.fn(),
            getGameByPlayer: jest.fn(),
            getGames: jest.fn().mockReturnValue({}),
            removeGame: jest.fn(),
            setServer: jest.fn(),
        };

        combatService = {
            dropPlayerItems: jest.fn(),
        };

        botService = {
            runBotTurn: jest.fn(),
        };

        currencyService = {
            applyEndGameRewards: jest.fn().mockResolvedValue(undefined),
        };

        gateway = new LobbyGateway(
            lobbyService,
            newGameService,
            movementService,
            turnService,
            botService,
            chatService,
            combatService,
            currencyService,
        );

        const emitMock = jest.fn();
        const exceptMock = jest.fn(() => ({ emit: emitMock }));

        server = {
            to: jest.fn(() => ({
                emit: emitMock,
                except: exceptMock,
            })),
            emit: emitMock,
        };

        gateway.server = server;
        jest.useFakeTimers();
    });

    afterEach(() => {
        turnService.cancelTimers('game1');
    });

    describe('handleCreateRoom', () => {
        it('doit créer une room, faire rejoindre le client et retourner game et myPlayer', () => {
            const client = { id: 'client1', join: jest.fn() } as any;
            const payload = { name: 'Room1', avatar: 1, map: {} as any, attributes: {} };
            const game = { gameId: 'game1' };
            const myPlayer = { id: 'player1' };
            newGameService.createGame.mockReturnValue(game);
            newGameService.getPlayer.mockReturnValue(myPlayer);

            const result = gateway.handleCreateRoom(client, payload);

            expect(newGameService.createGame).toHaveBeenCalledWith(client.id, payload);
            expect(client.join).toHaveBeenCalledWith(game.gameId);
            expect(newGameService.getPlayer).toHaveBeenCalledWith(client.id, game);
            expect(result).toEqual({ game, myPlayer });
        });
    });

    describe('handleStartGame', () => {
        let client: any;
        let payload: { gameId: string };
        let game: any;
        let firstPlayer: any;

        beforeEach(() => {
            client = { id: 'client1', emit: jest.fn() };
            payload = { gameId: 'game1' };

            firstPlayer = {
                socketId: 'p1',
                name: 'Alice',
                isBot: false,
                isMyTurn: true,
            };

            game = {
                gameId: 'game1',
                map: { gameMode: 'classic' },
                players: [firstPlayer, { socketId: 'p2' }],
                playerTurns: [firstPlayer.socketId],
                started: false,
            };

            newGameService.getGame.mockReturnValue(game);
            newGameService.getPlayer.mockReturnValue(firstPlayer);
        });

        it('starts a classic game with multiple players', async () => {
            await gateway.handleStartGame(client, payload);

            expect(game.started).toBe(true);
            expect(movementService.placePlayers).toHaveBeenCalledWith(game);
            expect(turnService.orderPlayerTurns).toHaveBeenCalledWith(game);

            expect(server.to).toHaveBeenCalledWith(payload.gameId);
            const emit = server.to().emit;

            expect(emit).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, game);
            expect(emit).toHaveBeenCalledWith(LOBBY_EVENTS.GAME_STARTED, { gameId: game.gameId });

            expect(emit).toHaveBeenCalledWith(
                GAME_EVENTS.LOG,
                expect.objectContaining({
                    message: `Début de tour de ${firstPlayer.name}`,
                    players: [firstPlayer.name],
                    type: 'turn',
                }),
            );
        });

        it('prevents starting a classic game with only one player', async () => {
            game.players = [firstPlayer];

            await gateway.handleStartGame(client, payload);

            expect(server.to).toHaveBeenCalledWith(client.id);
            const emit = server.to(client.id).emit;
            expect(emit).toHaveBeenCalledWith(GAME_EVENTS.ON_ERROR, {
                errorMessage: "Vous ne pouvez pas démarrer une partie tout seul. Veuillez attendre d'autres joueurs.",
                shouldRedirect: false,
            });
            expect(movementService.placePlayers).not.toHaveBeenCalled();
        });

        it('handles team generation failure in CTF mode', async () => {
            game.map.gameMode = 'CTF';
            lobbyService.generateTeams.mockImplementation(() => {
                throw new Error('Échec des équipes');
            });

            await gateway.handleStartGame(client, payload);

            expect(server.to).toHaveBeenCalledWith(client.id);
            const emit = server.to(client.id).emit;
            expect(emit).toHaveBeenCalledWith(GAME_EVENTS.ON_ERROR, {
                errorMessage: 'Échec des équipes',
                shouldRedirect: false,
            });
            expect(movementService.placePlayers).not.toHaveBeenCalled();
        });

        it('triggers bot logic if first player is a bot', async () => {
            firstPlayer.isBot = true;
            game.players = [firstPlayer, { socketId: 'p2' }];
            game.playerTurns = [firstPlayer.socketId];

            await gateway.handleStartGame(client, payload);

            expect(game.currentPlayerIndex).toBe(game.players.length - 1);
            expect(turnService.turnBehaviour).toHaveBeenCalledWith(server, game);
        });
        it('should emit a log and handle bot turn if first player is a bot', async () => {
            const client = { id: 'client1', emit: jest.fn() } as any;
            const payload = { gameId: 'game1' };

            const botPlayer = {
                socketId: 'bot1',
                name: 'BotPlayer',
                isBot: true,
                isMyTurn: true,
            };

            const secondPlayer = {
                socketId: 'p2',
                name: 'Alice',
                isBot: false,
                isMyTurn: false,
            };

            const game = {
                gameId: 'game1',
                players: [botPlayer, secondPlayer],
                playerTurns: [botPlayer.socketId, secondPlayer.socketId],
                map: { gameMode: 'classic' },
                started: false,
                currentPlayerIndex: 0,
            };

            const emitMock = jest.fn();
            server.to = jest.fn(() => ({ emit: emitMock }));

            newGameService.getGame.mockReturnValue(game);
            newGameService.getPlayer.mockReturnValue(botPlayer);

            await gateway.handleStartGame(client, payload);

            expect(emitMock).toHaveBeenCalledWith(
                GAME_EVENTS.LOG,
                expect.objectContaining({
                    message: `Début de tour de ${botPlayer.name}`,
                    players: [botPlayer.name],
                    type: 'turn',
                }),
            );
            expect(turnService.turnBehaviour).toHaveBeenCalledWith(server, game);
            expect(game.currentPlayerIndex).toBe(game.players.length - 1);
        });
    });

    it('should set the server instance on game service after initialization', () => {
        const mockServer = {} as Server;

        gateway.afterInit(mockServer);

        expect(newGameService.setServer).toHaveBeenCalledWith(mockServer);
    });

    describe('handleCheckGameId', () => {
        it("doit retourner une erreur si la game n'existe pas", () => {
            const client = { join: jest.fn() } as any;
            const payload = { gameId: 'game1' };
            newGameService.getGame.mockReturnValue(null);

            const result = gateway.handleCheckGameId(client, payload);

            expect(result).toEqual({ error: 'Code invalide, veuillez essayer à nouveau.' });
        });

        it('doit retourner une erreur si la game est verrouillée', () => {
            const client = { join: jest.fn() } as any;
            const payload = { gameId: 'game1' };
            const game = { gameId: 'game1', isLocked: true };
            newGameService.getGame.mockReturnValue(game);

            const result = gateway.handleCheckGameId(client, payload);
            expect(result).toEqual({ error: 'La partie est verrouillée, veuillez essayer à nouveau.' });
        });

        it("doit faire rejoindre la room pending et retourner la game si celle-ci existe et n'est pas verrouillée", () => {
            const client = { join: jest.fn() } as any;
            const payload = { gameId: 'game1' };
            const game = { gameId: 'game1', isLocked: false };
            newGameService.getGame.mockReturnValue(game);

            const result = gateway.handleCheckGameId(client, payload);
            expect(client.join).toHaveBeenCalledWith(`pending_${payload.gameId}`);
            expect(result).toEqual(game);
        });
    });

    describe('handleLeavePending', () => {
        it('doit quitter la pending room', () => {
            const client = { leave: jest.fn() } as any;
            const gameId = 'game1';
            gateway.handleLeavePending(client, gameId);
            expect(client.leave).toHaveBeenCalledWith(`pending_${gameId}`);
        });
    });

    describe('handleJoinRoom', () => {
        it("doit émettre une erreur si la game n'existe pas", () => {
            const client = { id: 'client1', join: jest.fn(), leave: jest.fn(), emit: jest.fn() } as any;
            const payload = { gameId: 'game1', name: 'Alice', avatar: 1, attributes: {} };
            newGameService.getGame.mockReturnValue(null);

            gateway.handleJoinRoom(client, payload);
            expect(server.to).toHaveBeenCalledWith(client.id);
            const toObj = server.to.mock.results[0].value;
            expect(toObj.emit).toHaveBeenCalledWith(GAME_EVENTS.ON_ERROR, {
                errorMessage: "La salle n'existe pas.",
                shouldRedirect: false,
            });
        });

        it('doit émettre une erreur si la game est verrouillée', () => {
            const client = { id: 'client1', join: jest.fn(), leave: jest.fn(), emit: jest.fn() } as any;
            const payload = { gameId: 'game1', name: 'Alice', avatar: 1, attributes: {} };
            const game = { gameId: 'game1', isLocked: true };
            newGameService.getGame.mockReturnValue(game);

            gateway.handleJoinRoom(client, payload);
            expect(server.to).toHaveBeenCalledWith(client.id);
            const toObj = server.to.mock.results[0].value;
            expect(toObj.emit).toHaveBeenCalledWith(GAME_EVENTS.ON_ERROR, {
                errorMessage: 'La salle est verrouillée.',
                shouldRedirect: false,
            });
        });

        it("doit faire rejoindre la room et émettre UPDATE_LOBBY si la game existe et n'est pas verrouillée", () => {
            const client = { id: 'client1', join: jest.fn(), leave: jest.fn(), emit: jest.fn() } as any;
            const payload = { gameId: 'game1', name: 'Alice', avatar: 1, attributes: {} };
            const game = { gameId: 'game1', isLocked: false };
            const myPlayer = { id: 'player1' };
            newGameService.getGame.mockReturnValue(game);
            newGameService.getPlayer.mockReturnValue(myPlayer);

            const spyDeselect = jest.spyOn(gateway, 'handleDeselectAvatar');

            const result = gateway.handleJoinRoom(client, payload);

            expect(lobbyService.joinGame).toHaveBeenCalledWith(client.id, game, payload.name, payload.avatar, payload.attributes);
            expect(client.leave).toHaveBeenCalledWith(`pending_${payload.gameId}`);
            expect(client.join).toHaveBeenCalledWith(game.gameId);
            expect(newGameService.getPlayer).toHaveBeenCalledWith(client.id, game);

            expect(server.to).toHaveBeenCalledWith(game.gameId);
            expect(result).toEqual({ game, myPlayer });
            spyDeselect.mockRestore();
        });
    });

    describe('handleAddBot', () => {
        it('should do nothing', () => {
            const client = {} as any;
            const game = { gameId: 'game1', isLocked: false };
            const payload = {
                isAgressive: false,
                gameId: game.gameId,
            };
            newGameService.getGame.mockReturnValue(game);
            expect(() => gateway.handleAddBot(client, payload)).not.toThrow();
        });

        it('should emit an error if the game is locked', () => {
            const client = { id: 'client1' } as any;
            const payload = { isAgressive: true, gameId: 'game1' };
            const game = { gameId: 'game1', isLocked: true };

            newGameService.getGame.mockReturnValue(game);
            const emitMock = jest.fn();
            server.to.mockReturnValue({ emit: emitMock });

            gateway.handleAddBot(client, payload);

            expect(server.to).toHaveBeenCalledWith(client.id);
            expect(emitMock).toHaveBeenCalledWith(GAME_EVENTS.ON_ERROR, {
                errorMessage: 'La salle est verrouillée,vous ne pouvez plus rajouter de joueurs virtuels',
                shouldRedirect: false,
            });
        });

        it('should add a bot and emit UPDATE_LOBBY if the game is not locked', () => {
            const client = { id: 'client1' } as any;
            const payload = { isAgressive: false, gameId: 'game1' };
            const game = { gameId: 'game1', isLocked: false };

            newGameService.getGame.mockReturnValue(game);
            const emitMock = jest.fn();
            server.to.mockReturnValue({ emit: emitMock });

            gateway.handleAddBot(client, payload);

            expect(lobbyService.addBot).toHaveBeenCalledWith(payload.isAgressive, game);
            expect(server.to).toHaveBeenCalledWith(game.gameId);
            expect(emitMock).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, game);
        });
    });

    describe('handleLockRoom', () => {
        it('doit émettre forceLockRoom et UPDATE_LOBBY si lockRoom réussit', () => {
            const client = { id: 'client1', emit: jest.fn() } as any;
            const payload = { gameId: 'game1' };
            const game = { gameId: 'game1' };
            newGameService.getGame.mockReturnValue(game);
            lobbyService.lockRoom.mockReturnValue(true);

            gateway.handleLockRoom(client, payload);

            expect(lobbyService.lockRoom).toHaveBeenCalledWith(game, client.id);
            expect(server.emit).toHaveBeenCalledWith('forceLockRoom', { gameId: payload.gameId, target: 'form' });
            expect(server.to).toHaveBeenCalledWith(payload.gameId);
            const toObj = server.to.mock.results[server.to.mock.calls.length - 1].value;
            expect(toObj.emit).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, game);
        });

        it('doit émettre une erreur au client si lockRoom échoue', () => {
            const client = { id: 'client1', emit: jest.fn() } as any;
            const payload = { gameId: 'game1' };
            const game = { gameId: 'game1' };
            newGameService.getGame.mockReturnValue(game);
            lobbyService.lockRoom.mockReturnValue(false);

            gateway.handleLockRoom(client, payload);

            expect(client.emit).toHaveBeenCalledWith(LOBBY_EVENTS.ERROR, { errorMessage: 'Impossible de verrouiller la salle.' });
        });
    });

    describe('handleUnlockRoom', () => {
        it('doit émettre UPDATE_LOBBY si unlockRoom réussit', () => {
            const client = { emit: jest.fn() } as any;
            const payload = { gameId: 'game1' };
            const game = { gameId: 'game1' };
            newGameService.getGame.mockReturnValue(game);
            lobbyService.unlockRoom.mockReturnValue(true);

            gateway.handleUnlockRoom(client, payload);

            expect(lobbyService.unlockRoom).toHaveBeenCalledWith(game, client.id);
            expect(server.to).toHaveBeenCalledWith(payload.gameId);
            const toObj = server.to.mock.results[server.to.mock.calls.length - 1].value;
            expect(toObj.emit).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, game);
        });

        it('doit émettre une erreur si unlockRoom échoue', () => {
            const client = { emit: jest.fn() } as any;
            const payload = { gameId: 'game1' };
            const game = { gameId: 'game1' };
            newGameService.getGame.mockReturnValue(game);
            lobbyService.unlockRoom.mockReturnValue(false);

            gateway.handleUnlockRoom(client, payload);

            expect(client.emit).toHaveBeenCalledWith(LOBBY_EVENTS.ERROR, {
                message: 'Impossible de déverrouiller la salle. Le nombre de joueurs maximal a été atteint',
                shouldRedirect: false,
            });
        });
    });

    describe('handleKickPlayer', () => {
        it('doit retirer le joueur et émettre PLAYER_KICKED et UPDATE_LOBBY', () => {
            const payload = { gameId: 'game1', targetSocketId: 'target1' };
            const game = {
                gameId: 'game1',
                players: [
                    { socketId: 'target1', name: 'Player1' },
                    { socketId: 'other', name: 'Player2' },
                ],
                selectedAvatars: { target1: 2 },
                playerTurns: ['target1', 'other'],
            };
            newGameService.getGame.mockReturnValue(game);

            gateway.handleKickPlayer(payload);
            expect(server.to).toHaveBeenCalledWith(payload.targetSocketId);
            const toKick = server.to.mock.results[0].value;
            expect(toKick.emit).toHaveBeenCalledWith(LOBBY_EVENTS.PLAYER_KICKED, {
                message: "Vous avez été exclu de la partie par l'organisateur. Vous allez être redirigé vers l'accueil.",
                shouldRedirect: true,
            });

            expect(game.selectedAvatars).toEqual({});
            expect(game.playerTurns).toEqual(['other']);

            const toGame = server.to.mock.results[1].value;
            expect(toGame.emit).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, game);
        });
    });

    describe('handleSelectAvatar', () => {
        it("doit retourner { success: false } si l'avatar est déjà sélectionné", () => {
            const client = { id: 'client1' } as any;
            const payload = { gameId: 'game1', avatar: 1 };
            const game = { gameId: 'game1', selectedAvatars: { client1: 1 } };
            newGameService.getGame.mockReturnValue(game);

            const result = gateway.handleSelectAvatar(client, payload);
            expect(result).toEqual({ success: false });
        });

        it("doit désélectionner l'avatar précédent, définir le nouvel avatar, émettre UPDATE_LOBBY et retourner { success: true }", () => {
            const client = { id: 'client1', join: jest.fn(), leave: jest.fn() } as any;
            const payload = { gameId: 'game1', avatar: 2 };
            const game = { gameId: 'game1', selectedAvatars: { client1: 1 } };
            newGameService.getGame.mockReturnValue(game);

            const spy = jest.spyOn(gateway, 'handleDeselectAvatar').mockReturnValue({ success: true });
            const result = gateway.handleSelectAvatar(client, payload);

            expect(spy).toHaveBeenCalledWith(client, { gameId: payload.gameId });
            expect(game.selectedAvatars[client.id]).toBe(payload.avatar);
            expect(server.to).toHaveBeenCalledWith(payload.gameId);

            let toObj = server.to.mock.results[server.to.mock.calls.length - 2].value;
            expect(toObj.emit).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, game);
            toObj = server.to.mock.results[server.to.mock.calls.length - 1].value;
            expect(toObj.emit).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, game);
            expect(result).toEqual({ success: true });
            spy.mockRestore();
        });
    });

    describe('handleDeselectAvatar', () => {
        it("doit supprimer l'avatar sélectionné et émettre UPDATE_LOBBY", () => {
            const client = { id: 'client1' } as any;
            const payload = { gameId: 'game1' };
            const game = { gameId: 'game1', selectedAvatars: { client1: 2 } };
            newGameService.getGame.mockReturnValue(game);

            const result = gateway.handleDeselectAvatar(client, payload);
            expect(game.selectedAvatars[client.id]).toBeUndefined();
            expect(server.to).toHaveBeenCalledWith(payload.gameId);
            let toObj = server.to.mock.results[server.to.mock.calls.length - 2].value;
            expect(toObj.emit).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, game);
            toObj = server.to.mock.results[server.to.mock.calls.length - 1].value;
            expect(toObj.emit).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, game);
            expect(result).toEqual({ success: true });
        });

        it("doit émettre UPDATE_LOBBY même si aucun avatar n'est sélectionné", () => {
            const client = { id: 'client1' } as any;
            const payload = { gameId: 'game1' };
            const game = { gameId: 'game1', selectedAvatars: {} };
            newGameService.getGame.mockReturnValue(game);

            const result = gateway.handleDeselectAvatar(client, payload);
            expect(result).toEqual({ success: true });
        });
    });

    describe('handleDisconnect', () => {
        it("ne doit rien faire si la game n'est pas trouvée", () => {
            const client = { id: 'client1' } as any;
            newGameService.getGameByPlayer.mockReturnValue(null);
            expect(() => gateway.handleDisconnect(client)).not.toThrow();
        });
    });

    describe('handleDebug', () => {
        it('doit basculer le mode debug et émettre UPDATE_LOBBY, DEBUG et LOG', () => {
            const client = { id: 'client1' } as any;
            const payload = { gameId: 'game1' };
            const game = { gameId: 'game1', isInDebugMode: false };

            newGameService.getGame.mockReturnValue(game);
            newGameService.getPlayer.mockReturnValue({ name: 'TestPlayer', socketId: 'client1' });

            gateway.handleDebug(client, payload);
            expect(game.isInDebugMode).toBe(true);
            let message = 'Mode Débug activé';

            expect(server.to).toHaveBeenCalledWith(game.gameId);
            expect(server.to).toHaveBeenCalledTimes(3);

            const firstCall = server.to.mock.results[0].value;
            const secondCall = server.to.mock.results[1].value;
            const thirdCall = server.to.mock.results[2].value;

            expect(firstCall.emit).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, game);
            expect(secondCall.emit).toHaveBeenCalledWith(GAME_EVENTS.DEBUG, { message });
            expect(thirdCall.emit).toHaveBeenCalledWith(
                GAME_EVENTS.LOG,
                expect.objectContaining({
                    message,
                    players: ['TestPlayer'],
                    type: 'debug',
                }),
            );

            gateway.handleDebug(client, payload);
            expect(game.isInDebugMode).toBe(false);
            message = 'Mode Débug désactivé';

            const totalCalls = server.to.mock.results.length;
            const updateCall = server.to.mock.results[totalCalls - 3].value;
            const debugCall = server.to.mock.results[totalCalls - 2].value;
            const logCall = server.to.mock.results[totalCalls - 1].value;

            expect(updateCall.emit).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, game);
            expect(debugCall.emit).toHaveBeenCalledWith(GAME_EVENTS.DEBUG, { message });
            expect(logCall.emit).toHaveBeenCalledWith(
                GAME_EVENTS.LOG,
                expect.objectContaining({
                    message,
                    players: ['TestPlayer'],
                    type: 'debug',
                }),
            );
        });
    });

    describe('handleForceLockRoom', () => {
        it('doit émettre "forceLockRoom" sur la room', () => {
            const client = {} as any;
            const payload = { gameId: 'game1' };

            gateway.handleForceLockRoom(client, payload);
            expect(server.to).toHaveBeenCalledWith(payload.gameId);
            const toObj = server.to.mock.results[server.to.mock.calls.length - 1].value;
            expect(toObj.emit).toHaveBeenCalledWith('forceLockRoom');
        });
    });

    it('should emit ON_ERROR to all players and to admin if admin quits a non-started game', () => {
        const gameId = 'game1';
        const clientId = 'adminId';
        const mockClient: any = { id: clientId };

        const mockGame = {
            gameId,
            started: false,
            selectedAvatars: { [clientId]: 'avatarX' },
            players: [{ socketId: clientId, isAdmin: true }],
        };

        newGameService.getGame.mockReturnValue(mockGame);

        const result = gateway.handleQuitGame(mockClient, { gameId });

        expect(server.to).toHaveBeenCalledWith(gameId);
        expect(server.to(gameId).except).toHaveBeenCalledWith(clientId);
        expect(server.to(gameId).except().emit).toHaveBeenCalledWith(GAME_EVENTS.ON_ERROR, expect.any(Object));

        expect(server.to(clientId).emit).toHaveBeenCalledWith(GAME_EVENTS.ON_ERROR, expect.any(Object));
        expect(result).toEqual({ success: true });
    });
    it('should remove player and update lobby if non-admin quits a non-started game', () => {
        const gameId = 'game1';
        const clientId = 'userId';
        const mockClient: any = { id: clientId };

        const mockGame = {
            gameId,
            started: false,
            currentPlayerIndex: 0,
            selectedAvatars: { [clientId]: 'avatarX' },
            players: [{ socketId: clientId, isAdmin: false }],
        };

        newGameService.getGame.mockReturnValue(mockGame);

        const result = gateway.handleQuitGame(mockClient, { gameId });

        expect(lobbyService.removePlayer).toHaveBeenCalledWith(mockGame, clientId);
        expect(server.to(gameId).emit).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, mockGame);
        expect(server.to(gameId).emit).toHaveBeenCalledWith(GAME_EVENTS.PLAYER_TURN_CHANGED, mockGame.players[0]);
        expect(result).toEqual({ success: true });
    });
    it('should handle quit when game is started and player is not in combat', () => {
        const gameId = 'game1';
        const clientId = 'player1';
        const mockClient: any = { id: clientId };

        const player = { socketId: clientId, isMyTurn: true, isBot: false };
        const mockGame = {
            gameId,
            started: true,
            ended: false,
            players: [player],
            currentPlayerIndex: 0,
            selectedAvatars: { [clientId]: 'avatarX' },
            map: {},
            inactivePlayers: [],
        };

        newGameService.getGame.mockReturnValue(mockGame);
        newGameService.isPlayerInCombat.mockReturnValue(false);

        const result = gateway.handleQuitGame(mockClient, { gameId });

        expect(lobbyService.removePlayer).toHaveBeenCalledWith(mockGame, clientId);
        expect(turnService.turnBehaviour).toHaveBeenCalledWith(server, mockGame);
        expect(mockGame.inactivePlayers).toContain(player);
        expect(server.to(gameId).emit).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, mockGame);
        expect(result).toEqual({ success: true });
    });

    it('should handle player quitting during combat and emit COMBAT_ENDED with correct state', () => {
        const gameId = 'game1';
        const clientId = 'loserId';
        const mockClient: any = { id: clientId };

        const attacker = {
            socketId: 'attackerId',
            name: 'Attaquant',
            battlesWon: 2,
            totalDamageDone: 0,
            combatsParticipated: 0,
        };

        const target = {
            socketId: clientId,
            name: 'Défenseur',
            battlesLost: 0,
            totalDamageTaken: 0,
            isFlagHolder: true,
            position: { x: 1, y: 1 },
            startPosition: { x: 0, y: 0 },
            combatsParticipated: 0,
        };

        const combatState = {
            attacker,
            target,
            combatInitiator: target,
            combatAlreadyCounted: false,
        };

        const mockGame = {
            gameId,
            started: true,
            ended: false,
            players: [attacker, target],
            currentPlayerIndex: 1,
            inactivePlayers: [],
            map: {},
            selectedAvatars: { [clientId]: 'avatarY' },
        };

        const combatResult = {
            combatState,
            actionPlayer: attacker,
        };

        // Mocks
        newGameService.getGame.mockReturnValue(mockGame);
        newGameService.isPlayerInCombat.mockReturnValue(true);
        combatService.getCombatState = jest.fn().mockReturnValue(combatState);
        combatService.endCombat = jest.fn().mockReturnValue(combatResult);

        combatService.defaultHp = new Map([[clientId, 15]]); // simulate damage

        const result = gateway.handleQuitGame(mockClient, { gameId });

        expect(combatService.getCombatState).toHaveBeenCalledWith(gameId);
        expect(combatService.endCombat).toHaveBeenCalledWith(mockGame, attacker);

        expect(attacker.battlesWon).toBe(3);
        expect(mockGame.ended).toBe(true);
        expect(target.position).toEqual(target.startPosition);
        expect(target.isFlagHolder).toBe(false);
        expect(attacker.totalDamageDone).toBe(15);
        expect(target.totalDamageTaken).toBe(15);

        expect(server.to(gameId).emit).toHaveBeenCalledWith(
            COMBAT_EVENTS.COMBAT_ENDED,
            expect.objectContaining({
                combatState,
                actionPlayer: attacker,
                reason: REASON.DEATH,
                gameEnded: true,
            }),
        );

        expect(server.to(gameId).emit).toHaveBeenCalledWith(GAME_EVENTS.MAP_UPDATED, mockGame.map);
        expect(server.to(gameId).emit).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, mockGame);
        expect(server.to(gameId).emit).toHaveBeenCalledWith(
            GAME_EVENTS.LOG,
            expect.objectContaining({
                message: `Fin de combat : ${attacker.name} a vaincu ${target.name}`,
                players: [attacker.name, target.name],
            }),
        );

        expect(turnService.turnBehaviour).toHaveBeenCalledWith(server, mockGame);
        expect(result).toEqual({ success: true });
    });

    it('should return silently if player is not in any game', () => {
        const client: any = { id: 'noGamePlayer' };
        newGameService.getGameByPlayer.mockReturnValue(undefined);

        const result = gateway.handleDisconnect(client);

        expect(newGameService.getGameByPlayer).toHaveBeenCalledWith('noGamePlayer');
    });

    it('should call handleQuitGame if player is in a game', () => {
        const client: any = { id: 'player1' };
        const mockGame = { gameId: 'game1' };

        newGameService.getGameByPlayer.mockReturnValue(mockGame);

        const spy = jest.spyOn(gateway, 'handleQuitGame').mockReturnValue({ success: true });

        gateway.handleDisconnect(client);

        expect(newGameService.getGameByPlayer).toHaveBeenCalledWith('player1');
        expect(spy).toHaveBeenCalledWith(client, { gameId: 'game1' });
    });

    it('should handle player quitting combat where player is attacker (loser)', () => {
        const gameId = 'game1';
        const clientId = 'attackerId';
        const mockClient: any = { id: clientId };

        const attacker = {
            socketId: clientId,
            name: 'JoueurAttaquant',
            battlesWon: 0,
            totalDamageDone: 0,
            combatsParticipated: 0,
            isFlagHolder: true,
            position: { x: 3, y: 3 },
            startPosition: { x: 0, y: 0 },
        };

        const target = {
            socketId: 'targetId',
            name: 'JoueurCible',
            battlesWon: 2,
            totalDamageTaken: 0,
            totalDamageDone: 0,
            combatsParticipated: 0,
        };

        const combatState = {
            attacker,
            target,
            combatInitiator: attacker,
            combatAlreadyCounted: false,
        };

        const mockGame = {
            gameId,
            started: true,
            ended: false,
            players: [attacker, target],
            currentPlayerIndex: 0,
            inactivePlayers: [],
            selectedAvatars: { [clientId]: 'avatarX' },
            map: {},
        };

        const combatResult = {
            combatState,
            actionPlayer: target,
        };

        newGameService.getGame.mockReturnValue(mockGame);
        newGameService.isPlayerInCombat.mockReturnValue(true);
        combatService.getCombatState = jest.fn().mockReturnValue(combatState);
        combatService.endCombat = jest.fn().mockReturnValue(combatResult);

        combatService.defaultHp = new Map([[attacker.socketId, 20]]);

        const result = gateway.handleQuitGame(mockClient, { gameId });

        expect(combatService.getCombatState).toHaveBeenCalledWith(gameId);
        expect(combatService.endCombat).toHaveBeenCalledWith(mockGame, target);
        expect(target.battlesWon).toBe(3);
        expect(mockGame.ended).toBe(true);

        expect(attacker.position).toEqual(attacker.startPosition);
        expect(attacker.isFlagHolder).toBe(false);

        expect(target.totalDamageDone).toBe(20);

        expect(server.to(gameId).emit).toHaveBeenCalledWith(COMBAT_EVENTS.COMBAT_ENDED, expect.any(Object));
        expect(server.to(gameId).emit).toHaveBeenCalledWith(GAME_EVENTS.MAP_UPDATED, mockGame.map);
        expect(server.to(gameId).emit).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, mockGame);
        expect(server.to(gameId).emit).toHaveBeenCalledWith(
            GAME_EVENTS.LOG,
            expect.objectContaining({
                message: `Fin de combat : ${target.name} a vaincu ${attacker.name}`,
            }),
        );

        expect(turnService.turnBehaviour).toHaveBeenCalledWith(server, mockGame);
        expect(result).toEqual({ success: true });
    });

    it('should set originalHp to 0 if defaultHp does not contain loserS socketId', () => {
        const gameId = 'game1';
        const clientId = 'attackerId';
        const mockClient: any = { id: clientId };

        const attacker = {
            socketId: clientId,
            name: 'JoueurAttaquant',
            battlesWon: 0,
            totalDamageDone: 0,
            combatsParticipated: 0,
            isFlagHolder: false,
            position: { x: 3, y: 3 },
            startPosition: { x: 0, y: 0 },
            totalDamageTaken: 0,
        };

        const target = {
            socketId: 'targetId',
            name: 'JoueurCible',
            battlesWon: 2,
            totalDamageTaken: 0,
            combatsParticipated: 0,
            totalDamageDone: 0,
        };

        const combatState = {
            attacker,
            target,
            combatInitiator: attacker,
            combatAlreadyCounted: false,
        };

        const mockGame = {
            gameId,
            started: true,
            ended: false,
            players: [attacker, target],
            currentPlayerIndex: 0,
            inactivePlayers: [],
            selectedAvatars: { [clientId]: 'avatarX' },
            map: {},
        };

        const combatResult = {
            combatState,
            actionPlayer: target,
        };

        // Setup mocks
        newGameService.getGame.mockReturnValue(mockGame);
        newGameService.isPlayerInCombat.mockReturnValue(true);
        combatService.getCombatState = jest.fn().mockReturnValue(combatState);
        combatService.endCombat = jest.fn().mockReturnValue(combatResult);

        // 🟡 Ne pas définir loserS dans defaultHp map → originalHp = 0
        combatService.defaultHp = new Map(); // ← simulate missing HP info

        const result = gateway.handleQuitGame(mockClient, { gameId });

        // winner is target, loser is attacker
        expect(attacker.totalDamageTaken).toBe(0);
        expect(target.totalDamageDone).toBe(0);
        expect(result).toEqual({ success: true });
    });
    it('should return silently if game does not exist in handleKickPlayer', () => {
        const payload = { gameId: 'gameX', targetSocketId: 'playerY' };

        newGameService.getGame.mockReturnValue(undefined); // simulate jeu inexistant

        // Spy pour s'assurer que rien d'autre ne s'exécute
        const serverSpy = jest.spyOn(gateway.server, 'to');

        gateway.handleKickPlayer(payload);

        expect(newGameService.getGame).toHaveBeenCalledWith('gameX');
        expect(serverSpy).not.toHaveBeenCalled(); // aucun emit ne doit être déclenché
    });
    it('should handle kick when playerTurns is undefined', () => {
        const payload = { gameId: 'game1', targetSocketId: 'targetId' };

        const mockGame = {
            gameId: 'game1',
            players: [{ socketId: 'targetId', name: 'ToKick' }],
            selectedAvatars: { targetId: 'avatarZ' },
            playerTurns: undefined, // ← ligne à couvrir
        };

        newGameService.getGame.mockReturnValue(mockGame);

        gateway.handleKickPlayer(payload);

        // Vérifie que le joueur a été retiré
        expect(mockGame.players.length).toBe(0);

        // Vérifie que l'avatar a été supprimé
        expect(mockGame.selectedAvatars.hasOwnProperty('targetId')).toBe(false);

        // Vérifie que l’emit PLAYER_KICKED a bien été envoyé
        expect(server.to('targetId').emit).toHaveBeenCalledWith(
            LOBBY_EVENTS.PLAYER_KICKED,
            expect.objectContaining({
                message: expect.stringContaining('exclu'),
                shouldRedirect: true,
            }),
        );

        // Vérifie que UPDATE_LOBBY a bien été envoyé
        expect(server.to('game1').emit).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, mockGame);
    });
});
