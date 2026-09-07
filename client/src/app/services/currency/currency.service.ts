import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { BuyRequestDto, ShopResponseDto, WalletDto } from '@app/interfaces/wallet.interface';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

const TOKEN_STORAGE_KEY = 'auth_token';
const WALLET_CACHE_TTL_MS = 300_000; // 5 minutes
const WALLET_CACHE_STORAGE_KEY = 'wallet_by_username_cache';

interface CachedWallet {
    data: WalletDto | null;
    expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class CurrencyService {
    private http = inject(HttpClient);
    private baseUrl = `${environment.serverUrl}/currency`;
    private walletByUsernameCache: Map<string, CachedWallet>;

    constructor() {
        this.walletByUsernameCache = this.loadCacheFromStorage();
    }

    async getShop(): Promise<ShopResponseDto> {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        return await firstValueFrom(
            this.http.get<ShopResponseDto>(`${this.baseUrl}/shop`, {
                headers: token ? { authorization: `Bearer ${token}` } : {},
            }),
        );
    }

    async buy(body: BuyRequestDto): Promise<WalletDto> {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        return await firstValueFrom(
            this.http.post<WalletDto>(`${this.baseUrl}/buy`, body, {
                headers: token ? { authorization: `Bearer ${token}` } : {},
            }),
        );
    }

    async getMyWallet(): Promise<WalletDto> {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);

        return await firstValueFrom(
            this.http.get<WalletDto>(`${this.baseUrl}/me`, {
                headers: token ? { authorization: `Bearer ${token}` } : {},
            }),
        );
    }

    async getWalletByUsername(username: string): Promise<WalletDto | null> {
        const cached = this.walletByUsernameCache.get(username);
        if (cached && Date.now() < cached.expiresAt) {
            return cached.data;
        }

        try {
            const res = await firstValueFrom(this.http.get<{ wallet: WalletDto | null }>(`${this.baseUrl}/user/${encodeURIComponent(username)}`));
            const wallet = res?.wallet ?? null;
            this.walletByUsernameCache.set(username, { data: wallet, expiresAt: Date.now() + WALLET_CACHE_TTL_MS });
            this.saveCacheToStorage();
            return wallet;
        } catch (err) {
            return null;
        }
    }

    private loadCacheFromStorage(): Map<string, CachedWallet> {
        try {
            const raw = localStorage.getItem(WALLET_CACHE_STORAGE_KEY);
            if (!raw) return new Map();
            const entries: [string, CachedWallet][] = JSON.parse(raw);
            const now = Date.now();
            return new Map(entries.filter(([, v]) => now < v.expiresAt));
        } catch {
            return new Map();
        }
    }

    private saveCacheToStorage(): void {
        try {
            const entries = Array.from(this.walletByUsernameCache.entries());
            localStorage.setItem(WALLET_CACHE_STORAGE_KEY, JSON.stringify(entries));
        } catch {
            // quota exceeded or private mode — ignore
        }
    }
}
