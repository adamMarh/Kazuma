import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { EMPTY_WALLET } from '@app/interfaces/wallet.interface';
import { CurrencyStoreService } from '@app/services/currency/currency-store.service';
import { of } from 'rxjs';

import { WalletPageComponent } from './wallet-page.component';

describe('WalletPageComponent', () => {
    let component: WalletPageComponent;
    let fixture: ComponentFixture<WalletPageComponent>;
    let routerSpy: jasmine.SpyObj<Router>;
    let currencyStoreMock: Partial<CurrencyStoreService>;

    beforeEach(async () => {
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        currencyStoreMock = {
            wallet$: of(EMPTY_WALLET),
            loading$: of(false),
            isInitialized: true,
            refresh: jasmine.createSpy('refresh').and.resolveTo(),
        };

        await TestBed.configureTestingModule({
            imports: [WalletPageComponent],
            providers: [
                { provide: Router, useValue: routerSpy },
                { provide: CurrencyStoreService, useValue: currencyStoreMock },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(WalletPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
