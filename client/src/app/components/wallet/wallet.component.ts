import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyStoreService } from '@app/services/currency/currency-store.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-wallet',
    standalone: true,
    imports: [CommonModule, RouterLink, TranslatePipe],
    templateUrl: './wallet.component.html',
    styleUrls: ['./wallet.component.scss'],
})
export class WalletComponent implements OnInit, OnDestroy {
    @Input() compact = false;

    balance = 0;
    loading = false;

    private sub?: Subscription;
    private loadingSub?: Subscription;

    private readonly currencyStore = inject(CurrencyStoreService);

    async ngOnInit(): Promise<void> {
        this.sub = this.currencyStore.wallet$.subscribe((w) => (this.balance = w.balance));
        this.loadingSub = this.currencyStore.loading$.subscribe((v) => (this.loading = v));

        if (!this.currencyStore.isInitialized) {
            await this.currencyStore.refresh();
        }
    }

    ngOnDestroy(): void {
        this.sub?.unsubscribe();
        this.loadingSub?.unsubscribe();
    }
}
