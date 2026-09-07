/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-lines */
import { ItemService } from '@app/services/item/item.service';
import { CombatState } from '@common/interfaces/combatState.interface';
import { Game } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { CombatService } from './combat.service';

describe('CombatService', () => {
    let service: CombatService;
    let itemService: ItemService;
    let player1: Player;
    let player2: Player;
    let game: Game;
    let combatState: CombatState;

    beforeEach(() => {
        itemService = {
            canUsePotion: jest.fn(),
            canUseHourglass: jest.fn(),
            canPreventFlee: jest.fn(),
            removeItemEffect: jest.fn(),
            applyItemEffect: jest.fn(),
        } as any as ItemService;

        service = new CombatService(itemService);

        player1 = {
            socketId: 'player1',
            name: 'Player 1',
            avatar: '1',
            speed: 5,
            defense: 3,
            attack: 4,
            healthpoints: 10,
            position: { x: 0, y: 0 },
            startPosition: { x: 0, y: 0 },
            battlesWon: 0,
            inventory: [],
            isInventoryFull: false,
            isAdmin: false,
            dice: { atk: 2, def: 2 },
            isMyTurn: false,
            movementPoints: 5,
            actionPoints: 1,
            fleeAttempts: 0,
        };

        player2 = {
            socketId: 'player2',
            name: 'Player 2',
            avatar: '2',
            speed: 4,
            defense: 2,
            attack: 5,
            healthpoints: 8,
            position: { x: 0, y: 1 },
            startPosition: { x: 0, y: 2 },
            battlesWon: 0,
            inventory: [],
            isInventoryFull: false,
            isAdmin: false,
            dice: { atk: 2, def: 2 },
            isMyTurn: false,
            movementPoints: 4,
            actionPoints: 1,
            fleeAttempts: 0,
        };

        const tiles = [
            ['grass', 'grass', 'grass'],
            ['grass', 'ice', 'grass'],
            ['grass', 'grass', 'grass'],
        ];

        const items = [
            ['empty', 'empty', 'empty'],
            ['empty', 'empty', 'empty'],
            ['empty', 'empty', 'empty'],
        ];

        game = {
            gameId: 'game1',
            players: [player1, player2],
            inactivePlayers: [],
            map: {
                _id: 'map1',
                name: 'Test Map',
                size: '3x3',
                tiles,
                items,
                gameMode: 'test',
                description: 'Test map',
                lastSave: new Date(),
                imageUrl: '',
                hidden: false,
                nbCheckpoints: '0',
                nbRandomItems: '0',
            },
            isLocked: false,
            started: true,
            ended: false,
            maxPlayers: 2,
            playerTurns: [player1.socketId, player2.socketId],
            currentPlayerIndex: 0,
            startingPoints: [
                { x: 0, y: 0 },
                { x: 0, y: 2 },
            ],
            selectedAvatars: { [player1.socketId]: 1, [player2.socketId]: 2 },
            isInDebugMode: false,
            teams: {
                red: [],
                blue: [],
            },
            winner: '',
        };

        combatState = {
            attacker: null,
            target: null,
            inCombat: false,
            attackResult: { damage: 0, attackDiceRoll: 0, defenseDiceRoll: 0 },
            combatInitiator: null,
            hourglassConsumed: false,
            potionConsumed: false,
        };
    });

    describe('getCombatState', () => {
        it('should return the combat state for a given gameId', () => {
            (service as any).combats.set('game1', combatState);
            expect(service.getCombatState('game1')).toBe(combatState);
        });

        it("devrait retourner undefined si aucun état de combat n'existe pour ce gameId", () => {
            expect(service.getCombatState('non-existent')).toBeUndefined();
        });
    });

    describe('initCombat', () => {
        it('should initialize a new combat with player1 as the attacker if their speed is higher', () => {
            player1.speed = 6;
            player2.speed = 4;
            service.initCombat(player1, player2, game);

            const result = service.getCombatState(game.gameId);
            expect(result.attacker).toBe(player1);
            expect(result.target).toBe(player2);
            expect(result.inCombat).toBe(true);
            expect(player1.actionPoints).toBe(0);
            expect((service as any).defaultHp[player1.socketId]).toBe(10);
            expect((service as any).defaultHp[player2.socketId]).toBe(8);
        });

        it('should initialize a new combat with player2 as the attacker if their speed is higher', () => {
            player1.speed = 4;
            player2.speed = 6;
            service.initCombat(player1, player2, game);

            const result = service.getCombatState(game.gameId);
            expect(result.attacker).toBe(player2);
            expect(result.target).toBe(player1);
            expect(result.inCombat).toBe(true);
            expect(player1.actionPoints).toBe(0);
        });

        it('devrait initialiser un nouveau combat avec player1 comme attaquant si les vitesses sont égales', () => {
            player1.speed = 5;
            player2.speed = 5;
            service.initCombat(player1, player2, game);

            const result = service.getCombatState(game.gameId);
            expect(result.attacker).toBe(player1);
            expect(result.target).toBe(player2);
        });

        it('should reset the combat when remake is true', () => {
            (service as any).combats.set(game.gameId, {
                ...combatState,
                attacker: player2,
                target: player1,
                inCombat: true,
            });

            service.initCombat(player1, player2, game, true);
            const result = service.getCombatState(game.gameId);
            expect(result.attacker).toBe(player1);
            expect(result.target).toBe(player2);
        });

        it('should increment the combat participation counter for both players after attack or flee', () => {
            player1.combatsParticipated = 0;
            player2.combatsParticipated = 0;

            service.initCombat(player1, player2, game);
            service.attackOpponent(game);

            expect(player1.combatsParticipated).toBe(1);
            expect(player2.combatsParticipated).toBe(1);
        });

        it('should not init combat if player1 has left', () => {
            player1.hasLeft = true;
            player2.hasLeft = false;

            service.initCombat(player1, player2, game);

            const result = service.getCombatState(game.gameId);
            expect(result).toBeUndefined();
        });

        it('should not init combat if player2 has left', () => {
            player1.hasLeft = false;
            player2.hasLeft = true;

            service.initCombat(player1, player2, game);

            const result = service.getCombatState(game.gameId);
            expect(result).toBeUndefined();
        });
    });

    describe('iceAttributesNerf', () => {
        it('should decrease the attribute by 2 if the player is on an ice tile', () => {
            player1.position = { x: 1, y: 1 };
            const result = service.iceAttributesNerf(player1, game, 10);
            expect(result).toBe(8);
        });

        it('should not modify the attribute if the player is not on an ice tile', () => {
            player1.position = { x: 0, y: 0 };
            const result = service.iceAttributesNerf(player1, game, 10);
            expect(result).toBe(10);
        });
    });

    describe('iceAttributesReset', () => {
        it('should increase the attribute by 2 if the player is on an ice tile', () => {
            player1.position = { x: 1, y: 1 };
            const result = service.iceAttributesReset(player1, game, 8);
            expect(result).toBe(10);
        });

        it('should not modify the attribute if the player is not on an ice tile', () => {
            player1.position = { x: 0, y: 0 };
            const result = service.iceAttributesReset(player1, game, 8);
            expect(result).toBe(8);
        });
    });

    describe('switchTurn', () => {
        it('should swap the attacker and the target', () => {
            const state = {
                attacker: player1,
                target: player2,
                inCombat: true,
                attackResult: { damage: 0, attackDiceRoll: 0, defenseDiceRoll: 0 },
            } as CombatState;

            service.switchTurn(state);

            expect(state.attacker).toBe(player2);
            expect(state.target).toBe(player1);
        });
    });

    describe('attackOpponent', () => {
        beforeEach(() => {
            service.initCombat(player1, player2, game);

            jest.spyOn(global.Math, 'random').mockReturnValue(0.5);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('should calculate the damage and apply debug mode', () => {
            game.isInDebugMode = true;

            const result = service.attackOpponent(game);

            expect(result.success).toBe(true);
            const combatState = service.getCombatState(game.gameId);
            expect(combatState.attackResult.attackDiceRoll).toBe(player1.dice.atk);
            expect(combatState.attackResult.defenseDiceRoll).toBe(1);
        });

        it('should calculate the damage normally in non-debug mode', () => {
            game.isInDebugMode = false;

            const result = service.attackOpponent(game);

            expect(result.success).toBe(true);
            const combatState = service.getCombatState(game.gameId);
            expect(combatState.attackResult.attackDiceRoll).toBe(2);
            expect(combatState.attackResult.defenseDiceRoll).toBe(2);
        });

        it('should apply ice nerfs to the attributes', () => {
            player1.position = { x: 1, y: 1 };

            player1.attack = 8;
            player2.defense = 2;
            jest.spyOn(global.Math, 'random').mockReturnValue(0.5);
            service.attackOpponent(game);

            const combatState = service.getCombatState(game.gameId);
            expect(combatState.attackResult.damage).toBe(4);
        });

        it('should allow the player to drink a potion if they can', () => {
            (itemService.canUsePotion as jest.Mock).mockReturnValue(true);
            player2.healthpoints = 2;

            const result = service.attackOpponent(game);

            expect(result.drankPotion).toBe(true);
            expect(player2.healthpoints).toBe(3);
        });

        it('should allow the player to use an hourglass if they die and have one', () => {
            (itemService.canUseHourglass as jest.Mock).mockReturnValue(true);
            player2.healthpoints = 2;
            (service as any).defaultHp[player2.socketId] = 8;

            jest.spyOn(global.Math, 'random').mockReturnValue(1);

            const result = service.attackOpponent(game);

            expect(result.flippedHourglass).toBe(true);
            expect(result.isDead).toBe(false);
            expect(player2.healthpoints).toBe(8);
        });

        it('should mark the player as dead if they have no health points and no hourglass', () => {
            (itemService.canUseHourglass as jest.Mock).mockReturnValue(false);
            player2.healthpoints = 2;

            jest.spyOn(global.Math, 'random').mockReturnValue(1);

            const result = service.attackOpponent(game);

            expect(result.isDead).toBe(true);
            expect(player2.healthpoints).toBe(0);
            expect(player1.battlesWon).toBe(1);
            expect(player2.position).toEqual(player2.startPosition);
        });

        it('should swap roles after an attack', () => {
            const initialCombatState = service.getCombatState(game.gameId);
            const initialAttacker = initialCombatState.attacker;
            const initialTarget = initialCombatState.target;

            service.attackOpponent(game);

            const updatedCombatState = service.getCombatState(game.gameId);
            expect(updatedCombatState.attacker).toBe(initialTarget);
            expect(updatedCombatState.target).toBe(initialAttacker);
        });

        it('should return { success: false } if combatState is undefined', () => {
            (service as any).combats.set(game.gameId, undefined);

            const result = service.attackOpponent(game);

            expect(result).toEqual({ success: false });
        });

        it('should return { success: false } if attacker has left', () => {
            const combatState = {
                attacker: { ...player1, hasLeft: true },
                target: player2,
            } as any;

            (service as any).combats.set(game.gameId, combatState);
            const result = service.attackOpponent(game);
            expect(result).toEqual({ success: false });
        });

        it('should return { success: false } if target has left', () => {
            const combatState = {
                attacker: player1,
                target: { ...player2, hasLeft: true },
            } as any;

            (service as any).combats.set(game.gameId, combatState);
            const result = service.attackOpponent(game);
            expect(result).toEqual({ success: false });
        });

        it('should set damage to attackerDamage - targetDefense if > 0', () => {
            player1.attack = 6;
            player1.dice = { atk: 0, def: 0 };
            player2.defense = 2;
            player2.dice = { atk: 0, def: 0 };

            jest.spyOn(Math, 'random').mockReturnValue(0);
            service.initCombat(player1, player2, game);
            const result = service.attackOpponent(game);
            expect(result.combatState.attackResult.damage).toBe(4);
        });

        it('should set damage to 0 if attackerDamage - targetDefense <= 0', () => {
            player1.attack = 2;
            player1.dice = { atk: 0, def: 0 };
            player2.defense = 5;
            player2.dice = { atk: 0, def: 0 };

            jest.spyOn(Math, 'random').mockReturnValue(0);
            service.initCombat(player1, player2, game);
            const result = service.attackOpponent(game);
            expect(result.combatState.attackResult.damage).toBe(0);
        });
    });

    describe('endCombat', () => {
        beforeEach(() => {
            service.initCombat(player1, player2, game);

            (service as any).defaultHp[player1.socketId] = 10;
            (service as any).defaultHp[player2.socketId] = 8;
        });

        it('should reset the combat state', () => {
            const result = service.endCombat(game, player1);

            expect(result.combatState.inCombat).toBe(false);
            expect(result.combatState.attacker).toBe(null);
            expect(result.combatState.target).toBe(null);
            expect(result.combatState.attackResult.damage).toBe(0);
        });

        it('should end the game if a player has won 3 combats', () => {
            player1.battlesWon = 3;

            const result = service.endCombat(game, player1);
            expect(result.gameEnded).toBe(true);
            expect(game.ended).toBe(true);
            expect(game.endTime).toBeDefined();
        });

        it('should reset the number of flee attempts', () => {
            player1.fleeAttempts = 2;
            player2.fleeAttempts = 1;

            service.endCombat(game, player1);

            const combatState = service.getCombatState(game.gameId);
            expect(player1.fleeAttempts).toBe(0);
            expect(player2.fleeAttempts).toBe(0);
        });
    });

    describe('validPlayersPositions', () => {
        it('should return true if the players are horizontally adjacent', () => {
            const pos1 = { x: 0, y: 0 };
            const pos2 = { x: 1, y: 0 };

            expect(service.validPlayersPositions(pos1, pos2)).toBe(true);
        });

        it('should return true if the players are vertically adjacent', () => {
            const pos1 = { x: 0, y: 0 };
            const pos2 = { x: 0, y: 1 };

            expect(service.validPlayersPositions(pos1, pos2)).toBe(true);
        });

        it('should return false if the players are not adjacent', () => {
            const pos1 = { x: 0, y: 0 };
            const pos2 = { x: 1, y: 1 };

            expect(service.validPlayersPositions(pos1, pos2)).toBe(false);
        });
    });

    describe('dropPlayerItems', () => {
        it('should drop the items around the player and remove their effects', () => {
            player1.inventory = ['shield', 'lance'];
            player1.position = { x: 1, y: 1 };

            (service as any).dropPlayerItems(player1, game);

            expect(player1.inventory).toEqual([]);
            expect(player1.isInventoryFull).toBe(false);
            expect(itemService.removeItemEffect).toHaveBeenCalledTimes(2);
            const hasPlacedItems = game.map.items.some((row) => row.some((item) => item === 'shield' || item === 'lance'));
            expect(hasPlacedItems).toBe(true);
        });

        it("should do nothing if the player's inventory is empty", () => {
            player1.inventory = [];
            (service as CombatService).dropPlayerItems(player1, game);
            expect(itemService.removeItemEffect).not.toHaveBeenCalled();
        });
    });

    describe('Position Validation', () => {
        describe('isPositionValidForItem', () => {
            it('should return true for a valid item position', () => {
                expect((service as CombatService).isValidDropPosition(1, 1, game)).toBe(true);
                expect((service as CombatService).isValidDropPosition(2, 2, game)).toBe(true);
            });
        });
    });

    describe('isValidDropPosition', () => {
        it('should return false if the tile is not in validTiles', () => {
            const game = {
                map: {
                    tiles: [
                        ['wall', 'lava'],
                        ['lava', 'wall'],
                    ],
                    items: [
                        ['empty', 'empty'],
                        ['empty', 'empty'],
                    ],
                },
            } as any as Game;

            const result = (service as any).isValidDropPosition(0, 0, game);
            expect(result).toBe(false);
            const result2 = (service as any).isValidDropPosition(1, 1, game);
            expect(result2).toBe(false);
        });

        it('should return false if item slot is not empty', () => {
            const game = {
                map: {
                    tiles: [['grass', 'ice']],
                    items: [['shield', 'lance']],
                },
            } as any as Game;

            const result1 = (service as any).isValidDropPosition(0, 0, game);
            expect(result1).toBe(false);
            const result2 = (service as any).isValidDropPosition(1, 0, game);
            expect(result2).toBe(false);
        });
    });

    describe('attemptFlee', () => {
        it('should return false if combatState or target is missing', () => {
            const result = service.attemptFlee(game, player1);
            expect(result).toEqual({ fled: false, hasCrystal: false });
        });

        it('should return hasCrystal=true if opponent has crystal and has won battles', () => {
            const combatState = {
                target: { ...player2, inventory: ['crystal'], battlesWon: 1 },
                attacker: player1,
            } as any;

            (service as any).combats.set(game.gameId, combatState);

            const result = service.attemptFlee(game, player1);
            expect(result).toEqual({ fled: false, hasCrystal: true });
        });

        it('should return fled=true if flee succeeds and combat is not already counted', () => {
            const combatState = {
                target: player2,
                attacker: player1,
            } as any;

            (service as any).combats.set(game.gameId, combatState);
            jest.spyOn(global.Math, 'random').mockReturnValue(0.1);

            const result = service.attemptFlee(game, player1);
            expect(result.fled).toBe(true);
            expect(result.hasCrystal).toBe(false);
            expect(player1.successfulFleeAttempts).toBe(1);
            expect(player1.combatsParticipated).toBe(1);
            expect(player2.combatsParticipated).toBe(1);
        });

        it('should return fled=false and increment fleeAttempts if flee fails', () => {
            const combatState = {
                target: player2,
                attacker: player1,
            } as any;

            (service as any).combats.set(game.gameId, combatState);
            jest.spyOn(global.Math, 'random').mockReturnValue(0.9);

            const result = service.attemptFlee(game, player1);
            expect(result).toEqual({ fled: false, hasCrystal: false });
            expect(player1.fleeAttempts).toBe(1);
        });

        it('should not recount participation if combatAlreadyCounted is true and flee fails', () => {
            const combatState = {
                target: player2,
                attacker: player1,
                combatAlreadyCounted: true,
            } as any;

            (service as any).combats.set(game.gameId, combatState);
            jest.spyOn(global.Math, 'random').mockReturnValue(0.9);

            const result = service.attemptFlee(game, player1);
            expect(result).toEqual({ fled: false, hasCrystal: false });
            expect(player1.successfulFleeAttempts || 0).toBe(0);
        });
    });
    it('should return the same position if it is not occupied', () => {
        const newPosition = { x: 2, y: 2 };

        const result = service.placePlayerAfterCombat(game, newPosition);

        expect(result).toEqual(newPosition);
    });
    it('should return the closest free tile if the position is occupied', () => {
        const occupiedPosition = { x: 0, y: 0 };

        const result = service.placePlayerAfterCombat(game, occupiedPosition);
        expect(result).not.toEqual(occupiedPosition);
        const isFree = !game.players.some((p) => p.position.x === result.x && p.position.y === result.y);
        expect(isFree).toBe(true);
    });

    it('should return { success: false } if combatState is undefined', () => {
        const result = service.attackOpponent(game); // rien dans combats map
        expect(result).toEqual({ success: false });
    });

    it('should return { success: false } if attacker has left', () => {
        const combatState = {
            attacker: { hasLeft: true },
            target: { hasLeft: false },
            combatAlreadyCounted: false,
        };

        service['combats'].set(game.gameId, combatState as any);

        const result = service.attackOpponent(game);
        expect(result).toEqual({ success: false });
    });

    it('should return { success: false } if target has left', () => {
        const combatState = {
            attacker: { hasLeft: false },
            target: { hasLeft: true },
            combatAlreadyCounted: false,
        };

        service['combats'].set(game.gameId, combatState as any);

        const result = service.attackOpponent(game);
        expect(result).toEqual({ success: false });
    });

    it('should return false if combatState is undefined', () => {
        service['combats'] = new Map(); // empty map

        const result = service.attackOpponent(game);

        expect(result).toEqual({ success: false });
    });
    it('should return false if attacker has left', () => {
        const state = {
            attacker: { ...player1, hasLeft: true },
            target: { ...player2, hasLeft: false },
            combatAlreadyCounted: false,
            attackResult: { damage: 0, attackDiceRoll: 0, defenseDiceRoll: 0 },
        };

        service['combats'].set(game.gameId, state as any);

        const result = service.attackOpponent(game);

        expect(result).toEqual({ success: false });
    });
});
