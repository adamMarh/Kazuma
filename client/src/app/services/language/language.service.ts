import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import enTranslations from './translations/en.json';
import frTranslations from './translations/fr.json';

export type Language = 'fr' | 'en';

interface Translations {
    [key: string]: string | { [key: string]: string | { [key: string]: string } };
}

@Injectable({
    providedIn: 'root',
})
export class LanguageService {
    currentLanguage$: Observable<Language>;

    private readonly languageStorageKey = 'selected-language';
    private readonly defaultLanguage: Language = 'fr';
    private currentLanguageSubject = new BehaviorSubject<Language>(this.defaultLanguage);

    private translations: { [key in Language]: Translations } = {
        fr: frTranslations as Translations,
        en: enTranslations as Translations,
    };

    constructor() {
        this.currentLanguage$ = this.currentLanguageSubject.asObservable();
    }
    get currentLanguage(): Language {
        return this.currentLanguageSubject.value;
    }
    initializeLanguage(): void {
        const storedAuth = localStorage.getItem('auth_user');
        let lang: Language | null = null;

        if (storedAuth) {
            try {
                const user = JSON.parse(storedAuth);
                if (user.language === 'en' || user.language === 'fr') {
                    lang = user.language;
                }
            } catch {
                // ignore
            }
        }

        if (!lang) {
            const stored = localStorage.getItem(this.languageStorageKey) as Language | null;
            if (stored === 'en' || stored === 'fr') {
                lang = stored;
            } else {
                lang = 'fr';
            }
        }

        localStorage.setItem(this.languageStorageKey, lang);
        this.currentLanguageSubject.next(lang);
    }

    previewLanguage(language: Language): void {
        if (language === 'fr' || language === 'en') {
            this.currentLanguageSubject.next(language);
        }
    }

    persistLanguage(language: Language): void {
        if (language === 'fr' || language === 'en') {
            localStorage.setItem(this.languageStorageKey, language);
            const storedAuth = localStorage.getItem('auth_user');
            if (storedAuth) {
                try {
                    const user = JSON.parse(storedAuth);
                    user.language = language;
                    localStorage.setItem('auth_user', JSON.stringify(user));
                } catch {
                    // ignore
                }
            }
        }
    }

    setLanguage(language: Language): void {
        if (language === 'fr' || language === 'en') {
            this.currentLanguageSubject.next(language);
            this.persistLanguage(language);
        }
    }

    translate(key: string, params?: { [key: string]: string | number }): string {
        const language = this.currentLanguage;
        let translation = this.getValueByPath(this.translations[language], key);

        if (!translation) {
            return key;
        }

        // Remplacer les paramètres si fournis
        if (params) {
            Object.keys(params).forEach((param) => {
                translation = (translation as string).replace(`{{${param}}}`, String(params[param]));
            });
        }

        return translation as string;
    }

    getAvailableLanguages(): Language[] {
        return ['fr', 'en'];
    }

    getLanguageLabel(language: Language): string {
        const labels: { [key in Language]: string } = {
            fr: 'Français',
            en: 'English',
        };
        return labels[language];
    }

    private getValueByPath(obj: Translations, path: string): string | undefined {
        const keys = path.split('.');
        let value: unknown = obj;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in (value as Record<string, unknown>)) {
                value = (value as Record<string, unknown>)[key];
            } else {
                return undefined;
            }
        }

        return typeof value === 'string' ? value : undefined;
    }
}
