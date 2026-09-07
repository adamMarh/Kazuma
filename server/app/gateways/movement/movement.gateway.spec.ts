/* eslint-disable max-lines */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { ITEM_EVENTS } from '@common/socket-events/item.events';
import { LOBBY_EVENTS } from '@common/socket-events/lobby.events';
import { Socket } from 'socket.io';
import { MovementGateway } from './movement.gateway';

describe('MovementGateway', () => {
    let gateway: MovementGateway;
    let movementService: any;
    let newGameService: any;
    let turnService: any;
    let server: any;
    let itemService: any;
    beforeEach(() => {
        movementService = {
            getPossibleMovements: jest.fn(),
            findShortestPath: jest.fn(),
        };

        newGameService = {
            getGame: jest.fn(),
            getPlayer: jest.fn(),
            actionsPossible: jest.fn(),
            nextTurn: jest.fn(),
            checkTurn: jest.fn(),
        };

        turnService = {
            cancelTimers: jest.fn(),
            startTimers: jest.fn(),
            turnBehaviour: jest.fn(),
        };

        itemService = {
            removeItemEffect: jest.fn(),
            applyItemEffect: jest.fn(),
        };

        gateway = new MovementGateway(movementService, newGameService, turnService, itemService);

        server = {
            to: jest.fn().mockImplementation(() => ({
                emit: jest.fn(),
            })),
        };
        gateway.server = server;
    });

    it('should remove isFlagHolder if the dropped item is the flag', () => {
        const mockClient = { id: 'p1' } as Socket;

        const game = {
            gameId: 'game1',
            map: {
                items: [['empty'], ['empty']],
            },
            players: [],
        };

        const player = {
            socketId: 'p1',
            name: 'Player 1',
            inventory: ['flag'],
            isFlagHolder: true,
        };

        newGameService.getGame.mockReturnValue(game);
        newGameService.getPlayer.mockReturnValue(player);

        const mockEmit = jest.fn();
        server.to = jest.fn().mockReturnValue({ emit: mockEmit });

        gateway.handleDropItem(mockClient, {
            gameId: 'game1',
            position: { x: 0, y: 1 },
            itemType: 'flag',
        });

        expect(player.isFlagHolder).toBe(false);
        expect(game.map.items[1][0]).toBe('flag');
        expect(server.to).toHaveBeenCalledWith('game1');
    });

    describe('handlePossibleMovements', () => {
        it('should return possible movements when turn end condition is not met', () => {
            const client = { id: 'client1' } as any;
            const gameId = 'game1';
            const player = {
                socketId: 'client1',
                movementPoints: 1,
            };
            const game = {
                gameId,
                players: [player],
                playerTurns: ['client1'],
                currentPlayerIndex: 0,
            };
            newGameService.getGame.mockReturnValue(game);
            newGameService.actionsPossible.mockReturnValue(true);
            newGameService.checkTurn.mockReturnValue(false);
            const expectedMovements = ['move1', 'move2'];
            movementService.getPossibleMovements.mockReturnValue(expectedMovements);

            const result = gateway.handlePossibleMovements(client, { gameId });

            expect(movementService.getPossibleMovements).toHaveBeenCalledWith(player, game);
            expect(result).toEqual(expectedMovements);
        });

        it('should return undefined when player is not found', () => {
            const client = { id: 'player1' } as any;
            const gameId = 'game1';
            const game = {
                gameId,
                players: [
                    {
                        socketId: 'otherPlayer',
                        movementPoints: 0,
                        name: '',
                        avatar: '',
                        speed: 0,
                        defense: 0,
                        attack: 0,
                        healthpoints: 0,
                        position: { x: 0, y: 0 },
                        startPosition: { x: 0, y: 0 },
                        fleeAttempts: 0,
                        battlesWon: 0,
                        inventory: [],
                        dice: { atk: 0, def: 0 },
                        isMyTurn: false,
                        actionPoints: 0,
                        visitedTiles: [],
                    },
                ],
                playerTurns: ['player1'],
                currentPlayerIndex: 0,
                map: { tiles: [] },
                isLocked: false,
                started: false,
                ended: false,
                maxPlayers: 0,
                startingPoints: [],
                selectedAvatars: undefined,
                isInDebugMode: false,
                startTime: new Date(),
            };

            newGameService.getGame.mockReturnValue(game);
            const result = gateway.handlePossibleMovements(client, { gameId });
            expect(result).toBeUndefined();
            expect(turnService.cancelTimers).not.toHaveBeenCalled();
        });

        it('should return undefined when movementPoints is string "0"', () => {
            const client = { id: 'player1' } as any;
            const gameId = 'game1';

            const game = {
                gameId,
                players: [
                    {
                        socketId: 'player1',
                        movementPoints: '0' as unknown as number,
                        name: '',
                        avatar: '',
                        speed: 0,
                        defense: 0,
                        attack: 0,
                        healthpoints: 0,
                        position: { x: 0, y: 0 },
                        startPosition: { x: 0, y: 0 },
                        fleeAttempts: 0,
                        battlesWon: 0,
                        inventory: [],
                        dice: { atk: 0, def: 0 },
                        isMyTurn: true,
                        actionPoints: 0,
                        visitedTiles: [],
                    },
                ],
                playerTurns: ['player1'],
                currentPlayerIndex: 0,
                map: { tiles: [] },
                isLocked: false,
                started: false,
                ended: false,
                maxPlayers: 0,
                startingPoints: [],
                selectedAvatars: undefined,
                isInDebugMode: false,
                startTime: new Date(),
            };

            newGameService.getGame.mockReturnValue(game);
            newGameService.actionsPossible.mockReturnValue(false);
            const result = gateway.handlePossibleMovements(client, { gameId });
            expect(turnService.cancelTimers).not.toHaveBeenCalled();
            expect(result).toBeUndefined();
        });

        it('should return undefined if game is not found', () => {
            const client = { id: 'player1' } as any;
            const gameId = 'game1';
            newGameService.getGame.mockReturnValue(null);
            const result = gateway.handlePossibleMovements(client, { gameId });
            expect(result).toBeUndefined();
            expect(newGameService.getGame).toHaveBeenCalledWith(gameId);
        });

        it('should return undefined if turnChanged is true', () => {
            const client = { id: 'player1' } as any;
            const game = {
                gameId: 'game1',
                players: [{ socketId: 'player1' }],
            };

            newGameService.getGame.mockReturnValue(game);
            newGameService.checkTurn.mockReturnValue(true);
            const result = gateway.handlePossibleMovements(client, { gameId: 'game1' });
            expect(newGameService.checkTurn).toHaveBeenCalledWith(server, game.players[0], game);
            expect(result).toBeUndefined();
            expect(movementService.getPossibleMovements).not.toHaveBeenCalled();
        });

        it('should return possible movements if turnChanged is false', () => {
            const client = { id: 'player1' } as any;
            const player = { socketId: 'player1' };
            const game = {
                gameId: 'game1',
                players: [player],
            };

            const possibleMoves = [
                { x: 1, y: 1 },
                { x: 2, y: 2 },
            ];

            newGameService.getGame.mockReturnValue(game);
            newGameService.checkTurn.mockReturnValue(false);
            movementService.getPossibleMovements.mockReturnValue(possibleMoves);
            const result = gateway.handlePossibleMovements(client, { gameId: 'game1' });
            expect(result).toEqual(possibleMoves);
            expect(movementService.getPossibleMovements).toHaveBeenCalledWith(player, game);
        });
    });

    describe('handleSkipTurn', () => {
        it('should cancel timer, go to next turn and emit UPDATE_LOBBY and PLAYER_TURN_CHANGED', () => {
            const payload = { gameId: 'game1' };
            const game = {
                gameId: 'game1',
                playerTurns: ['player1', 'player2'],
                currentPlayerIndex: 0,
            };
            newGameService.getGame.mockReturnValue(game);
            const emitMock = jest.fn();
            server.to = jest.fn().mockReturnValue({ emit: emitMock });
            gateway.handleSkipTurn(payload);
            expect(turnService.turnBehaviour).toHaveBeenCalledWith(server, game);
        });
    });

    describe('handleTurnChange', () => {
        it('should start timers and emit events via callbacks', () => {
            const payload = { gameId: 'game1' };
            const mockSocket = { id: 'player1' } as Socket;
            const game = {
                gameId: 'game1',
                playerTurns: ['player1', 'player2'],
                currentPlayerIndex: 0,
                players: [{ socketId: 'player1' }, { socketId: 'player2' }],
            };
            newGameService.getGame.mockReturnValue(game);

            const newPlayer = { socketId: 'player1' };
            newGameService.getPlayer.mockReturnValue(newPlayer);

            const emitMock = jest.fn();
            server.to = jest.fn().mockReturnValue({ emit: emitMock });
            gateway.handleTurnChange(mockSocket, payload);
        });

        it('should return early if game is not found', () => {
            const client = { id: 'player1' } as any;
            const payload = { gameId: 'game1' };
            newGameService.getGame.mockReturnValue(null);
            gateway.handleTurnChange(client, payload);
            expect(newGameService.getGame).toHaveBeenCalledWith(payload.gameId);
            expect(turnService.startTimers).not.toHaveBeenCalled();
        });
    });

    describe('handleGetShortestPath', () => {
        const client = { id: 'client1' } as any;
        const payload = { gameId: 'game1', targetPos: { x: 5, y: 10 } };

        it('should return [] if game is not found', () => {
            newGameService.getGame.mockReturnValue(null);
            const result = gateway.handleGetShortestPath(client, payload);
            expect(newGameService.getGame).toHaveBeenCalledWith(payload.gameId);
            expect(result).toEqual([]);
        });

        it('should call findShortestPath with undefined player if player is not found', () => {
            const game = { gameId: 'game1', map: { test: 'mapData' } };
            newGameService.getGame.mockReturnValue(game);
            newGameService.getPlayer.mockReturnValue(undefined);
            movementService.findShortestPath.mockReturnValue([]);

            const result = gateway.handleGetShortestPath(client, payload);
            expect(movementService.findShortestPath).toHaveBeenCalledWith(undefined, payload.targetPos, game, game.map);
            expect(result).toEqual([]);
        });

        it('should return shortest path provided by movementService', () => {
            const game = { gameId: 'game1', map: { some: 'mapData' } };
            const player = { socketId: 'client1' };
            const expectedPath = [
                { x: 0, y: 0 },
                { x: 5, y: 10 },
            ];

            newGameService.getGame.mockReturnValue(game);
            newGameService.getPlayer.mockReturnValue(player);
            movementService.findShortestPath.mockReturnValue(expectedPath);
            const result = gateway.handleGetShortestPath(client, payload);
            expect(newGameService.getGame).toHaveBeenCalledWith(payload.gameId);
            expect(newGameService.getPlayer).toHaveBeenCalledWith(client.id, game);
            expect(movementService.findShortestPath).toHaveBeenCalledWith(player, payload.targetPos, game, game.map);
            expect(result).toEqual(expectedPath);
        });
    });

    describe('handleDropItem', () => {
        const client = { id: 'player1' } as Socket;
        const payload = {
            gameId: 'game1',
            position: { x: 1, y: 2 },
            itemType: 'sword' as any,
        };

        let game: any;
        let player: any;
        let emitMock: jest.Mock;

        beforeEach(() => {
            player = {
                socketId: 'player1',
                inventory: ['sword', 'shield'],
            };

            game = {
                gameId: 'game1',
                map: {
                    items: [[], [], [{}, 'sword', 'potion']],
                },
            };

            newGameService.getGame.mockReturnValue(game);
            newGameService.getPlayer.mockReturnValue(player);

            emitMock = jest.fn();
            server.to = jest.fn().mockReturnValue({ emit: emitMock });

            itemService = {
                removeItemEffect: jest.fn(),
                applyItemEffect: jest.fn(),
            };

            gateway = new MovementGateway(movementService, newGameService, turnService, itemService);
            gateway.server = server;
        });

        it('should drop the same item if item in inventory equals the item on the map', () => {
            payload.itemType = 'sword';
            game.map.items[2][1] = 'sword';
            player.inventory = ['sword', 'shield'];

            gateway.handleDropItem(client, payload);

            expect(game.map.items[2][1]).toBe('sword');
            expect(itemService.removeItemEffect).not.toHaveBeenCalled();
            expect(itemService.applyItemEffect).not.toHaveBeenCalled();
            expect(emitMock).toHaveBeenCalledWith(GAME_EVENTS.MAP_UPDATED, game.map);
            expect(emitMock).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, game);
        });

        it('should swap the item if item in inventory is different from item on the map', () => {
            payload.itemType = 'shield';
            game.map.items[2][1] = 'potion';
            player.inventory = ['sword', 'shield'];
            gateway.handleDropItem(client, payload);

            expect(player.inventory[1]).toBe('potion');
            expect(game.map.items[2][1]).toBe('shield');
            expect(itemService.removeItemEffect).toHaveBeenCalledWith(player, 'shield');
            expect(itemService.applyItemEffect).toHaveBeenCalledWith(player, 'potion');
            expect(emitMock).toHaveBeenCalledWith(ITEM_EVENTS.ITEM_EFFECT_REMOVED, {
                playerId: player.socketId,
                itemType: 'shield',
            });
            expect(emitMock).toHaveBeenCalledWith(ITEM_EVENTS.ITEM_EFFECT_APPLIED, {
                playerId: player.socketId,
                itemType: 'potion',
            });
            expect(emitMock).toHaveBeenCalledWith(GAME_EVENTS.MAP_UPDATED, game.map);
            expect(emitMock).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, game);
        });

        it('should not crash if item is not found in inventory (defensive)', () => {
            payload.itemType = 'bow';
            game.map.items[2][1] = 'potion';
            player.inventory = ['sword', 'shield'];

            gateway.handleDropItem(client, payload);
            expect(emitMock).toHaveBeenCalledWith(GAME_EVENTS.MAP_UPDATED, game.map);
            expect(emitMock).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, game);
        });
    });
});
