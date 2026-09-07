/* eslint-disable max-lines */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { COMBAT_EVENTS } from '@common/socket-events/combat.events';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { ITEM_EVENTS } from '@common/socket-events/item.events';
import { MOVEMENT_EVENTS } from '@common/socket-events/movement.events';
import { Socket } from 'socket.io';
import { ClickGateway } from './click.gateway';

describe('ClickGateway', () => {
    let clickGateway: ClickGateway;
    let movementService: any;
    let newGameService: any;
    let combatService: any;
    let turnService: any;
    let server: any;

    beforeEach(() => {
        movementService = {
            findShortestPath: jest.fn(),
            movePlayer: jest.fn(),
        };

        newGameService = {
            getGame: jest.fn(),
            getPlayer: jest.fn(),
            handleAction: jest.fn(),
            getInformation: jest.fn(),
        };

        combatService = {
            getCombatState: jest.fn(),
        };

        turnService = {
            pauseTimers: jest.fn(),
        };

        clickGateway = new ClickGateway(movementService, newGameService, combatService, turnService);

        const toFn = jest.fn().mockReturnValue({
            emit: jest.fn(),
        });
        server = {
            to: toFn,
        };
        clickGateway.server = server;
    });

    describe('handleLeftClick', () => {
        let client: Socket;
        let payload: any;
        let game: any;
        let player: any;

        beforeEach(() => {
            client = { id: 'client1' } as any;
            payload = {
                targetPos: { x: 1, y: 2 },
                isAction: true,
                gameId: 'game1',
            };
            game = {
                gameId: 'game1',
                map: {
                    tiles: [
                        ['floor', 'floor'],
                        ['floor', 'floor'],
                        ['floor', 'doorOpen'],
                    ],
                },
                players: [{ socketId: 'client1', name: 'Player1' }],
            };
            player = { socketId: 'client1', name: 'Player1' };
            newGameService.getGame.mockReturnValue(game);
            newGameService.getPlayer.mockReturnValue(player);
        });

        it('should handle the left click in action mode with an action of type "door"', () => {
            newGameService.handleAction.mockReturnValue({ type: 'door' });

            clickGateway.handleLeftClick(client, payload);

            expect(server.to).toHaveBeenCalledWith(payload.gameId);
            expect(server.to).toHaveBeenCalledTimes(3);

            const firstCall = server.to.mock.results[0].value;
            const secondCall = server.to.mock.results[1].value;
            const thirdCall = server.to.mock.results[2].value;

            expect(firstCall.emit).toHaveBeenCalledWith(MOVEMENT_EVENTS.DOOR_OPEN, game.map);

            expect(secondCall.emit).toHaveBeenCalledWith(GAME_EVENTS.ACTION_ENDED, { player, players: game.players });

            const newTileState = game.map.tiles[payload.targetPos.y][payload.targetPos.x];
            const logMessage = newTileState === 'doorOpen' ? 'Ouverture de porte' : 'Fermeture de porte';
            const expectedLogEntry = expect.objectContaining({
                message: logMessage,
                players: [player.name],
                type: 'door',
            });
            expect(thirdCall.emit).toHaveBeenCalledWith(GAME_EVENTS.LOG, expectedLogEntry);
        });

        it('should handle the left click in action mode with an action not "door"', () => {
            newGameService.handleAction.mockReturnValue({ type: 'attack' });

            combatService.getCombatState.mockReturnValue({
                attacker: { name: 'Attacker', socketId: 'attacker1' },
                target: { name: 'Target', socketId: 'target1' },
            });

            clickGateway.handleLeftClick(client, payload);

            expect(turnService.pauseTimers).toHaveBeenCalledWith(payload.gameId);
            expect(combatService.getCombatState).toHaveBeenCalledWith(game.gameId);
            expect(server.to).toHaveBeenCalledWith(game.gameId);
            const toReturn = server.to.mock.results[0].value;
            expect(toReturn.emit).toHaveBeenCalledWith(COMBAT_EVENTS.COMBAT_STARTED, {
                combatState: {
                    attacker: { name: 'Attacker', socketId: 'attacker1' },
                    target: { name: 'Target', socketId: 'target1' },
                },
            });

            expect(server.to).toHaveBeenCalledWith(game.gameId);
            const secondCall = server.to.mock.results[1].value;
            expect(secondCall.emit).toHaveBeenCalledWith(
                GAME_EVENTS.LOG,
                expect.objectContaining({
                    message: 'Début de combat entre Attacker et Target',
                    type: 'combat',
                }),
            );
        });

        it('should handle the left click in movement mode', () => {
            payload.isAction = false;
            const path = [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
            ];
            movementService.findShortestPath.mockReturnValue(path);
            movementService.movePlayer.mockReturnValue({
                player,
                mapUpdated: false,
                inventoryFull: false,
                encounteredItem: null,
                effectivePath: path,
            });

            clickGateway.handleLeftClick(client, payload);

            expect(movementService.findShortestPath).toHaveBeenCalledWith(player, payload.targetPos, game, game.map);
            expect(movementService.movePlayer).toHaveBeenCalledWith(player, path, false, game);
            expect(server.to).toHaveBeenCalledWith(payload.gameId);
            const toReturn = server.to.mock.results[0].value;
        });

        it('should handle the case when handleAction returns an error message', () => {
            const client = { id: 'client1' } as Socket;
            const payload = {
                targetPos: { x: 0, y: 0 },
                isAction: true,
                gameId: 'game1',
            };
            const game = {
                gameId: 'game1',
                players: [{ socketId: 'client1', name: 'Player1' }],
                map: { tiles: [['doorClose']] },
            };
            const player = { socketId: 'client1', name: 'Player1' };

            newGameService.getGame.mockReturnValue(game);
            newGameService.getPlayer.mockReturnValue(player);
            newGameService.handleAction.mockReturnValue({ message: 'Action not allowed' });

            const emitMock = jest.fn();
            server.to = jest.fn().mockReturnValue({ emit: emitMock });

            clickGateway.handleLeftClick(client, payload);

            expect(server.to).toHaveBeenCalledWith(client.id);
            expect(emitMock).toHaveBeenCalledWith(GAME_EVENTS.ON_ERROR, {
                errorMessage: 'Action not allowed',
                shouldRedirect: false,
            });
            expect(server.to).toHaveBeenCalledTimes(1);
        });

        it('should emit a log entry when a player picks up an item', () => {
            const client = { id: 'client1' } as Socket;
            const payload = {
                targetPos: { x: 1, y: 2 },
                isAction: false,
                gameId: 'game1',
            };

            const player = { socketId: 'client1', name: 'Player1' };
            const game = {
                gameId: 'game1',
                map: {
                    tiles: [
                        ['floor', 'floor'],
                        ['floor', 'floor'],
                    ],
                },
                players: [player],
            };

            newGameService.getGame.mockReturnValue(game);
            newGameService.getPlayer.mockReturnValue(player);

            const path = [
                { x: 0, y: 0 },
                { x: 1, y: 2 },
            ];
            movementService.findShortestPath.mockReturnValue(path);
            movementService.movePlayer.mockReturnValue({
                player,
                mapUpdated: true,
                inventoryFull: false,
                encounteredItem: { type: 'flag' },
                effectivePath: path,
            });

            jest.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('14:00:00');
            const emitMock = jest.fn();
            server.to = jest.fn().mockReturnValue({ emit: emitMock });
            clickGateway.handleLeftClick(client, payload);
            const expectedLog = {
                timestamp: '14:00:00',
                message: 'Player1 a ramassé flag',
                players: ['Player1'],
                type: 'item_pickup',
            };

            const logCall = emitMock.mock.calls.find(
                ([eventName, payload]) =>
                    eventName === GAME_EVENTS.LOG && payload.message === expectedLog.message && payload.type === expectedLog.type,
            );

            expect(logCall).toBeDefined();
            expect(logCall?.[1]).toMatchObject(expectedLog);
        });

        it('should emit CHOOSE_ITEM event when player inventory is full', () => {
            const client = { id: 'client1' } as Socket;
            const payload = {
                targetPos: { x: 1, y: 1 },
                isAction: false,
                gameId: 'game1',
            };

            const player = { socketId: 'client1', name: 'Player1' };
            const game = {
                gameId: 'game1',
                map: {
                    tiles: [
                        ['floor', 'floor'],
                        ['floor', 'floor'],
                    ],
                },
                players: [player],
            };

            newGameService.getGame.mockReturnValue(game);
            newGameService.getPlayer.mockReturnValue(player);

            const path = [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
            ];
            const encounteredItem = { type: 'potion' };

            movementService.findShortestPath.mockReturnValue(path);
            movementService.movePlayer.mockReturnValue({
                player,
                mapUpdated: false,
                inventoryFull: true,
                encounteredItem,
                effectivePath: path,
            });

            const emitMock = jest.fn();
            server.to = jest.fn().mockReturnValue({ emit: emitMock });

            clickGateway.handleLeftClick(client, payload);

            expect(server.to).toHaveBeenCalledWith(client.id);
            expect(emitMock).toHaveBeenCalledWith(ITEM_EVENTS.CHOOSE_ITEM, {
                item: encounteredItem,
            });
        });

        it('should emit MAP_UPDATED and ITEM_EFFECT_APPLIED events when map is updated', () => {
            const client = { id: 'client1' } as Socket;
            const payload = {
                targetPos: { x: 1, y: 1 },
                isAction: false,
                gameId: 'game1',
            };

            const player = { socketId: 'client1', name: 'Player1' };
            const game = {
                gameId: 'game1',
                map: {
                    tiles: [
                        ['floor', 'floor'],
                        ['floor', 'floor'],
                    ],
                },
                players: [player],
            };

            newGameService.getGame.mockReturnValue(game);
            newGameService.getPlayer.mockReturnValue(player);
            const encounteredItem = { type: 'key' };

            movementService.findShortestPath.mockReturnValue([
                { x: 0, y: 0 },
                { x: 1, y: 1 },
            ]);
            movementService.movePlayer.mockReturnValue({
                player,
                mapUpdated: true,
                inventoryFull: false,
                encounteredItem,
                effectivePath: [],
            });

            const emitMock = jest.fn();
            server.to = jest.fn().mockReturnValue({ emit: emitMock });
            clickGateway.handleLeftClick(client, payload);
            expect(server.to).toHaveBeenCalledWith('game1');
            expect(emitMock).toHaveBeenCalledWith(GAME_EVENTS.MAP_UPDATED, game.map);
            expect(emitMock).toHaveBeenCalledWith(ITEM_EVENTS.ITEM_EFFECT_APPLIED, {
                playerId: player.socketId,
                itemType: encounteredItem.type,
            });
        });

        it('should emit "Fermeture de porte" when door is closed', () => {
            const client = { id: 'client1' } as Socket;
            const payload = {
                targetPos: { x: 1, y: 0 },
                isAction: true,
                gameId: 'game1',
            };

            const player = { socketId: 'client1', name: 'Player1' };
            const game = {
                gameId: 'game1',
                map: {
                    tiles: [['floor', 'doorClose']],
                },
                players: [player],
            };

            newGameService.getGame.mockReturnValue(game);
            newGameService.getPlayer.mockReturnValue(player);
            newGameService.handleAction.mockReturnValue({ type: 'door' });

            const emitMock = jest.fn();
            server.to = jest.fn().mockReturnValue({ emit: emitMock });

            jest.spyOn(global.Date.prototype, 'toLocaleTimeString').mockReturnValue('15:00:00');

            clickGateway.handleLeftClick(client, payload);

            expect(server.to).toHaveBeenCalledWith(payload.gameId);
            expect(emitMock).toHaveBeenCalledWith(GAME_EVENTS.LOG, {
                timestamp: '15:00:00',
                message: 'Fermeture de porte',
                players: ['Player1'],
                type: 'door',
            });
        });
    });

    describe('handleRightClick', () => {
        let payload: any;
        let game: any;
        let tile: any;

        beforeEach(() => {
            payload = {
                position: { x: 3, y: 4 },
                gameId: 'game2',
                myPlayer: { socketId: 'player1', isMyTurn: true, position: { x: 0, y: 0 } },
            };
            game = {
                gameId: 'game2',
                isInDebugMode: true,
                players: [
                    { socketId: 'player1', position: { x: 0, y: 0 } },
                    { socketId: 'player2', position: { x: 1, y: 1 } },
                ],
            };
            tile = {
                tileType: 'floor',
                itemType: 'checkpoint',
                playerAvatar: null,
            };
            newGameService.getGame.mockReturnValue(game);
            newGameService.getInformation.mockReturnValue(tile);
        });

        it("should handle the right click in debug mode, when it's the player's turn and the condition is met", () => {
            payload.myPlayer.isMyTurn = true;
            tile.tileType = 'floor';
            tile.itemType = 'checkpoint';
            tile.playerAvatar = null;

            clickGateway.handleRightClick(payload);

            const updatedPlayer = { ...payload.myPlayer, position: payload.position };
            const updatedPlayers = game.players.map((p) => (p.socketId === updatedPlayer.socketId ? updatedPlayer : p));
            expect(server.to).toHaveBeenCalledWith(game.gameId);
            const toReturn = server.to.mock.results[0].value;
            expect(toReturn.emit).toHaveBeenCalledWith(GAME_EVENTS.ACTION_ENDED, {
                player: updatedPlayer,
                players: updatedPlayers,
            });
        });

        it("should handle the right click in debug mode, when it's the player's turn but the condition is not met", () => {
            payload.myPlayer.isMyTurn = true;
            tile.tileType = 'wall';
            tile.itemType = 'other';
            tile.playerAvatar = true;

            const result = clickGateway.handleRightClick(payload);

            expect(server.to).not.toHaveBeenCalled();
            expect(result).toBeUndefined();
        });

        it("should handle the right click in debug mode, when it's not the player's turn", () => {
            payload.myPlayer.isMyTurn = false;
            const tileInfo = { tileType: 'floor', itemType: 'other' };
            newGameService.getInformation.mockReturnValue(tileInfo);

            const result = clickGateway.handleRightClick(payload);

            expect(result).toEqual(tileInfo);
        });

        it('should handle the right click in non-debug mode', () => {
            game.isInDebugMode = false;
            const tileInfo = { tileType: 'floor', itemType: 'other' };
            newGameService.getInformation.mockReturnValue(tileInfo);
            const result = clickGateway.handleRightClick(payload);
            expect(result).toEqual(tileInfo);
        });
    });
});
