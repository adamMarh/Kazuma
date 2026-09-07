/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable max-lines */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { CombatService } from '@app/services/combat/combat.service';
import { CurrencyService } from '@app/services/currency/currency.service';
import { MovementService } from '@app/services/movement/movement.service';
import { CombatState } from '@common/interfaces/combatState.interface';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/interfaces/position.interface';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'socket.io';
import { BotService } from './bot.service';

describe('BotService', () => {
    let service: BotService;
    let combatService: jest.Mocked<CombatService>;
    let movementService: jest.Mocked<MovementService>;
    let mockServer: jest.Mocked<Server>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BotService,
                {
                    provide: CombatService,
                    useValue: {
                        initCombat: jest.fn(),
                        endCombat: jest.fn().mockReturnValue({ combatState: {}, actionPlayer: {} }),
                        getCombatState: jest.fn().mockReturnValue({}),
                        placePlayerAfterCombat: jest.fn().mockReturnValue({ x: 0, y: 0 }),
                        dropPlayerItems: jest.fn(),
                        defaultHp: new Map(),
                    },
                },
                {
                    provide: MovementService,
                    useValue: {
                        isAdjacent: jest.fn(),
                        findShortestPath: jest.fn(),
                        movePlayer: jest.fn(),
                    },
                },
                {
                    provide: CurrencyService,
                    useValue: {
                        applyEndGameRewards: jest.fn().mockResolvedValue(undefined),
                    },
                },
            ],
        }).compile();

        service = module.get<BotService>(BotService);
        combatService = module.get(CombatService);
        movementService = module.get(MovementService);

        mockServer = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
        } as any;
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('onlyBotsLeft', () => {
        it('should return true if only bots are left in the game', () => {
            const game: any = {
                players: [
                    { hasLeft: false, isBot: true },
                    { hasLeft: false, isBot: true },
                ],
            };
            expect(service.onlyBotsLeft(game)).toBe(true);
        });

        it('should return false if there are human players left', () => {
            const game: any = {
                players: [
                    { hasLeft: false, isBot: true },
                    { hasLeft: false, isBot: false },
                ],
            };
            expect(service.onlyBotsLeft(game)).toBe(false);
        });

        it('should return false if no active players', () => {
            const game: any = {
                players: [
                    { hasLeft: true, isBot: true },
                    { hasLeft: true, isBot: true },
                ],
            };
            expect(service.onlyBotsLeft(game)).toBe(false);
        });
    });

    describe('getAdjacentEnemy', () => {
        const bot = {
            socketId: 'bot1',
            position: { x: 5, y: 5 },
        } as any;

        it('should return an adjacent enemy player', () => {
            const game: any = {
                players: [
                    bot,
                    {
                        socketId: 'player2',
                        position: { x: 5, y: 4 },
                    },
                    {
                        socketId: 'player3',
                        position: { x: 10, y: 10 },
                    },
                ],
            };

            const result = service.getAdjacentEnemy(bot, game);
            expect(result).toEqual(game.players[1]);
        });

        it('should return undefined if no adjacent enemies', () => {
            const game: any = {
                players: [
                    bot,
                    {
                        socketId: 'player2',
                        position: { x: 10, y: 10 },
                    },
                ],
            };

            const result = service.getAdjacentEnemy(bot, game);
            expect(result).toBeUndefined();
        });
    });

    describe('findBestItem', () => {
        const bot = {
            position: { x: 0, y: 0 },
        } as any;

        const fakeMap = {
            items: [
                ['crystal', 'lance'],
                ['potion', 'empty'],
            ],
            tiles: [],
        };

        const game: any = {
            map: fakeMap,
        };

        it('should return the closest desired item position', () => {
            movementService.findShortestPath.mockImplementation((_bot, pos) => {
                if (pos.x === 1 && pos.y === 0)
                    return [
                        { x: 0, y: 0 },
                        { x: 1, y: 0 },
                    ];
                if (pos.x === 0 && pos.y === 1)
                    return [
                        { x: 0, y: 0 },
                        { x: 0, y: 1 },
                        { x: 0, y: 2 },
                    ];
                return [];
            });

            const result = service.findBestItem(bot, game, ['crystal', 'lance', 'hourglass', 'compas']);
            expect(result).toEqual({ x: 1, y: 0 });
        });

        it('should return null if no desired items found', () => {
            const emptyGame: any = {
                gameId: 'test',
                players: [],
                isLocked: false,
                started: false,
                ended: false,
                map: {
                    items: [
                        ['empty', 'empty'],
                        ['empty', 'empty'],
                    ],
                    tiles: [],
                    gameMode: 'CTF',
                },
                teams: {
                    blue: [],
                    red: [],
                },
            };

            const result = service.findBestItem(bot, emptyGame, ['crystal', 'lance', 'hourglass', 'compas']);
            expect(result).toBeNull();
        });

        it('should return null if no path to item', () => {
            movementService.findShortestPath.mockReturnValue([]);
            const result = service.findBestItem(bot, game, ['crystal', 'lance', 'hourglass', 'compas']);
            expect(result).toBeNull();
        });
    });

    describe('moveToTarget', () => {
        const bot: any = {
            name: 'Bot',
            position: { x: 0, y: 0 },
        };

        const target: any = { x: 1, y: 1 };

        const game: any = {
            gameId: 'game1',
            map: {},
            players: [],
        };

        it('should move player and emit item pickup log if map updated', () => {
            movementService.findShortestPath.mockReturnValue([
                { x: 0, y: 0 },
                { x: 1, y: 1 },
            ]);

            movementService.movePlayer.mockReturnValue({
                player: bot,
                mapUpdated: true,
                inventoryFull: false,
                encounteredItem: {
                    type: 'potion',
                    position: { x: 1, y: 1 },
                },
                realPath: [{ x: 1, y: 1 }],
            });

            service.moveToTarget(bot, target, game, mockServer);

            expect(mockServer.to).toHaveBeenCalledWith('game1');
            expect(mockServer.emit).toHaveBeenCalledWith(
                expect.stringContaining('log'),
                expect.objectContaining({
                    message: expect.stringContaining('a ramassé potion'),
                    players: [bot.name],
                }),
            );

            expect(mockServer.emit).toHaveBeenCalledWith(
                'actionEnded',
                expect.objectContaining({
                    player: bot,
                    path: [{ x: 1, y: 1 }],
                    players: [],
                }),
            );
        });

        it('should move player without item log if map not updated', () => {
            movementService.findShortestPath.mockReturnValue([
                { x: 0, y: 0 },
                { x: 1, y: 1 },
            ]);

            movementService.movePlayer.mockReturnValue({
                player: bot,
                mapUpdated: false,
                inventoryFull: false,
                encounteredItem: null,
                realPath: [{ x: 1, y: 1 }],
            });

            service.moveToTarget(bot, target, game, mockServer);

            expect(mockServer.to).toHaveBeenCalledWith('game1');

            expect(mockServer.emit).not.toHaveBeenCalledWith(expect.stringContaining('item_pickup'), expect.anything());

            expect(mockServer.emit).toHaveBeenCalledWith(
                'actionEnded',
                expect.objectContaining({
                    player: bot,
                    path: [{ x: 1, y: 1 }],
                    players: [],
                }),
            );
        });

        it('should not emit anything if path is empty', () => {
            movementService.findShortestPath.mockReturnValue([]);

            service.moveToTarget(bot, target, game, mockServer);

            expect(mockServer.emit).not.toHaveBeenCalled();
        });
    });

    describe('runBotTurn', () => {
        it('should call runAgressiveSequence if bot is aggressive', () => {
            const bot: any = {
                isAgressive: true,
            };

            const game: any = { gameId: 'game123' };
            const spy = jest.spyOn(service as any, 'runAgressiveSequence').mockImplementation(() => {});

            service.runBotTurn(bot, mockServer, game);

            expect(spy).toHaveBeenCalledWith(game, bot, mockServer);
        });

        it('should call runPassiveSequence if bot is not aggressive', () => {
            const bot: any = {
                isAgressive: false,
            };

            const game: any = { gameId: 'game123' };
            const spy = jest.spyOn(service as any, 'runPassiveSequence').mockImplementation(() => {});
            service.runBotTurn(bot, mockServer, game);
            expect(spy).toHaveBeenCalledWith(game, bot, mockServer);
        });
    });

    describe('goForFlagHolder', () => {
        const bot: any = {
            socketId: 'bot1',
            name: 'Bot',
            position: { x: 0, y: 0 },
            actionPoints: 1,
        };

        const targetPosition = { x: 0, y: 1 };

        const enemy: any = {
            socketId: 'enemy1',
            name: 'Enemy',
            position: { x: 0, y: 1 },
            isBot: true,
        };

        const game: any = {
            gameId: 'game123',
            players: [bot, enemy],
        };

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should trigger combat and emit events if adjacent and enemy found', () => {
            movementService.isAdjacent.mockReturnValue(true);
            const fakeCombatState: CombatState = {
                attacker: { socketId: 'bot1' } as any,
                target: { socketId: 'enemy1' } as any,
                inCombat: true,
                attackResult: null,
                combatAlreadyCounted: false,
                currentTurn: null,
                combatInitiator: null,
                hourglassConsumed: false,
                potionConsumed: false,
                players: [bot, enemy],
            };

            combatService.getCombatState.mockReturnValue(fakeCombatState);
            const spyInit = jest.spyOn(combatService, 'initCombat');
            const spyEmit = jest.spyOn(mockServer, 'emit');
            const spyAttackBot = jest.spyOn(service as any, 'attackBot').mockImplementation(() => {});
            service['goForFlagHolder'](bot, game, mockServer, targetPosition);
            expect(spyInit).toHaveBeenCalledWith(bot, enemy, game);
            expect(spyEmit).toHaveBeenCalledWith('combatStarted', { combatState: fakeCombatState });
            expect(spyEmit).toHaveBeenCalledWith(
                'log',
                expect.objectContaining({
                    message: expect.stringContaining('Début de combat'),
                }),
            );
            expect(spyAttackBot).toHaveBeenCalled();
            expect(bot.actionPoints).toBe(0);
        });

        it('should do nothing if not adjacent', () => {
            movementService.isAdjacent.mockReturnValue(false);

            service['goForFlagHolder'](bot, game, mockServer, targetPosition);

            expect(combatService.initCombat).not.toHaveBeenCalled();
            expect(mockServer.emit).not.toHaveBeenCalled();
        });

        it('should do nothing if no enemy at target position', () => {
            movementService.isAdjacent.mockReturnValue(true);
            const gameWithNoEnemy = {
                ...game,
                players: [bot],
            };

            service['goForFlagHolder'](bot, gameWithNoEnemy as any, mockServer, targetPosition);
            expect(combatService.initCombat).not.toHaveBeenCalled();
            expect(mockServer.emit).not.toHaveBeenCalled();
        });

        it('should do nothing if bot has no actionPoints', () => {
            movementService.isAdjacent.mockReturnValue(true);
            const botNoAP = { ...bot, actionPoints: 0 };
            service['goForFlagHolder'](botNoAP, game, mockServer, targetPosition);
            expect(combatService.initCombat).not.toHaveBeenCalled();
            expect(mockServer.emit).not.toHaveBeenCalled();
        });
    });

    describe('runAgressiveSequence', () => {
        const bot: any = {
            socketId: 'bot1',
            name: 'Bot',
            position: { x: 5, y: 5 },
            startPosition: { x: 0, y: 0 },
            isFlagHolder: true,
            actionPoints: 1,
        };

        const enemy: any = {
            socketId: 'enemy1',
            name: 'Enemy',
            position: { x: 0, y: 0 },
            isBot: true,
        };

        const game: any = {
            gameId: 'game1',
            players: [bot, enemy],
            map: {
                gameMode: 'CTF',
                tiles: Array(3)
                    .fill(0)
                    .map(() => Array(3).fill(0)),
            },
        };

        beforeEach(() => {
            jest.clearAllMocks();
            movementService.isAdjacent.mockReturnValue(true);
            combatService.getCombatState.mockReturnValue({
                attacker: bot,
                target: enemy,
                inCombat: true,
                attackResult: null,
                combatAlreadyCounted: false,
                currentTurn: null,
                combatInitiator: null,
                hourglassConsumed: false,
                potionConsumed: false,
            });
        });

        it('should move to item position if no flag or target found in CTF mode', () => {
            const bot = {
                socketId: 'bot1',
                name: 'Bot',
                position: { x: 1, y: 1 },
                startPosition: { x: 0, y: 0 },
                isFlagHolder: false,
                actionPoints: 1,
            };

            const game = {
                gameId: 'game1',
                players: [bot],
                map: {
                    gameMode: 'CTF',
                    tiles: Array(3)
                        .fill(0)
                        .map(() => Array(3).fill(0)),
                },
            };

            const fakeItemPos: Position = { x: 2, y: 2 };

            service['getCTFAggressiveTarget'] = jest.fn().mockReturnValue(undefined);
            service['findBestItem'] = jest.fn().mockImplementation((_b, _g, itemList) => {
                if (itemList.includes('flag')) return null;
                return fakeItemPos;
            });

            service['moveToTarget'] = jest.fn();

            service['runAgressiveSequence'](game as any, bot as any, mockServer);

            expect(service['findBestItem']).toHaveBeenCalledWith(bot, game, ['flag']);
            expect(service['findBestItem']).toHaveBeenCalledWith(bot, game, ['crystal', 'lance', 'hourglass', 'compas']);
            expect(service['moveToTarget']).toHaveBeenCalledWith(bot, fakeItemPos, game, mockServer);
        });

        it('should return to startPosition and attack if holding the flag', () => {
            const spyMove = jest.spyOn(service, 'moveToTarget').mockImplementation(() => {});
            const spyGoForFlagHolder = jest.spyOn(service as any, 'goForFlagHolder').mockImplementation(() => {});

            service['runAgressiveSequence'](game, bot, mockServer);
            const moveCall = spyMove.mock.calls[0];
            const returnPos = moveCall[1];
            const manhattanDistance = Math.abs(returnPos.x - bot.startPosition.x) + Math.abs(returnPos.y - bot.startPosition.y);
            expect(manhattanDistance).toBeLessThanOrEqual(1);

            expect(spyGoForFlagHolder).toHaveBeenCalledWith(bot, game, mockServer, bot.startPosition);
        });

        it('should move toward flagHolder and attempt to attack when one is found', () => {
            const bot: any = {
                socketId: 'bot1',
                name: 'Bot',
                position: { x: 2, y: 2 },
                isFlagHolder: false,
                actionPoints: 1,
            };

            const flagHolder: any = {
                socketId: 'enemy1',
                name: 'Enemy',
                isFlagHolder: true,
                position: { x: 5, y: 5 },
            };

            const nearestTarget: Position = { x: 5, y: 4 };

            const game: any = {
                gameId: 'game123',
                players: [bot, flagHolder],
                map: {
                    gameMode: 'CTF',
                    tiles: Array(6)
                        .fill(0)
                        .map(() => Array(6).fill(0)),
                },
                teams: {
                    blue: ['bot1'],
                    red: ['enemy1'],
                },
            };

            const spyAggressiveTarget = jest.spyOn(service, 'getCTFAggressiveTarget').mockReturnValue({ flagHolder, nearestTarget });
            const spyMove = jest.spyOn(service, 'moveToTarget').mockImplementation(() => {});
            const spyGoFor = jest.spyOn(service as any, 'goForFlagHolder').mockImplementation(() => {});

            service['runAgressiveSequence'](game, bot, mockServer);
            expect(spyAggressiveTarget).toHaveBeenCalledWith(bot, game);
            expect(spyMove).toHaveBeenCalledWith(bot, nearestTarget, game, mockServer);
            expect(spyGoFor).toHaveBeenCalledWith(bot, game, mockServer, flagHolder.position);
        });

        it('should move to flag item if no flagHolder is found', () => {
            const bot: any = {
                socketId: 'bot1',
                name: 'Bot',
                position: { x: 2, y: 2 },
                isFlagHolder: false,
                actionPoints: 1,
            };

            const game: any = {
                gameId: 'game123',
                players: [bot],
                map: {
                    gameMode: 'CTF',
                    tiles: Array(6)
                        .fill(0)
                        .map(() => Array(6).fill(0)),
                },
            };

            const flagPosition = { x: 4, y: 4 };

            jest.spyOn(service, 'getCTFAggressiveTarget').mockReturnValue(null);
            jest.spyOn(service, 'findBestItem').mockReturnValue(flagPosition);
            const spyMove = jest.spyOn(service, 'moveToTarget').mockImplementation(() => {});
            service['runAgressiveSequence'](game, bot, mockServer);

            expect(service.findBestItem).toHaveBeenCalledWith(bot, game, ['flag']);
            expect(spyMove).toHaveBeenCalledWith(bot, flagPosition, game, mockServer);
        });

        it('should attack adjacent enemy in non-CTF mode', () => {
            const bot: any = {
                socketId: 'bot1',
                name: 'Bot',
                position: { x: 2, y: 2 },
                actionPoints: 1,
            };

            const enemy: any = {
                socketId: 'enemy1',
                name: 'Enemy',
                position: { x: 2, y: 3 },
                isBot: true,
            };

            const combatState: CombatState = {
                attacker: bot,
                target: enemy,
                inCombat: true,
                attackResult: null,
                combatAlreadyCounted: false,
                currentTurn: null,
                combatInitiator: null,
                hourglassConsumed: false,
                potionConsumed: false,
            };

            const game: any = {
                gameId: 'game123',
                players: [bot, enemy],
                map: {
                    gameMode: 'deathmatch',
                    tiles: Array(6)
                        .fill(0)
                        .map(() => Array(6).fill(0)),
                },
            };

            jest.spyOn(service, 'getAdjacentEnemy').mockReturnValue(enemy);
            combatService.getCombatState.mockReturnValue(combatState);

            const spyInit = jest.spyOn(combatService, 'initCombat');
            const spyEmit = jest.spyOn(mockServer, 'emit');
            const spyAttack = jest.spyOn(service as any, 'attackBot').mockImplementation(() => {});

            service['runAgressiveSequence'](game, bot, mockServer);
            expect(spyInit).toHaveBeenCalledWith(bot, enemy, game);
            expect(spyEmit).toHaveBeenCalledWith('combatStarted', { combatState });
            expect(spyAttack).toHaveBeenCalledWith(combatState, game, mockServer);
        });
        it('should move toward closest player and attack after moving if enemy is found', () => {
            const bot: any = {
                socketId: 'bot1',
                name: 'Bot',
                position: { x: 0, y: 0 },
                actionPoints: 1,
            };

            const player: any = {
                socketId: 'enemy1',
                name: 'Enemy',
                position: { x: 2, y: 2 },
                isBot: true,
            };

            const game: any = {
                gameId: 'game1',
                players: [bot, player],
                map: {
                    gameMode: 'deathmatch',
                    tiles: Array(5)
                        .fill(0)
                        .map(() => Array(5).fill(0)),
                },
            };

            const targetAdjacentPos = { x: 2, y: 1 };
            const path = [bot.position, targetAdjacentPos];

            jest.spyOn(service, 'getAdjacentEnemy').mockReturnValueOnce(undefined);
            movementService.findShortestPath.mockReturnValue(path);

            const spyMove = jest.spyOn(service, 'moveToTarget').mockImplementation(() => {});
            const spySecondEnemyCheck = jest.spyOn(service, 'getAdjacentEnemy').mockReturnValueOnce(player);
            combatService.getCombatState.mockReturnValue({
                attacker: bot,
                target: player,
                inCombat: true,
                attackResult: null,
                combatAlreadyCounted: false,
                currentTurn: null,
                combatInitiator: null,
                hourglassConsumed: false,
                potionConsumed: false,
            });

            const spyInit = jest.spyOn(combatService, 'initCombat');
            const spyEmit = jest.spyOn(mockServer, 'emit');
            const spyAttack = jest.spyOn(service as any, 'attackBot').mockImplementation(() => {});

            service['runAgressiveSequence'](game, bot, mockServer);
            expect(spyMove).toHaveBeenCalledWith(bot, targetAdjacentPos, game, mockServer);
            expect(spyInit).toHaveBeenCalledWith(bot, player, game);
            expect(spyEmit).toHaveBeenCalledWith('combatStarted', expect.anything());
            expect(spyAttack).toHaveBeenCalledWith(expect.anything(), game, mockServer);
        });
        it('should move to best aggressive item if no enemy is reachable', () => {
            const bot: any = {
                socketId: 'bot1',
                name: 'Bot',
                position: { x: 1, y: 1 },
                actionPoints: 1,
            };

            const game: any = {
                gameId: 'game1',
                players: [bot],
                map: {
                    gameMode: 'deathmatch',
                    tiles: Array(5)
                        .fill(0)
                        .map(() => Array(5).fill(0)),
                },
            };

            const itemPos = { x: 3, y: 3 };

            jest.spyOn(service, 'getAdjacentEnemy').mockReturnValue(undefined);
            jest.spyOn(service, 'findBestItem').mockReturnValue(itemPos);

            const spyMove = jest.spyOn(service, 'moveToTarget').mockImplementation(() => {});
            jest.spyOn(service, 'getAdjacentEnemy').mockReturnValueOnce(undefined);
            service['runAgressiveSequence'](game, bot, mockServer);
            expect(spyMove).toHaveBeenCalledWith(bot, itemPos, game, mockServer);
        });
        it('should do nothing if no enemies or items are found', () => {
            const bot: any = {
                socketId: 'bot1',
                name: 'Bot',
                position: { x: 1, y: 1 },
                actionPoints: 1,
            };

            const game: any = {
                gameId: 'game1',
                players: [bot],
                map: {
                    gameMode: 'deathmatch',
                    tiles: Array(5)
                        .fill(0)
                        .map(() => Array(5).fill(0)),
                },
            };

            jest.spyOn(service, 'getAdjacentEnemy').mockReturnValue(undefined);
            jest.spyOn(service, 'findBestItem').mockReturnValue(null);

            const spyMove = jest.spyOn(service, 'moveToTarget');
            const spyCombat = jest.spyOn(combatService, 'initCombat');
            const spyEmit = jest.spyOn(mockServer, 'emit');
            service['runAgressiveSequence'](game, bot, mockServer);
            expect(spyMove).not.toHaveBeenCalled();
            expect(spyCombat).not.toHaveBeenCalled();
            expect(spyEmit).not.toHaveBeenCalled();
        });

        it('should attack enemy after picking up an aggressive item', () => {
            const bot: any = {
                socketId: 'bot1',
                name: 'Bot',
                position: { x: 1, y: 1 },
                actionPoints: 1,
                isFlagHolder: false,
            };

            const enemy: any = {
                socketId: 'enemy1',
                name: 'Enemy',
                position: { x: 2, y: 1 },
                isBot: true,
            };

            const game: any = {
                gameId: 'game123',
                players: [bot, enemy],
                map: {
                    gameMode: 'deathmatch',
                    tiles: Array(5)
                        .fill(0)
                        .map(() => Array(5).fill(0)),
                },
            };

            const itemPos = { x: 3, y: 3 };

            jest.spyOn(service, 'getAdjacentEnemy').mockReturnValueOnce(undefined).mockReturnValueOnce(enemy);

            jest.spyOn(service, 'findBestItem').mockReturnValue(itemPos);
            jest.spyOn(service, 'moveToTarget').mockImplementation(() => {});

            const combatState = {
                attacker: bot,
                target: enemy,
                inCombat: true,
                attackResult: null,
                combatAlreadyCounted: false,
                currentTurn: null,
                combatInitiator: null,
                hourglassConsumed: false,
                potionConsumed: false,
            };

            movementService.findShortestPath.mockImplementation((botArg, posArg, g, map) => {
                if (posArg.x === itemPos.x && posArg.y === itemPos.y) {
                    return [
                        { x: 1, y: 1 },
                        { x: 2, y: 1 },
                    ];
                }
                return [];
            });

            const spyInit = jest.spyOn(combatService, 'initCombat');
            const spyEmit = jest.spyOn(mockServer, 'emit');
            const spyAttack = jest.spyOn(service as any, 'attackBot').mockImplementation(() => {});
            service['runAgressiveSequence'](game, bot, mockServer);

            expect(service.findBestItem).toHaveBeenCalledWith(bot, game, ['crystal', 'lance', 'hourglass', 'compas']);
            expect(service.moveToTarget).toHaveBeenCalledWith(bot, itemPos, game, mockServer);
            expect(spyInit).toHaveBeenCalledWith(bot, enemy, game);
            expect(spyEmit).toHaveBeenCalledWith(
                'combatStarted',
                expect.objectContaining({
                    combatState: expect.objectContaining({
                        attacker: expect.objectContaining({ name: 'Bot' }),
                        target: expect.objectContaining({ name: 'Enemy' }),
                        inCombat: true,
                    }),
                }),
            );

            expect(spyAttack).toHaveBeenCalledWith(
                expect.objectContaining({
                    attacker: expect.objectContaining({ name: 'Bot' }),
                    target: expect.objectContaining({ name: 'Enemy' }),
                    inCombat: true,
                }),
                game,
                mockServer,
            );
        });
    });

    describe('runPassiveSequence', () => {
        const bot: any = {
            socketId: 'bot1',
            name: 'Bot',
            position: { x: 1, y: 1 },
            startPosition: { x: 0, y: 0 },
            isFlagHolder: false,
            isMyTurn: true,
            actionPoints: 1,
        };

        const enemy: any = {
            socketId: 'enemy1',
            name: 'Enemy',
            position: { x: 2, y: 1 },
            isBot: true,
        };

        const game: any = {
            gameId: 'game1',
            players: [bot, enemy],
            map: {
                gameMode: 'CTF',
                tiles: Array(5)
                    .fill(0)
                    .map(() => Array(5).fill(0)),
            },
        };

        beforeEach(() => {
            jest.clearAllMocks();
            combatService.getCombatState.mockReturnValue({
                attacker: bot,
                target: enemy,
                inCombat: true,
                attackResult: null,
                combatAlreadyCounted: false,
                currentTurn: null,
                combatInitiator: null,
                hourglassConsumed: false,
                potionConsumed: false,
            });
        });

        it('should move to fallback item if no flag or defensive target found in passive CTF', () => {
            const fakeItemPos: Position = { x: 4, y: 4 };

            service['getCTFDefensiveTarget'] = jest.fn().mockReturnValue(undefined);
            service['findBestItem'] = jest.fn().mockImplementation((_b, _g, items) => {
                if (items.includes('flag')) return null;
                return fakeItemPos;
            });

            service['moveToTarget'] = jest.fn();

            service['runPassiveSequence'](game, bot, mockServer);

            expect(service['findBestItem']).toHaveBeenCalledWith(bot, game, ['flag']);
            expect(service['findBestItem']).toHaveBeenCalledWith(bot, game, ['potion', 'shield', 'compas']);
            expect(service['moveToTarget']).toHaveBeenCalledWith(bot, fakeItemPos, game, mockServer);
        });

        it('should move to defensive position if in CTF mode', () => {
            const bot: any = {
                socketId: 'bot1',
                name: 'Bot',
                position: { x: 1, y: 1 },
                isFlagHolder: false,
                isMyTurn: true,
            };

            const game: any = {
                gameId: 'game1',
                players: [bot],
                map: {
                    gameMode: 'CTF',
                    tiles: Array(5)
                        .fill(0)
                        .map(() => Array(5).fill(0)),
                },
            };

            const targetPos = { x: 2, y: 2 };

            jest.spyOn(service, 'getCTFDefensiveTarget').mockReturnValue(targetPos);
            const spyMove = jest.spyOn(service, 'moveToTarget').mockImplementation(() => {});
            service['runPassiveSequence'](game, bot, mockServer);
            expect(spyMove).toHaveBeenCalledWith(bot, targetPos, game, mockServer);
        });
        it('should go to flag if no defensive target is found in CTF mode', () => {
            const bot: any = {
                socketId: 'bot1',
                name: 'Bot',
                position: { x: 0, y: 0 },
                isFlagHolder: false,
                isMyTurn: true,
            };

            const game: any = {
                gameId: 'game1',
                players: [bot],
                map: {
                    gameMode: 'CTF',
                    tiles: Array(3)
                        .fill(0)
                        .map(() => Array(3).fill(0)),
                },
            };

            jest.spyOn(service, 'getCTFDefensiveTarget').mockReturnValue(null);
            const flagPos = { x: 2, y: 2 };
            jest.spyOn(service, 'findBestItem').mockReturnValue(flagPos);
            const spyMove = jest.spyOn(service, 'moveToTarget').mockImplementation(() => {});
            service['runPassiveSequence'](game, bot, mockServer);
            expect(spyMove).toHaveBeenCalledWith(bot, flagPos, game, mockServer);
        });
        it('should move to defensive item in non-CTF mode', () => {
            const bot: any = {
                socketId: 'bot1',
                name: 'Bot',
                position: { x: 1, y: 1 },
                isMyTurn: true,
            };

            const game: any = {
                gameId: 'game1',
                players: [bot],
                map: {
                    gameMode: 'deathmatch',
                    tiles: Array(3)
                        .fill(0)
                        .map(() => Array(3).fill(0)),
                },
            };

            const itemPos = { x: 2, y: 2 };
            jest.spyOn(service, 'findBestItem').mockReturnValue(itemPos);
            jest.spyOn(service, 'getAdjacentEnemy').mockReturnValue(undefined);
            const spyMove = jest.spyOn(service, 'moveToTarget').mockImplementation(() => {});
            service['runPassiveSequence'](game, bot, mockServer);
            expect(spyMove).toHaveBeenCalledWith(bot, itemPos, game, mockServer);
            expect(bot.isMyTurn).toBe(false);
        });

        it('should end turn if no defensive item is found in non-CTF mode', () => {
            const bot: any = {
                socketId: 'bot1',
                name: 'Bot',
                position: { x: 0, y: 0 },
                isMyTurn: true,
            };

            const game: any = {
                gameId: 'game1',
                players: [bot],
                map: {
                    gameMode: 'deathmatch',
                    tiles: Array(3)
                        .fill(0)
                        .map(() => Array(3).fill(0)),
                },
            };

            jest.spyOn(service, 'findBestItem').mockReturnValue(null);
            service['runPassiveSequence'](game, bot, mockServer);
            expect(bot.isMyTurn).toBe(false);
        });

        it('should attack enemy after moving to item if one is adjacent', () => {
            const bot: any = {
                socketId: 'bot1',
                name: 'Bot',
                position: { x: 1, y: 1 },
                isMyTurn: true,
                actionPoints: 1,
            };

            const enemy: any = {
                socketId: 'enemy1',
                name: 'Enemy',
                position: { x: 2, y: 1 },
                isBot: true,
            };

            const game: any = {
                gameId: 'game1',
                players: [bot, enemy],
                map: {
                    gameMode: 'deathmatch',
                    tiles: Array(3)
                        .fill(0)
                        .map(() => Array(3).fill(0)),
                },
            };

            const itemPos = { x: 2, y: 2 };

            jest.spyOn(service, 'findBestItem').mockReturnValue(itemPos);
            jest.spyOn(service, 'getAdjacentEnemy').mockReturnValue(enemy);
            combatService.getCombatState.mockReturnValue({
                attacker: bot,
                target: enemy,
                inCombat: true,
                attackResult: null,
                combatAlreadyCounted: false,
                currentTurn: null,
                combatInitiator: null,
                hourglassConsumed: false,
                potionConsumed: false,
            });

            jest.spyOn(service, 'moveToTarget').mockImplementation(() => {});
            const spyCombat = jest.spyOn(combatService, 'initCombat');
            const spyAttack = jest.spyOn(service as any, 'attackBot').mockImplementation(() => {});
            service['runPassiveSequence'](game, bot, mockServer);
            expect(spyCombat).toHaveBeenCalledWith(bot, enemy, game);
            expect(spyAttack).toHaveBeenCalled();
        });
    });

    describe('attackBot', () => {
        let bot: any;
        let enemy: any;
        let game: any;
        let combatState: any;

        beforeEach(() => {
            jest.clearAllMocks();

            bot = {
                socketId: 'bot1',
                name: 'Bot',
                battlesWon: 2,
                combatsParticipated: 0,
                totalDamageDone: 0,
                isFlagHolder: false,
            };

            enemy = {
                socketId: 'bot2',
                name: 'Enemy',
                startPosition: { x: 0, y: 0 },
                battlesLost: 0,
                combatsParticipated: 0,
                totalDamageTaken: 0,
                isFlagHolder: true,
                position: { x: 1, y: 1 },
            };

            game = {
                gameId: 'game1',
                players: [bot, enemy],
                ended: false,
                map: {},
                teams: { blue: [], red: [] },
            };

            combatState = {
                attacker: bot,
                target: enemy,
                combatAlreadyCounted: false,
            };

            combatService.endCombat.mockReturnValue({
                combatState,
                actionPlayer: bot,
            });

            combatService['defaultHp'] = new Map([[enemy.socketId, 10]]);
        });

        it('should handle combat win and update game state without ending the game', () => {
            jest.spyOn(Math, 'random').mockReturnValue(0.6);

            service['attackBot'](combatState, game, mockServer);

            expect(bot.battlesWon).toBe(3);
            expect(bot.combatsParticipated).toBe(1);
            expect(enemy.battlesLost).toBe(1);
            expect(enemy.combatsParticipated).toBe(1);
            expect(enemy.position).toEqual(enemy.startPosition);
            expect(enemy.isFlagHolder).toBe(false);
            expect(bot.totalDamageDone).toBe(10);
            expect(enemy.totalDamageTaken).toBe(10);
            expect(combatState.combatAlreadyCounted).toBe(true);
            expect(game.ended).toBe(true);

            expect(mockServer.emit).toHaveBeenCalledWith('combatEnded', {
                combatState,
                reason: 'death',
                actionPlayer: bot,
                gameEnded: true,
            });

            expect(mockServer.emit).toHaveBeenCalledWith('mapUpdated', game.map);
            expect(mockServer.emit).toHaveBeenCalledWith('updateLobby', game);
            expect(mockServer.emit).toHaveBeenCalledWith(
                'log',
                expect.objectContaining({
                    message: expect.stringContaining('a vaincu'),
                }),
            );
        });

        it('should win the combat but not end the game if battlesWon < 3', () => {
            bot.battlesWon = 1;
            jest.spyOn(Math, 'random').mockReturnValue(0.8);

            service['attackBot'](combatState, game, mockServer);
            expect(bot.battlesWon).toBe(2);
            expect(game.ended).toBe(false);

            expect(mockServer.emit).toHaveBeenCalledWith(
                'combatEnded',
                expect.objectContaining({
                    gameEnded: false,
                }),
            );
        });

        it('should retrieve loser HP from defaultHp map if target wins', () => {
            bot = {
                socketId: 'bot1',
                name: 'Bot',
                battlesWon: 1,
                combatsParticipated: 0,
                totalDamageDone: 0,
                isFlagHolder: false,
                startPosition: { x: 0, y: 0 },
                position: { x: 5, y: 5 },
            };

            enemy = {
                socketId: 'bot2',
                name: 'Enemy',
                startPosition: { x: 1, y: 1 },
                battlesWon: 2,
                combatsParticipated: 0,
                totalDamageTaken: 0,
                isFlagHolder: false,
                position: { x: 2, y: 2 },
            };

            game = {
                gameId: 'game1',
                players: [bot, enemy],
                ended: false,
                map: {},
                teams: { blue: [], red: [] },
            };

            combatState = {
                attacker: bot,
                target: enemy,
                combatAlreadyCounted: false,
            };

            jest.spyOn(Math, 'random').mockReturnValue(0.3);
            combatService['defaultHp'] = new Map();
            combatService['defaultHp'].set('bot1', 7);

            combatService.endCombat.mockReturnValue({
                combatState,
                actionPlayer: enemy,
            });

            service['attackBot'](combatState, game, mockServer);

            expect(bot.totalDamageTaken).toBe(7);
            expect(enemy.totalDamageDone).toBe(7);
        });
        it('should default to 0 damage if no defaultHp found for loser', () => {
            jest.spyOn(Math, 'random').mockReturnValue(0.3);
            combatService['defaultHp'] = new Map();
            service['attackBot'](combatState, game, mockServer);
            expect(bot.totalDamageTaken).toBe(0);
            expect(enemy.totalDamageDone).toBe(0);
        });
    });

    describe('getCTFAggressiveTarget', () => {
        const bot: any = {
            socketId: 'bot1',
            name: 'Bot',
        };

        const flagHolder: any = {
            socketId: 'player2',
            name: 'Enemy',
            position: { x: 4, y: 4 },
            isFlagHolder: true,
        };

        const game: any = {
            players: [bot, flagHolder],
            map: {
                tiles: Array(6)
                    .fill(0)
                    .map(() => Array(6).fill(0)),
            },
            teams: {
                blue: ['bot1'],
                red: ['player2'],
            },
        };

        it('should return nearest position and flagHolder if enemy found', () => {
            movementService.findShortestPath.mockReturnValue([{ x: 3, y: 4 }]);

            const result = service.getCTFAggressiveTarget(bot, game);
            expect(result?.flagHolder).toEqual(flagHolder);
            expect(result?.nearestTarget).toBeDefined();
        });

        it('should return null if no flagHolder found', () => {
            const gameWithoutFlagHolder = { ...game, players: [bot] };
            const result = service.getCTFAggressiveTarget(bot, gameWithoutFlagHolder as any);
            expect(result).toBeNull();
        });

        it('should return null if flagHolder is in same team', () => {
            const gameSameTeam = {
                ...game,
                teams: {
                    blue: ['bot1', 'player2'],
                    red: [],
                },
            };
            movementService.findShortestPath.mockReturnValue([]);
            const result = service.getCTFAggressiveTarget(bot, gameSameTeam as any);
            expect(result).toBeNull();
        });
    });

    describe('getCTFDefensiveTarget', () => {
        it('should return startPosition if not occupied', () => {
            const bot: any = { socketId: 'bot1' };

            const flagHolder: any = {
                socketId: 'p2',
                isFlagHolder: true,
                position: { x: 0, y: 0 },
                startPosition: { x: 0, y: 0 },
            };

            const game: any = {
                players: [flagHolder],
                map: {
                    tiles: Array(3)
                        .fill(0)
                        .map(() => Array(3).fill(0)),
                },
            };

            const result = service.getCTFDefensiveTarget(bot, game);
            expect(result).not.toEqual({ x: 0, y: 0 });
            expect(result).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
        });

        it('should return closest free tile if startPosition is occupied', () => {
            const bot: any = { socketId: 'bot1' };

            const flagHolder: any = {
                socketId: 'p2',
                isFlagHolder: true,
                position: { x: 0, y: 0 },
                startPosition: { x: 0, y: 0 },
            };

            const game: any = {
                players: [flagHolder, { position: { x: 0, y: 0 } }],
                map: {
                    tiles: Array(2)
                        .fill(0)
                        .map(() => Array(2).fill(0)),
                },
            };

            const result = service.getCTFDefensiveTarget(bot, game);
            expect(result).not.toEqual({ x: 0, y: 0 });
        });

        it('should return null if no flagHolder found', () => {
            const game: any = {
                players: [],
                map: {
                    tiles: Array(2)
                        .fill(0)
                        .map(() => Array(2).fill(0)),
                },
            };

            const result = service.getCTFDefensiveTarget({} as any, game);
            expect(result).toBeNull();
        });
    });

    describe('teamCheck', () => {
        it('should return true if players are on different teams', () => {
            const game: any = {
                teams: {
                    blue: ['bot1'],
                    red: ['p2'],
                },
            };

            const player1: Player = {
                socketId: 'bot1',
                name: 'Bot',
                avatar: '🐱',
                speed: 1,
                defense: 1,
                attack: 1,
                healthpoints: 10,
                position: { x: 0, y: 0 },
                fleeAttempts: 0,
                battlesWon: 0,
                inventory: [],
                isInventoryFull: false,
                isMyTurn: true,
                movementPoints: 1,
                actionPoints: 1,
                dice: { atk: 1, def: 1 },
            };

            const player2: Player = {
                ...player1,
                socketId: 'p2',
                name: 'Enemy',
            };

            expect(service['teamCheck'](game, player1, player2)).toBe(true);
        });

        it('should return false if players are on the same team', () => {
            const game: any = {
                teams: {
                    blue: ['bot1', 'p2'],
                    red: [],
                },
            };

            const player1: Player = {
                socketId: 'bot1',
                name: 'Bot',
                avatar: '🐱',
                speed: 1,
                defense: 1,
                attack: 1,
                healthpoints: 10,
                position: { x: 0, y: 0 },
                fleeAttempts: 0,
                battlesWon: 0,
                inventory: [],
                isInventoryFull: false,
                isMyTurn: true,
                movementPoints: 1,
                actionPoints: 1,
                dice: { atk: 1, def: 1 },
            };

            const player2: Player = {
                ...player1,
                socketId: 'p2',
                name: 'Enemy',
            };

            expect(service['teamCheck'](game, player1, player2)).toBe(false);
        });
        it('should correctly detect player1 in red team', () => {
            const game: any = {
                teams: {
                    blue: [],
                    red: ['bot1'],
                },
            };

            const player1: Player = {
                socketId: 'bot1',
                name: 'Bot',
                avatar: '🐱',
                speed: 1,
                defense: 1,
                attack: 1,
                healthpoints: 10,
                position: { x: 0, y: 0 },
                fleeAttempts: 0,
                battlesWon: 0,
                inventory: [],
                isInventoryFull: false,
                isMyTurn: true,
                movementPoints: 1,
                actionPoints: 1,
                dice: { atk: 1, def: 1 },
            };

            const player2: Player = {
                ...player1,
                socketId: 'p2',
                name: 'Enemy',
            };
            expect(service['teamCheck'](game, player1, player2)).toBe(false);
        });
    });
});
