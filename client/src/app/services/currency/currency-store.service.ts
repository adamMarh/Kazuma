import { inject, Injectable } from '@angular/core';
import { EMPTY_WALLET, WalletDto } from '@app/interfaces/wallet.interface';
import { SocketService } from '@app/services/sockets/socket.service';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { BehaviorSubject, Observable } from 'rxjs';
import { CurrencyService } from './currency.service';

@Injectable({
    providedIn: 'root',
})
export class CurrencyStoreService {
    wallet$: Observable<WalletDto>;
    loading$: Observable<boolean>;

    private walletSubject = new BehaviorSubject<WalletDto>(EMPTY_WALLET);
    private loadingSubject = new BehaviorSubject<boolean>(false);
    private initialized = false;
    private refreshInFlight: Promise<void> | null = null;
    private readonly currencyService = inject(CurrencyService);
    private readonly socketService = inject(SocketService);

    constructor() {
        this.wallet$ = this.walletSubject.asObservable();
        this.loading$ = this.loadingSubject.asObservable();
        this.socketService.on(GAME_EVENTS.WALLET_UPDATED).subscribe(() => {
            this.refresh();
        });
    }

    get wallet(): WalletDto {
        return this.walletSubject.value;
    }

    get balance(): number {
        return this.walletSubject.value.balance;
    }

    get isInitialized(): boolean {
        return this.initialized;
    }

    async refresh(): Promise<void> {
        if (this.refreshInFlight) return this.refreshInFlight;

        this.refreshInFlight = this.doRefresh();
        try {
            await this.refreshInFlight;
        } finally {
            this.refreshInFlight = null;
        }
    }

    reset(): void {
        this.walletSubject.next(EMPTY_WALLET);
        this.loadingSubject.next(false);
        this.initialized = false;
    }

    setWallet(wallet: WalletDto): void {
        this.walletSubject.next(wallet);
        this.initialized = true;
    }

    private async doRefresh(): Promise<void> {
        this.loadingSubject.next(true);
        try {
            const wallet = await this.currencyService.getMyWallet();
            this.walletSubject.next({
                balance: Number(wallet?.balance ?? 0),
                owned: {
                    characters: wallet?.owned?.characters ?? [],
                    visuals: wallet?.owned?.visuals ?? [],
                    sounds: wallet?.owned?.sounds ?? [],
                },
            });
            this.initialized = true;
        } finally {
            this.loadingSubject.next(false);
        }
    }
}
