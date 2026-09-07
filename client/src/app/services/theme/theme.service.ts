import { Injectable } from '@angular/core';
import { ThemeName } from '@common/interfaces/theme.interface';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class ThemeService {
    private currentTheme$ = new BehaviorSubject<ThemeName>('normal');

    private readonly themeFilters: Record<ThemeName, string> = {
        normal: 'none',
        cyberpunk: 'hue-rotate(280deg) saturate(1.2) brightness(0.95)',
        forest: 'hue-rotate(90deg) saturate(1.1) brightness(0.98)',
    };

    get theme$(): Observable<ThemeName> {
        return this.currentTheme$.asObservable();
    }

    get currentTheme(): ThemeName {
        return this.currentTheme$.value;
    }

    previewTheme(theme: ThemeName): void {
        this.currentTheme$.next(theme);
        this.applyThemeFilter(theme);
    }

    persistTheme(theme: ThemeName): void {
        localStorage.setItem('app-theme', theme);
        const storedAuth = localStorage.getItem('auth_user');
        if (storedAuth) {
            try {
                const user = JSON.parse(storedAuth);
                user.theme = theme;
                localStorage.setItem('auth_user', JSON.stringify(user));
            } catch {
                // ignore
            }
        }
    }

    setTheme(theme: ThemeName): void {
        this.currentTheme$.next(theme);
        this.applyThemeFilter(theme);
        this.persistTheme(theme);
    }

    initializeTheme(): void {
        const storedAuth = localStorage.getItem('auth_user');
        let theme: ThemeName | null = null;

        if (storedAuth) {
            try {
                const user = JSON.parse(storedAuth);
                if (user.theme && ['normal', 'cyberpunk', 'forest'].includes(user.theme)) {
                    theme = user.theme as ThemeName;
                }
            } catch {
                // ignore
            }
        }

        if (!theme) {
            const savedTheme = localStorage.getItem('app-theme') as ThemeName | null;
            if (savedTheme && ['normal', 'cyberpunk', 'forest'].includes(savedTheme)) {
                theme = savedTheme;
            } else {
                theme = 'normal';
            }
        }

        this.applyThemeFilter(theme);
        this.currentTheme$.next(theme);
        localStorage.setItem('app-theme', theme);
    }

    suspendTheme(): void {
        const htmlElement = document.documentElement;
        htmlElement.style.filter = 'none';
        document.body.classList.remove('theme-active');
    }

    restoreTheme(): void {
        this.applyThemeFilter(this.currentTheme$.value);
    }

    private applyThemeFilter(theme: ThemeName): void {
        const htmlElement = document.documentElement;
        const filter = this.themeFilters[theme] || 'none';
        htmlElement.style.filter = filter;

        if (theme === 'normal') {
            document.body.classList.remove('theme-active');
        } else {
            document.body.classList.add('theme-active');
        }
    }
}
