import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { getShopItemPreviewImage, getShopItemSound, getShopItemVisualClass } from '@app/constants/shop-catalog';
import { CosmeticType, EMPTY_WALLET, ShopItemDto, WalletDto } from '@app/interfaces/wallet.interface';
import { CurrencyStoreService } from '@app/services/currency/currency-store.service';
import { ShopStoreService } from '@app/services/currency/shop-store.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-shop-page',
    standalone: true,
    imports: [CommonModule, RouterLink, TranslatePipe],
    templateUrl: './shop-page.component.html',
    styleUrls: ['./shop-page.component.scss'],
})
export class ShopPageComponent implements OnInit, OnDestroy {
    wallet: WalletDto = EMPTY_WALLET;
    catalog: Record<CosmeticType, ShopItemDto[]> = { characters: [], visuals: [], sounds: [] };
    loading = false;
    buyingItemId: string | null = null;
    playingAudioId: string | null = null;
    categories: { type: CosmeticType; label: string; icon: string }[] = [
        { type: 'characters', label: 'shop.characters', icon: '' },
        { type: 'sounds', label: 'shop.sounds', icon: '' },
        { type: 'visuals', label: 'shop.visuals', icon: '' },
    ];

    private readonly shopStore = inject(ShopStoreService);
    private readonly currencyStore = inject(CurrencyStoreService);

    private walletSub?: Subscription;
    private shopSub?: Subscription;
    private loadingSub?: Subscription;

    async ngOnInit(): Promise<void> {
        this.walletSub = this.currencyStore.wallet$.subscribe((w) => (this.wallet = w));
        this.shopSub = this.shopStore.shop$.subscribe((s) => {
            // Enrichir les articles avec les images preview
            const enrichedCatalog = { ...s.catalog };
            for (const type of Object.keys(enrichedCatalog) as CosmeticType[]) {
                enrichedCatalog[type] = enrichedCatalog[type].map((item) => ({
                    ...item,
                    previewImage: getShopItemPreviewImage(item.id) || undefined,
                }));
            }
            this.catalog = enrichedCatalog;
        });
        this.loadingSub = this.shopStore.loading$.subscribe((v) => (this.loading = v));

        await this.shopStore.refreshShop();
    }

    ngOnDestroy(): void {
        this.walletSub?.unsubscribe();
        this.shopSub?.unsubscribe();
        this.loadingSub?.unsubscribe();
    }

    isOwned(item: ShopItemDto): boolean {
        return this.shopStore.isOwned(item.type, item.id);
    }

    canBuy(item: ShopItemDto): boolean {
        return this.shopStore.canBuy(item);
    }

    async buy(item: ShopItemDto): Promise<void> {
        this.buyingItemId = item.id;
        try {
            await this.shopStore.buy(item);
        } finally {
            this.buyingItemId = null;
        }
    }

    playSound(item: ShopItemDto): void {
        const soundPath = getShopItemSound(item.id);
        if (!soundPath) return;

        // Arrêter le son actuel s'il y en a un
        if (this.playingAudioId === item.id) {
            this.playingAudioId = null;
            return;
        }

        this.playingAudioId = item.id;
        const audio = new Audio(soundPath);
        audio.play().catch(() => {
            this.playingAudioId = null;
        });

        // Réinitialiser le tracking quand le son est terminé
        audio.onended = () => {
            if (this.playingAudioId === item.id) {
                this.playingAudioId = null;
            }
        };
    }

    getVisualClass(item: ShopItemDto): string | null {
        return getShopItemVisualClass(item.id);
    }

    getShopItemSound(itemId: string): string | null {
        return getShopItemSound(itemId);
    }
}
