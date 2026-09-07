/* eslint-disable @typescript-eslint/no-magic-numbers */
import { Game } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { EndGameService } from './end-game.service';

describe('EndGameService', () => {
    let service: EndGameService;

    const createPlayer = (overrides: Partial<Player> = {}): Player => ({
        socketId: '',
        name: '',
        avatar: '',
        speed: 0,
        defense: 0,
        attack: 0,
        healthpoints: 0,
        position: undefined,
        startPosition: undefined,
        fleeAttempts: 0,
        battlesWon: 0,
        inventory: [],
        isInventoryFull: false,
        dice: { atk: 0, def: 0 },
        isMyTurn: false,
        movementPoints: 0,
        actionPoints: 0,
        visitedTiles: [],
        turnsPlayed: 0,
        ...overrides,
    });

    const createGame = (overrides: Partial<Game> = {}): Game => ({
        gameId: '',
        players: [],
        inactivePlayers: [],
        map: {
            tiles: [],
            name: '',
            size: '',
            gameMode: '',
            description: '',
            lastSave: undefined,
            imageUrl: '',
            hidden: false,
            items: [],
            nbCheckpoints: '',
            nbRandomItems: '',
        },
        isLocked: false,
        started: false,
        ended: false,
        maxPlayers: 0,
        playerTurns: [],
        currentPlayerIndex: 0,
        startingPoints: [],
        selectedAvatars: undefined,
        isInDebugMode: false,
        teams: {
            red: [],
            blue: [],
        },
        winner: '',
        startTime: new Date(),
        ...overrides,
    });

    beforeEach(() => {
        service = new EndGameService();
    });

    describe('calculateTilesVisitedPercentage', () => {
        it('should handle undefined visitedTiles', () => {
            const player = createPlayer({
                visitedTiles: undefined,
            });
            const mapTiles = [['grass']];
            expect(service.calculateTilesVisitedPercentage(player, mapTiles)).toBe(0);
        });

        it('should return 100% when all terrain tiles are visited', () => {
            const player = createPlayer({
                visitedTiles: [
                    { x: 0, y: 0 },
                    { x: 0, y: 1 },
                    { x: 1, y: 1 },
                ],
            });
            const mapTiles = [
                ['grass', 'wall'],
                ['ice', 'water'],
            ];
            expect(service.calculateTilesVisitedPercentage(player, mapTiles)).toBe(100);
        });

        it('should return 67% when 2 out of 3 terrain tiles are visited', () => {
            const player = createPlayer({
                visitedTiles: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
            });
            const mapTiles = [
                ['grass', 'wall'],
                ['ice', 'water'],
            ];
            expect(service.calculateTilesVisitedPercentage(player, mapTiles)).toBe(67);
        });

        it('should return 0% when no terrain tiles exist', () => {
            const player = createPlayer({ visitedTiles: [{ x: 0, y: 0 }] });
            const mapTiles = [
                ['wall', 'wall'],
                ['wall', 'wall'],
            ];
            expect(service.calculateTilesVisitedPercentage(player, mapTiles)).toBe(0);
        });

        it('should return 0% when no tiles are visited', () => {
            const player = createPlayer({ visitedTiles: [] });
            const mapTiles = [
                ['grass', 'water'],
                ['ice', 'wall'],
            ];
            expect(service.calculateTilesVisitedPercentage(player, mapTiles)).toBe(0);
        });
    });

    describe('calculateGameDuration', () => {
        it('should return formatted duration in minutes:seconds', () => {
            const game = createGame({
                startTime: new Date('2023-01-01T00:00:00'),
                endTime: new Date('2023-01-01T00:01:45'),
            });
            expect(service.calculateGameDuration(game)).toBe('1:45');
        });

        it('should pad single-digit seconds with leading zero', () => {
            const game = createGame({
                startTime: new Date('2023-01-01T00:00:00'),
                endTime: new Date('2023-01-01T00:02:05'),
            });
            expect(service.calculateGameDuration(game)).toBe('2:05');
        });

        it('should use current time if endTime is missing', () => {
            const now = Date.now();
            jest.spyOn(Date, 'now').mockImplementation(() => now);

            const game = createGame({
                startTime: new Date(now - 125000),
            });
            expect(service.calculateGameDuration(game)).toBe('2:05');
        });
    });

    describe('calculateTotalTurns', () => {
        it('should sum turns from all players', () => {
            const game = createGame({
                players: [createPlayer({ turnsPlayed: 5 }), createPlayer({ turnsPlayed: 3 }), createPlayer({ turnsPlayed: 2 })],
            });
            expect(service.calculateTotalTurns(game)).toBe(10);
        });

        it('should handle players with undefined turns', () => {
            const game = createGame({
                players: [createPlayer({ turnsPlayed: 5 }), createPlayer({}), createPlayer({ turnsPlayed: 2 })],
            });
            expect(service.calculateTotalTurns(game)).toBe(7);
        });
    });

    describe('calculateVisitedTilesPercentage', () => {
        it('should handle undefined visitedTiles', () => {
            const game = createGame({
                map: {
                    tiles: [['grass']],
                    name: '',
                    size: '',
                    gameMode: '',
                    description: '',
                    lastSave: undefined,
                    imageUrl: '',
                    hidden: false,
                    items: [],
                    nbCheckpoints: '',
                    nbRandomItems: '',
                },
                players: [createPlayer({ visitedTiles: undefined })],
            });
            expect(service.calculateVisitedTilesPercentage(game)).toBe(0);
        });

        it('should calculate percentage of unique tiles visited by all players', () => {
            const game = createGame({
                map: {
                    tiles: [
                        ['grass', 'water'],
                        ['ice', 'wall'],
                    ],
                    name: '',
                    size: '',
                    gameMode: '',
                    description: '',
                    lastSave: undefined,
                    imageUrl: '',
                    hidden: false,
                    items: [],
                    nbCheckpoints: '',
                    nbRandomItems: '',
                },
                players: [
                    createPlayer({
                        visitedTiles: [
                            { x: 0, y: 0 },
                            { x: 1, y: 0 },
                        ],
                    }),
                    createPlayer({
                        visitedTiles: [
                            { x: 0, y: 0 },
                            { x: 0, y: 1 },
                        ],
                    }),
                ],
            });
            expect(service.calculateVisitedTilesPercentage(game)).toBe(100);
        });

        it('should return 0% when no terrain tiles exist', () => {
            const game = createGame({
                map: {
                    tiles: [
                        ['wall', 'wall'],
                        ['wall', 'wall'],
                    ],
                    name: '',
                    size: '',
                    gameMode: '',
                    description: '',
                    lastSave: undefined,
                    imageUrl: '',
                    hidden: false,
                    items: [],
                    nbCheckpoints: '',
                    nbRandomItems: '',
                },
                players: [createPlayer({ visitedTiles: [{ x: 0, y: 0 }] })],
            });
            expect(service.calculateVisitedTilesPercentage(game)).toBe(0);
        });
    });

    describe('calculateDoorManipulatedPercentage', () => {
        it('should calculate percentage of manipulated doors', () => {
            const game = createGame({
                map: {
                    tiles: [
                        ['doorOpen', 'doorClose'],
                        ['doorClose', 'wall'],
                    ],
                    name: '',
                    size: '',
                    gameMode: '',
                    description: '',
                    lastSave: undefined,
                    imageUrl: '',
                    hidden: false,
                    items: [],
                    nbCheckpoints: '',
                    nbRandomItems: '',
                },
                doorsManipulated: new Set(['0-0']),
            });

            expect(service.calculateDoorManipulatedPercentage(game)).toBe(33);
        });

        it('should return 0% when no doors exist', () => {
            const game = createGame({
                map: {
                    tiles: [
                        ['wall', 'wall'],
                        ['wall', 'wall'],
                    ],
                    name: '',
                    size: '',
                    gameMode: '',
                    description: '',
                    lastSave: undefined,
                    imageUrl: '',
                    hidden: false,
                    items: [],
                    nbCheckpoints: '',
                    nbRandomItems: '',
                },
            });
            expect(service.calculateDoorManipulatedPercentage(game)).toBe(0);
        });
    });

    describe('calculateFlagHolders', () => {
        it('should return 0 if game mode is not CTF', () => {
            const game = createGame({
                map: { ...createGame().map, gameMode: 'classic' },
                players: [
                    createPlayer({ socketId: '1', collectedUniqueItems: ['flag'] }),
                    createPlayer({ socketId: '2', collectedUniqueItems: ['flag'] }),
                ],
            });
            expect(service.calculateFlagHolders(game)).toBe(0);
        });

        it('should count unique players with flag in CTF mode', () => {
            const game = createGame({
                map: { ...createGame().map, gameMode: 'CTF' },
                players: [
                    createPlayer({ socketId: '1', collectedUniqueItems: ['flag'] }),
                    createPlayer({ socketId: '2', collectedUniqueItems: ['flag'] }),
                    createPlayer({ socketId: '3', collectedUniqueItems: [] }),
                ],
            });
            expect(service.calculateFlagHolders(game)).toBe(2);
        });

        it('should ignore players without collectedUniqueItems', () => {
            const game = createGame({
                map: { ...createGame().map, gameMode: 'CTF' },
                players: [createPlayer({ socketId: '1' }), createPlayer({ socketId: '2', collectedUniqueItems: ['flag'] })],
            });
            expect(service.calculateFlagHolders(game)).toBe(1);
        });

        it('should return 0 if no player has the flag', () => {
            const game = createGame({
                map: { ...createGame().map, gameMode: 'CTF' },
                players: [createPlayer({ socketId: '1', collectedUniqueItems: [] }), createPlayer({ socketId: '2', collectedUniqueItems: [] })],
            });
            expect(service.calculateFlagHolders(game)).toBe(0);
        });

        it('should handle duplicate socketIds gracefully', () => {
            const game = createGame({
                map: { ...createGame().map, gameMode: 'CTF' },
                players: [
                    createPlayer({ socketId: '1', collectedUniqueItems: ['flag'] }),
                    createPlayer({ socketId: '1', collectedUniqueItems: ['flag'] }),
                ],
            });
            expect(service.calculateFlagHolders(game)).toBe(1);
        });
    });
});
