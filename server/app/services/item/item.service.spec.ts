/* eslint-disable @typescript-eslint/no-magic-numbers */
import { Player } from '@common/interfaces/player.interface';
import { ItemService } from './item.service';

describe('ItemService', () => {
    let service: ItemService;
    let player: Player;

    beforeEach(() => {
        service = new ItemService();
        player = {
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
    });

    describe('applyItemEffect', () => {
        it('should apply the shield effect', () => {
            service.applyItemEffect(player, 'shield');
            expect(player.defense).toBe(5);
            expect(player.attack).toBe(3);
        });

        it('should apply the spear effect', () => {
            service.applyItemEffect(player, 'lance');
            expect(player.defense).toBe(4);
            expect(player.attack).toBe(5);
        });

        it('should apply the hourglass effect', () => {
            service.applyItemEffect(player, 'hourglass');
            expect(player.healthpoints).toBe(8);
        });

        it("should not modify the player's stats for other item types", () => {
            const original = {
                attack: player.attack,
                defense: player.defense,
                healthpoints: player.healthpoints,
                movementPoints: player.movementPoints,
                actionPoints: player.actionPoints,
            };

            service.applyItemEffect(player, 'potion');

            const after = {
                attack: player.attack,
                defense: player.defense,
                healthpoints: player.healthpoints,
                movementPoints: player.movementPoints,
                actionPoints: player.actionPoints,
            };

            expect(after).toEqual(original);
        });
    });

    describe('removeItemEffect', () => {
        it('should remove the shield effect', () => {
            player.defense = 5;
            player.attack = 3;
            service.removeItemEffect(player, 'shield');
            expect(player.defense).toBe(3);
            expect(player.attack).toBe(4);
        });

        it('should remove the spear effect', () => {
            player.defense = 4;
            player.attack = 5;
            service.removeItemEffect(player, 'lance');
            expect(player.defense).toBe(3);
            expect(player.attack).toBe(4);
        });

        it('should remove the hourglass effect', () => {
            player.healthpoints = 8;
            service.removeItemEffect(player, 'hourglass');
            expect(player.healthpoints).toBe(10);
        });

        it('should not modify the player for other item types', () => {
            const originalPlayer = { ...player };
            service.removeItemEffect(player, 'potion');
            expect(player).toEqual(originalPlayer);
        });
    });

    describe('canUsePotion', () => {
        it('should return true when the player has a potion and low health points', () => {
            player.inventory = ['potion'];
            player.healthpoints = 3;
            expect(service.canUsePotion(player)).toBe(true);
        });

        it('should return false when the player has a potion but too many health points', () => {
            player.inventory = ['potion'];
            player.healthpoints = 4;
            expect(service.canUsePotion(player)).toBe(false);
        });

        it('should return false when the player has no potion', () => {
            player.inventory = ['shield'];
            player.healthpoints = 3;
            expect(service.canUsePotion(player)).toBe(false);
        });

        it('should return false when the player has 0 health points', () => {
            player.inventory = ['potion'];
            player.healthpoints = 0;
            expect(service.canUsePotion(player)).toBe(false);
        });
    });

    describe('canUseCompas', () => {
        it('should return true when the player has a compass', () => {
            player.inventory = ['compas'];
            expect(service.canUseCompas(player)).toBe(true);
        });

        it('should return false when the player has no compass', () => {
            player.inventory = ['shield'];
            expect(service.canUseCompas(player)).toBe(false);
        });
    });

    describe('canPreventFlee', () => {
        it('should return true when the player has a crystal and has won combats', () => {
            player.inventory = ['crystal'];
            player.battlesWon = 1;
            expect(service.canPreventFlee(player)).toBe(true);
        });

        it('should return false when the player has a crystal but has not won any combats', () => {
            player.inventory = ['crystal'];
            player.battlesWon = 0;
            expect(service.canPreventFlee(player)).toBe(false);
        });

        it('should return false when the player has no crystal', () => {
            player.inventory = ['shield'];
            player.battlesWon = 1;
            expect(service.canPreventFlee(player)).toBe(false);
        });
    });

    describe('canUseHourglass', () => {
        it('should return true when the player has an hourglass', () => {
            player.inventory = ['hourglass'];
            expect(service.canUseHourglass(player)).toBe(true);
        });

        it('should return false when the player has no hourglass', () => {
            player.inventory = ['shield'];
            expect(service.canUseHourglass(player)).toBe(false);
        });
    });
});