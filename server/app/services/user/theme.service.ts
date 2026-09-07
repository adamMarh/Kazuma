import { firebaseDb } from '@app/config/firebase-admin.config';
import { ThemeName } from '@common/interfaces/theme.interface';
import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

const THEME_CACHE_TTL_MS = 60_000; // 1 minute, as standard in other services

interface ThemeCacheEntry {
    theme: ThemeName;
    language: 'en' | 'fr';
    expiresAt: number;
}

@Injectable()
export class ThemeService {
    private readonly usersCollection = firebaseDb.collection('users');

    private themeLanguageCache = new Map<string, ThemeCacheEntry>();
    private pendingRequests = new Map<string, Promise<admin.firestore.DocumentSnapshot>>();

    async getTheme(userId: string): Promise<ThemeName> {
        const cached = this.themeLanguageCache.get(userId);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.theme;
        }

        const doc = await this.getUserDoc(userId);
        let theme: ThemeName = 'normal';
        let language: 'en' | 'fr' = 'fr';

        if (doc.exists) {
            const data = doc.data();
            theme = data?.theme || 'normal';
            language = data?.language || 'fr';
        }

        this.themeLanguageCache.set(userId, {
            theme,
            language,
            expiresAt: Date.now() + THEME_CACHE_TTL_MS,
        });

        return theme;
    }

    async getLanguage(userId: string): Promise<'en' | 'fr'> {
        const cached = this.themeLanguageCache.get(userId);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.language;
        }

        const doc = await this.getUserDoc(userId);

        let theme: ThemeName = 'normal';
        let language: 'en' | 'fr' = 'fr';

        if (doc.exists) {
            const data = doc.data();
            theme = data?.theme || 'normal';
            language = data?.language || 'fr';
        }

        this.themeLanguageCache.set(userId, {
            theme,
            language,
            expiresAt: Date.now() + THEME_CACHE_TTL_MS,
        });

        return language;
    }

    async setTheme(userId: string, theme: ThemeName): Promise<void> {
        await this.usersCollection.doc(userId).set({ theme }, { merge: true });
        const cached = this.themeLanguageCache.get(userId);
        if (cached) {
            cached.theme = theme;
            cached.expiresAt = Date.now() + THEME_CACHE_TTL_MS;
        } else {
            // If cache doesn't exist, we just fetch it to populate correctly
            await this.getTheme(userId);
        }
    }

    async setLanguage(userId: string, language: 'en' | 'fr'): Promise<void> {
        await this.usersCollection.doc(userId).set({ language }, { merge: true });
        const cached = this.themeLanguageCache.get(userId);
        if (cached) {
            cached.language = language;
            cached.expiresAt = Date.now() + THEME_CACHE_TTL_MS;
        } else {
            // Fetch cleanly to avoid overwriting theme with default
            await this.getLanguage(userId);
        }
    }

    private async getUserDoc(userId: string): Promise<admin.firestore.DocumentSnapshot> {
        if (!this.pendingRequests.has(userId)) {
            const promise = this.usersCollection
                .doc(userId)
                .get()
                .finally(() => {
                    this.pendingRequests.delete(userId);
                });
            this.pendingRequests.set(userId, promise);
        }
        return this.pendingRequests.get(userId) as Promise<admin.firestore.DocumentSnapshot>;
    }
}
