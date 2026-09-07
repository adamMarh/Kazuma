import { ItemType } from '@common/interfaces/item.interface';
import { Player } from '@common/interfaces/player.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ItemService {
    applyItemEffect(player: Player, itemType: ItemType): void {
        if (!player.collectedUniqueItems) player.collectedUniqueItems = [];
        if (!player.collectedUniqueItems.includes(itemType)) {
            player.collectedUniqueItems.push(itemType);
        }
        switch (itemType) {
            case 'shield':
                this.applyShieldEffect(player);
                break;
            case 'lance':
                this.applyLanceEffect(player);
                break;
            case 'hourglass':
                this.applyHourglassEffect(player);
                break;
            default:
                break;
        }
    }

    removeItemEffect(player: Player, itemType: ItemType): void {
        switch (itemType) {
            case 'shield':
                this.removeShieldEffect(player);
                break;
            case 'lance':
                this.removeLanceEffect(player);
                break;
            case 'hourglass':
                this.removeHourglassEffect(player);
                break;
            default:
                break;
        }
    }

    canUsePotion(player: Player): boolean {
        return player.healthpoints <= 3 && player.healthpoints > 0 && player.inventory.includes('potion');
    }

    canUseCompas(player: Player): boolean {
        return player.inventory.includes('compas');
    }

    canPreventFlee(player: Player): boolean {
        return player.inventory.includes('crystal') && player.battlesWon > 0;
    }

    canUseHourglass(player: Player): boolean {
        return player.inventory.includes('hourglass');
    }

    private applyShieldEffect(player: Player): void {
        player.defense += 2;
        player.attack -= 1;
    }

    private removeShieldEffect(player: Player): void {
        player.defense -= 2;
        player.attack += 1;
    }

    private applyLanceEffect(player: Player): void {
        player.attack += 1;
        player.defense += 1;
    }

    private removeLanceEffect(player: Player): void {
        player.attack -= 1;
        player.defense -= 1;
    }

    private applyHourglassEffect(player: Player): void {
        player.healthpoints -= 2;
    }

    private removeHourglassEffect(player: Player): void {
        player.healthpoints += 2;
    }
}
