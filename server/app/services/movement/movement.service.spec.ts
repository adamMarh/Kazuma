/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-magic-numbers */
import { Game } from '@common/interfaces/game.interface';
import { Map as GameMap } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/interfaces/position.interface';
import { MovementService } from './movement.service';

describe('MovementService', () => {
    let service: MovementService;
    let game: Game;
    let player1: Player;
    let player2: Player;
    let gameMap: GameMap;

    const createPlayer = (overrides = {}): Player => ({
        socketId: 'p1',
        name: 'Player 1',
        avatar: 'avatar1.png',
        speed: 5,
        defense: 3,
        attack: 4,
        healthpoints: 20,
        position: { x: 1, y: 1 },
        startPosition: { x: 1, y: 1 },
        fleeAttempts: 0,
        battlesWon: 0,
        inventory: [],
        isInventoryFull: false,
        dice: { atk: 6, def: 6 },
        isMyTurn: false,
        movementPoints: 3,
        actionPoints: 3,
        ...overrides,
    });

    const createGameMap = (tiles: string[][], items: string[][]): GameMap => ({
        _id: 'map1',
        name: 'Test Map',
        size: '3x3',
        gameMode: 'test',
        description: 'Une carte pour tester',
        lastSave: new Date(),
        imageUrl: 'url',
        hidden: false,
        tiles,
        items,
        nbCheckpoints: '3',
        nbRandomItems: '5',
    });

    const createGame = (players: Player[], map: GameMap, startingPoints: Position[]): Game =>
        ({
            gameId: 'game1',
            players,
            map,
            startingPoints,
            ended: false,
        }) as unknown as Game;

    beforeEach(() => {
        service = new MovementService();

        const tiles = [
            ['grass', 'grass', 'grass'],
            ['grass', 'water', 'grass'],
            ['grass', 'grass', 'grass'],
        ];
        const items = [
            ['checkpoint', 'item2', 'item3'],
            ['item4', 'checkpoint', 'item6'],
            ['item7', 'item8', 'checkpoint'],
        ];
        gameMap = createGameMap(tiles, items);
        player1 = createPlayer({ socketId: 'p1', position: { x: 1, y: 1 }, startPosition: { x: 1, y: 1 } });
        player2 = createPlayer({ socketId: 'p2', name: 'Player 2', position: { x: 0, y: 0 }, startPosition: { x: 0, y: 0 } });
        game = createGame([player1, player2], gameMap, [
            { x: 0, y: 0 },
            { x: 2, y: 2 },
        ]);
    });

    it('should return empty array if destination key is not in paths', () => {
        const targetPos: Position = { x: 2, y: 2 };

        jest.spyOn<any, any>(service, 'calculatePaths').mockReturnValue(new Map());

        const result = service.findShortestPath(player1, targetPos, game, gameMap);
        expect(result).toEqual([]);
    });

    it('should skip tiles where newCost exceeds maxCost', () => {
        const start: Position = { x: 1, y: 1 };
        const maxCost = 1;

        const tiles = [
            ['grass', 'grass', 'grass'],
            ['grass', 'grass', 'grass'],
            ['grass', 'grass', 'grass'],
        ];

        const items = [
            ['empty', 'empty', 'empty'],
            ['empty', 'empty', 'empty'],
            ['empty', 'empty', 'empty'],
        ];

        gameMap = {
            ...gameMap,
            tiles,
            items,
        };

        jest.spyOn(service as any, 'getTileCost').mockReturnValue(999);
        const result = (service as any).calculatePaths(start, gameMap, maxCost, new Set(), player1);

        expect(result.size).toBe(1);
        expect(result.get('1,1')).toBeDefined();
    });

    describe('getPossibleMovements', () => {
        it('doit retourner les positions accessibles en excluant la position de départ', () => {
            player1.movementPoints = 3;
            const positions = service.getPossibleMovements(player1, game);
            expect(positions).not.toContainEqual(player1.position);
            positions.forEach((pos) => {
                expect(typeof pos.x).toBe('number');
                expect(typeof pos.y).toBe('number');
            });
        });
    });
    it('returns open door cost if player has compas and tile is doorClose', () => {
        const pos = { x: 0, y: 0 };
        const map = {
            tiles: [['doorClose']],
            items: [['empty']],
        } as any;
        const player = { inventory: ['compas'] } as Player;

        const cost = (service as any).getTileCost(pos, map, player);
        expect(cost).toBe(1);
    });

    it('returns early if no itemPosition is provided', () => {
        const result = (service as any).handleItemCollection(player1, game, null, 'sword');
        expect(result).toEqual({
            mapUpdated: false,
            inventoryFull: false,
            encounteredItem: null,
        });
    });

    it('returns early if player inventory is full', () => {
        player1.isInventoryFull = true;
        const result = (service as any).handleItemCollection(player1, game, { x: 0, y: 0 }, 'shield');
        expect(result).toEqual({
            mapUpdated: false,
            inventoryFull: true,
            encounteredItem: { position: { x: 0, y: 0 }, type: 'shield' },
        });
    });

    it('sets isFlagHolder to true if item is flag', () => {
        const pos = { x: 0, y: 0 };
        game.map.items[pos.y][pos.x] = 'flag';

        const result = (service as any).handleItemCollection(player1, game, pos, 'flag');

        expect(player1.isFlagHolder).toBe(true);
        expect(result.mapUpdated).toBe(true);
    });

    it('applies item effect if itemService is defined', () => {
        const pos = { x: 0, y: 0 };
        game.map.items[pos.y][pos.x] = 'shield';

        const fakeItemService = {
            applyItemEffect: jest.fn(),
        };

        Object.defineProperty(service, 'itemService', {
            value: fakeItemService,
            writable: true,
        });

        (service as any).handleItemCollection(player1, game, pos, 'shield');

        expect(fakeItemService.applyItemEffect).toHaveBeenCalledWith(player1, 'shield');
    });

    it('should return nulls if no item is found on path', () => {
        const path = [
            { x: 0, y: 0 },
            { x: 0, y: 1 },
        ];
        game.map.items[0][0] = 'empty';
        game.map.items[1][0] = 'checkpoint';
        const result = (service as any).findFirstItemOnPath(path, game);
        expect(result).toEqual({ itemPosition: null, itemType: null });
    });

    describe('executeMovement', () => {
        it('should stop movement when movementPoints reaches 0', () => {
            const path: Position[] = [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 2, y: 0 },
            ];
            player1.movementPoints = 1;
            jest.spyOn<any, any>(service, 'getTileCost').mockReturnValue(1);

            const result = (service as any).executeMovement(player1, game, path);

            expect(result).toEqual([{ x: 0, y: 0 }]);
            expect(player1.position).toEqual({ x: 0, y: 0 });
            expect(player1.movementPoints).toBe(0);
        });
    });

    describe('checkWinCondition', () => {
        it('should set game.ended and game.winner if player returns to start with flag', () => {
            const redPlayer = createPlayer({
                socketId: 'p1',
                position: { x: 1, y: 1 },
                startPosition: { x: 1, y: 1 },
                inventory: ['flag'],
            });

            const testGame: Game = {
                ...game,
                players: [redPlayer],
                teams: {
                    red: ['p1'],
                    blue: [],
                },
            };

            (service as any).checkWinCondition(redPlayer, testGame);

            expect(testGame.ended).toBe(true);
            expect(testGame.winner).toBe('red');
        });

        it('should set winner team based on player position and inventory', () => {
            player1.position = { x: 1, y: 1 };
            player1.startPosition = { x: 1, y: 1 };
            player1.inventory = ['flag'];
            game.teams = { red: [player1.socketId], blue: [] };
            (service as any).checkWinCondition(player1, game);
            expect(game.ended).toBe(true);
            expect(game.winner).toBe('red');
        });

        it('should set winner to blue if player not in red team', () => {
            player1.position = { x: 1, y: 1 };
            player1.startPosition = { x: 1, y: 1 };
            player1.inventory = ['flag'];
            game.teams = { red: [], blue: [player1.socketId] };
            (service as any).checkWinCondition(player1, game);
            expect(game.winner).toBe('blue');
        });
    });

    it('should return true if tile is doorClose and player has compas', () => {
        const pos: Position = { x: 1, y: 1 };

        const customMap: GameMap = {
            ...gameMap,
            tiles: [
                ['grass', 'grass', 'grass'],
                ['grass', 'doorClose', 'grass'],
                ['grass', 'grass', 'grass'],
            ],
        };

        const mockCompasService = { canUseCompas: jest.fn().mockReturnValue(true) };

        Object.defineProperty(service, 'itemService', {
            value: mockCompasService,
            writable: true,
        });

        const result = (service as any).isValidMove(pos, customMap, undefined, player1);
        expect(result).toBe(true);
        expect(mockCompasService.canUseCompas).toHaveBeenCalledWith(player1);
    });

    describe('isAdjacent', () => {
        it('should return true for adjacent positions', () => {
            expect(service.isAdjacent({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe(true);
            expect(service.isAdjacent({ x: 1, y: 1 }, { x: 0, y: 1 })).toBe(true);
        });

        it('should return false for non-adjacent positions', () => {
            expect(service.isAdjacent({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(false);
            expect(service.isAdjacent({ x: 2, y: 2 }, { x: 0, y: 0 })).toBe(false);
        });
    });

    describe('MovementService - findShortestPath', () => {
        let service: MovementService;
        let game: Game;
        let gameMap: GameMap;
        let player1: Player;
        let player2: Player;

        beforeEach(() => {
            service = new MovementService();

            gameMap = {
                _id: 'map1',
                name: 'Test Map',
                size: '3',
                gameMode: 'classic',
                description: 'Une map de test',
                lastSave: new Date(),
                imageUrl: 'http://example.com/map.png',
                hidden: false,
                tiles: [
                    ['grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass'],
                ],
                items: [
                    ['empty', 'empty', 'empty'],
                    ['empty', 'empty', 'empty'],
                    ['empty', 'empty', 'empty'],
                ],
                nbCheckpoints: '1',
                nbRandomItems: '0',
            };

            player1 = {
                socketId: 'player1',
                name: 'Alice',
                avatar: '1',
                speed: 10,
                defense: 5,
                attack: 7,
                healthpoints: 20,
                position: { x: 0, y: 0 },
                startPosition: { x: 0, y: 0 },
                battlesWon: 0,
                inventory: [],
                isInventoryFull: false,
                isAdmin: false,
                dice: { atk: 2, def: 1 },
                isMyTurn: true,
                movementPoints: 10,
                actionPoints: 1,
                fleeAttempts: 0,
            };
            player2 = {
                socketId: 'player2',
                name: 'Bob',
                avatar: '2',
                speed: 10,
                defense: 5,
                attack: 7,
                healthpoints: 20,
                position: { x: 2, y: 2 },
                startPosition: { x: 2, y: 2 },
                battlesWon: 0,
                inventory: [],
                isInventoryFull: false,
                isAdmin: false,
                dice: { atk: 2, def: 1 },
                isMyTurn: false,
                movementPoints: 10,
                actionPoints: 1,
                fleeAttempts: 0,
            };

            game = {
                gameId: 'game1',
                players: [player1, player2],
                inactivePlayers: [],
                map: gameMap,
                isLocked: false,
                started: false,
                ended: false,
                maxPlayers: 4,
                playerTurns: [player1.socketId, player2.socketId],
                currentPlayerIndex: 0,
                startingPoints: [{ x: 0, y: 0 }],
                selectedAvatars: { [player1.socketId]: 1, [player2.socketId]: 2 },
                isInDebugMode: false,
                teams: {
                    red: [],
                    blue: [],
                },
                winner: '',
            };
        });

        it('retourne [{ x: -1, y: -1 }] si la cible est (-1, -1)', () => {
            const target: Position = { x: -1, y: -1 };
            const path = service.findShortestPath(player1, target, game, gameMap);
            expect(path).toEqual([{ x: -1, y: -1 }]);
        });

        it('retourne un chemin court (sans la position de départ) si la destination est accessible', () => {
            const target: Position = { x: 0, y: 1 };
            const path = service.findShortestPath(player1, target, game, gameMap);
            expect(path.length).toBeGreaterThan(0);

            expect(path[path.length - 1]).toEqual(target);

            expect(path[0]).not.toEqual(player1.position);
        });

        it('retourne un chemin contenant la destination si la destination est inaccessible (exemple : mur)', () => {
            const wallTiles = [
                ['grass', 'grass', 'grass'],
                ['grass', 'wall', 'grass'],
                ['grass', 'grass', 'grass'],
            ];
            const wallMap: GameMap = {
                _id: 'map2',
                name: 'Wall Map',
                size: '3',
                gameMode: 'classic',
                description: 'Map avec un mur',
                lastSave: new Date(),
                imageUrl: 'http://example.com/wall.png',
                hidden: false,
                tiles: wallTiles,
                items: [
                    ['empty', 'empty', 'empty'],
                    ['empty', 'empty', 'empty'],
                    ['empty', 'empty', 'empty'],
                ],
                nbCheckpoints: '0',
                nbRandomItems: '0',
            };
            const target: Position = { x: 1, y: 0 };
            const path = service.findShortestPath(player1, target, game, wallMap);
            expect(path).toEqual([{ x: 1, y: 0 }]);
        });

        it('retourne un chemin vide si la destination est égale à la position de départ', () => {
            const target: Position = { ...player1.position };
            const path = service.findShortestPath(player1, target, game, gameMap);
            expect(path).toEqual([]);
        });
    });

    describe('calculatePaths et méthodes auxiliaires', () => {
        it("movementCost doit retourner le coût total d'un chemin", () => {
            const path: Position[] = [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 1, y: 1 },
            ];
            const cost = service.movementCost(path, gameMap);
            expect(cost).toBe(1 + 1 + 2);
        });

        it('parseKey convertit correctement une clé en Position', () => {
            const pos = service['parseKey']('3,4');
            expect(pos).toEqual({ x: 3, y: 4 });
        });
    });

    describe('isValidMove et getTileCost via calculatePaths', () => {
        it('ne permet pas un déplacement hors des limites de la map', () => {
            const paths = service['calculatePaths']({ x: 0, y: 0 }, gameMap, 10);
            expect(paths.has('-1,0')).toBe(false);
        });

        it("ne permet pas un déplacement sur une tuile infranchissable ('wall' ou 'doorClose')", () => {
            const wallTiles = [
                ['grass', 'grass'],
                ['grass', 'wall'],
            ];
            const wallMap = createGameMap(wallTiles, [
                ['a', 'b'],
                ['c', 'd'],
            ]);
            const start: Position = { x: 0, y: 0 };
            const paths = service['calculatePaths'](start, wallMap, 10);

            expect(paths.has('1,1')).toBe(false);
        });
    });

    describe('placePlayers', () => {
        it('affecte les positions de départ aux joueurs et met à jour les items de la map', () => {
            const gameCopy = JSON.parse(JSON.stringify(game));

            jest.spyOn(Math, 'random').mockReturnValue(0.1);
            service.placePlayers(gameCopy);
            gameCopy.players.forEach((player: Player, index: number) => {
                expect(player.position).toEqual(gameCopy.startingPoints[index]);
                expect(player.startPosition).toEqual(gameCopy.startingPoints[index]);
            });

            expect(gameCopy.map.items[0][0]).toBe('checkpoint');
            expect(gameCopy.map.items[0][1]).toBe('item2');
            expect(gameCopy.map.items[2][2]).toBe('checkpoint');
            jest.restoreAllMocks();
        });
    });

    describe('movePlayer et finalPosition', () => {
        it('utilise itemPosition si présent', () => {
            const path: Position[] = [
                { x: 0, y: 0 },
                { x: 0, y: 1 },
                { x: 1, y: 1 },
            ];
            const itemPosition = { x: 0, y: 1 };
            player1.movementPoints = 10;

            jest.spyOn<any, any>(service, 'findFirstItemOnPath').mockReturnValue({ itemPosition, itemType: 'shield' });

            const movedPlayer = service.movePlayer(player1, path, false, game);

            expect(movedPlayer.player.position).toEqual(itemPosition);
        });

        it('utilise la dernière position du chemin si itemPosition est null', () => {
            const path: Position[] = [
                { x: 0, y: 0 },
                { x: 0, y: 1 },
                { x: 1, y: 1 },
            ];
            player1.movementPoints = 10;

            jest.spyOn<any, any>(service, 'findFirstItemOnPath').mockReturnValue({ itemPosition: null, itemType: null });

            const movedPlayer = service.movePlayer(player1, path, false, game);

            expect(movedPlayer.player.position).toEqual(path[path.length - 1]);
        });
    });

    describe('movementCost', () => {
        it('retourne 0 pour un chemin vide', () => {
            const cost = service.movementCost([], gameMap);
            expect(cost).toBe(0);
        });

        it('calcule le coût total pour un chemin sur différents types de tuiles', () => {
            const testTiles = [
                ['grass', 'water'],
                ['ice', 'doorOpen'],
            ];
            const testMap = createGameMap(testTiles, [
                ['a', 'b'],
                ['c', 'd'],
            ]);

            const path: Position[] = [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 0, y: 1 },
                { x: 1, y: 1 },
            ];
            const cost = service.movementCost(path, testMap);
            expect(cost).toBe(1 + 2 + 0 + 1);
        });
    });

    describe('findFirstItemOnPath', () => {
        it('retourne itemType depuis game.map.items si itemPos existe', () => {
            const path = [
                { x: 0, y: 0 },
                { x: 0, y: 1 },
            ];

            game.map.items[0][0] = 'shield';
            game.map.items[1][0] = 'empty';

            const result = (service as any).findFirstItemOnPath(path, game);

            expect(result.itemPosition).toEqual({ x: 0, y: 0 });
            expect(result.itemType).toBe('shield');
        });

        it('retourne itemType null si itemPos est null', () => {
            const path = [
                { x: 0, y: 0 },
                { x: 0, y: 1 },
            ];

            game.map.items[0][0] = 'empty';
            game.map.items[1][0] = 'empty';

            const result = (service as any).findFirstItemOnPath(path, game);

            expect(result.itemPosition).toBeNull();
            expect(result.itemType).toBeNull();
        });
    });
});
