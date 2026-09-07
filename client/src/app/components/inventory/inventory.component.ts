import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { TIMER_3000 } from '@app/constants/different-timer';
import { TEN_CONSTANT } from '@app/constants/grid';
import { GameService } from '@app/services/game/game.service';
import { LanguageService } from '@app/services/language/language.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { ITEM_SETTINGS, ItemType } from '@common/interfaces/item.interface';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/interfaces/position.interface';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-inventory',
    standalone: true,
    imports: [TranslatePipe],
    templateUrl: './inventory.component.html',
    styleUrls: ['./inventory.component.scss'],
})
export class InventoryComponent implements OnInit, OnDestroy {
    @Input() player!: Player;
    itemSettings = ITEM_SETTINGS;
    chooseItemVisible = false;
    itemsToChoose: {
        type: string;
        description: string;
        image: string;
    }[] = [];
    currentEncounteredItemPosition: Position | null = null;
    currentTooltip: {
        type: string;
        description: string;
        image: string;
    } | null = null;
    potionActivatedMessage: string = '';
    showPotionMessage: boolean = false;
    itemEffectMessage: string = '';
    showItemEffectMessage: boolean = false;
    hoveredItem: ItemType | null = null;
    tooltipPosition = { x: 0, y: 0 };

    private gameService = inject(GameService);
    private languageService = inject(LanguageService);
    private subscriptions: Subscription[] = [];

    ngOnInit(): void {
        this.subscribeToChooseItem();
        this.subscribeToItemEffects();
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((sub) => sub.unsubscribe());
    }

    dropItem(itemType: string): void {
        if (!this.currentEncounteredItemPosition) return;
        this.gameService.dropItem({
            position: this.currentEncounteredItemPosition,
            type: itemType as ItemType,
        });
        this.itemsToChoose = [];
        this.currentEncounteredItemPosition = null;
        this.chooseItemVisible = false;
        this.currentTooltip = null;
    }

    showTooltip(item: { type: string; description: string; image: string }): void {
        this.currentTooltip = item;
    }

    hideTooltip(): void {
        this.currentTooltip = null;
    }

    showItemTooltip(item: ItemType, event?: MouseEvent): void {
        this.hoveredItem = item;

        if (event) {
            const target = event.currentTarget as HTMLElement;
            const rect = target.getBoundingClientRect();

            const tooltipWidth = 180;
            const tooltipHeight = 80;

            let x = rect.left + rect.width / 2 - tooltipWidth / 2;
            let y = rect.top - tooltipHeight - TEN_CONSTANT;

            const windowWidth = window.innerWidth;
            if (x < TEN_CONSTANT) x = TEN_CONSTANT;
            if (x + tooltipWidth > windowWidth - TEN_CONSTANT) x = windowWidth - tooltipWidth - TEN_CONSTANT;

            if (y < TEN_CONSTANT) {
                y = rect.bottom + TEN_CONSTANT;
            }

            this.tooltipPosition = {
                x: x - rect.left,
                y: y - rect.top,
            };
        } else {
            this.tooltipPosition = { x: 50, y: -80 };
        }
    }

    hideItemTooltip(): void {
        this.hoveredItem = null;
    }

    private getTranslatedItemDescription(itemType: string): string {
        const key = `items.${itemType}`;
        const translated = this.languageService.translate(key);
        return translated !== key ? translated : ITEM_SETTINGS[itemType as ItemType].description;
    }

    private subscribeToChooseItem(): void {
        const sub = this.gameService.onChooseItem().subscribe((data: { item: { position: Position; type: string } }) => {
            this.currentEncounteredItemPosition = data.item.position;
            const inventoryItems = this.player.inventory.map((type) => ({
                type,
                description: this.getTranslatedItemDescription(type),
                image: ITEM_SETTINGS[type].image,
            }));
            const newItem = {
                type: data.item.type,
                description: this.getTranslatedItemDescription(data.item.type),
                image: ITEM_SETTINGS[data.item.type as ItemType].image,
            };
            this.itemsToChoose = [...inventoryItems, newItem];
            this.chooseItemVisible = true;
        });
        this.subscriptions.push(sub);
    }

    private subscribeToItemEffects(): void {
        const effectsSub = this.gameService.onItemEffectApplied().subscribe((data) => {
            if (data.playerId === this.player.socketId) {
                if (data.itemType === 'hourglass') {
                    this.itemEffectMessage = this.languageService.translate('inventory.hourglassObtained');
                    this.showItemEffectMessage = true;
                    setTimeout(() => {
                        this.showItemEffectMessage = false;
                    }, TIMER_3000);
                } else if (['shield', 'lance', 'crystal', 'compas', 'potion'].includes(data.itemType)) {
                    this.itemEffectMessage = this.languageService.translate('inventory.itemObtained', {
                        item: data.itemType,
                        description: this.getTranslatedItemDescription(data.itemType),
                    });
                    this.showItemEffectMessage = true;
                    setTimeout(() => {
                        this.showItemEffectMessage = false;
                    }, TIMER_3000);
                }
            }
        });
        this.subscriptions.push(effectsSub);
        const removeSub = this.gameService.onItemEffectRemoved().subscribe((data) => {
            if (data.playerId === this.player.socketId) {
                if (data.itemType === 'hourglass') {
                    this.itemEffectMessage = this.languageService.translate('inventory.hourglassLost');
                    this.showItemEffectMessage = true;
                    setTimeout(() => {
                        this.showItemEffectMessage = false;
                    }, TIMER_3000);
                }
            }
        });
        this.subscriptions.push(removeSub);
        const droppedSub = this.gameService.onItemDropped().subscribe((data) => {
            if (data.playerId === this.player.socketId) {
                this.itemEffectMessage = this.languageService.translate('inventory.deathItemsLost');
                this.showItemEffectMessage = true;
                setTimeout(() => {
                    this.showItemEffectMessage = false;
                }, TIMER_3000);
            }
        });
        this.subscriptions.push(droppedSub);
    }
}
