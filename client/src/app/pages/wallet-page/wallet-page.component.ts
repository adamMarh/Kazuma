import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { getShopItemPreviewImage, getShopItemSound, getShopItemVisualClass } from '@app/constants/shop-catalog';
import { EMPTY_WALLET, WalletDto } from '@app/interfaces/wallet.interface';
import { ChallengeService } from '@app/services/challenge/challenge.service';
import { CurrencyStoreService } from '@app/services/currency/currency-store.service';
import { ShopStoreService } from '@app/services/currency/shop-store.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { ChallengeRecord } from '@common/interfaces/challenge.interface';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-wallet-page',
    standalone: true,
    imports: [CommonModule, DatePipe, RouterLink, TranslatePipe],
    templateUrl: './wallet-page.component.html',
    styleUrls: ['./wallet-page.component.scss'],
})
export class WalletPageComponent implements OnInit, OnDestroy {
    wallet: WalletDto = EMPTY_WALLET;
    loading = false;
    challengeHistory: ChallengeRecord[] = [];
    playingAudioId: string | null = null;

    private readonly currencyStore = inject(CurrencyStoreService);
    private readonly challengeService = inject(ChallengeService);
    private readonly shopStore = inject(ShopStoreService);

    private sub?: Subscription;
    private loadingSub?: Subscription;
    private challengeSub?: Subscription;

    cosmeticName(id: string): string {
        return this.shopStore.getItemName(id);
    }

    async ngOnInit(): Promise<void> {
        this.sub = this.currencyStore.wallet$.subscribe((w) => (this.wallet = w));
        this.loadingSub = this.currencyStore.loading$.subscribe((v) => (this.loading = v));
        this.challengeSub = this.challengeService.challengeHistory$.subscribe((h) => (this.challengeHistory = h));

        await this.currencyStore.refresh();
        await this.shopStore.refreshShop();
        this.challengeService.loadChallengeHistory();
    }

    ngOnDestroy(): void {
        this.sub?.unsubscribe();
        this.loadingSub?.unsubscribe();
        this.challengeSub?.unsubscribe();
    }

    playSoundById(id: string): void {
        const soundPath = getShopItemSound(id);
        if (!soundPath) return;

        if (this.playingAudioId === id) {
            this.playingAudioId = null;
            return;
        }

        this.playingAudioId = id;
        const audio = new Audio(soundPath);
        audio.play().catch(() => {
            this.playingAudioId = null;
        });

        audio.onended = () => {
            if (this.playingAudioId === id) this.playingAudioId = null;
        };
    }

    getPreviewImage(id: string): string | null {
        return getShopItemPreviewImage(id);
    }

    getVisualClass(id: string): string | null {
        return getShopItemVisualClass(id);
    }

    async refresh(): Promise<void> {
        await this.currencyStore.refresh();
    }
}
