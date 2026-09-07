import { Injectable, inject } from '@angular/core';
import { CosmeticType, ShopItemDto, ShopResponseDto } from '@app/interfaces/wallet.interface';
import { BehaviorSubject, Observable } from 'rxjs';
import { CurrencyStoreService } from './currency-store.service';
import { CurrencyService } from './currency.service';

type ShopState = {
    catalog: Record<CosmeticType, ShopItemDto[]>;
};

const EMPTY_SHOP: ShopState = {
    catalog: { characters: [], visuals: [], sounds: [] },
};

@Injectable({ providedIn: 'root' })
export class ShopStoreService {
    // ✅ publics d'abord (lint OK)
    shop$: Observable<ShopState>;
    loading$: Observable<boolean>;

    // ✅ ensuite privés
    private shopSubject = new BehaviorSubject<ShopState>(EMPTY_SHOP);
    private loadingSubject = new BehaviorSubject<boolean>(false);

    // ✅ injection via inject()
    private readonly currencyService = inject(CurrencyService);
    private readonly currencyStore = inject(CurrencyStoreService);

    constructor() {
        this.shop$ = this.shopSubject.asObservable();
        this.loading$ = this.loadingSubject.asObservable();
    }

    get catalog(): ShopState['catalog'] {
        return this.shopSubject.value.catalog;
    }

    async refreshShop(): Promise<void> {
        this.loadingSubject.next(true);
        try {
            const res: ShopResponseDto = await this.currencyService.getShop();
            this.shopSubject.next({ catalog: res.catalog });
            await this.currencyStore.refresh();
        } finally {
            this.loadingSubject.next(false);
        }
    }

    isOwned(type: CosmeticType, itemId: string): boolean {
        const owned = this.currencyStore.wallet.owned?.[type] ?? [];
        return owned.includes(itemId);
    }

    canBuy(item: ShopItemDto): boolean {
        return !this.isOwned(item.type, item.id) && this.currencyStore.balance >= item.price;
    }

    async buy(item: ShopItemDto): Promise<void> {
        if (!this.canBuy(item)) return;

        this.loadingSubject.next(true);
        try {
            const wallet = await this.currencyService.buy({ type: item.type, itemId: item.id });
            this.currencyStore.setWallet(wallet);
        } finally {
            this.loadingSubject.next(false);
        }
    }

    getItemName(itemId: string): string {
        for (const items of Object.values(this.catalog)) {
            const found = items.find((i) => i.id === itemId);
            if (found) return found.name;
        }
        return itemId;
    }
}
