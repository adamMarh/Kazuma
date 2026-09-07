import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { DEFAULT_FIREBASE_ERROR_MESSAGE, FIREBASE_ERROR_MESSAGES, MIN_USERNAME_LENGTH } from '@app/constants/auth-error-messages';
import { CurrencyStoreService } from '@app/services/currency/currency-store.service';
import { LanguageService } from '@app/services/language/language.service';
import { ThemeService } from '@app/services/theme/theme.service';
import { environment } from '@environments/environment';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';

export interface AuthUser {
    uid: string;
    email: string;
    displayName: string | null;
    avatar?: string | null;
    theme?: string;
    language?: string;
}

export interface AuthResponse {
    uid: string;
    email: string;
    username: string;
    idToken: string;
    avatar?: string | null;
    theme?: string;
    language?: string;
}

const TOKEN_STORAGE_KEY = 'auth_token';
const USER_STORAGE_KEY = 'auth_user';

function authError(code: string, message?: string): Error {
    const e = new Error(message ?? code);
    (e as { code?: string }).code = code;
    return e;
}

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    currentUser$: Observable<AuthUser | null>;

    private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
    private http = inject(HttpClient);
    private router = inject(Router);
    private apiUrl = `${environment.serverUrl}/auth`;
    private currencyStore = inject(CurrencyStoreService);
    private languageService = inject(LanguageService);
    private themeService = inject(ThemeService);

    constructor() {
        this.currentUser$ = this.currentUserSubject.asObservable();
        this.restoreSession();
    }

    get isLoggedIn(): boolean {
        return this.currentUserSubject.value !== null;
    }

    get currentUser(): AuthUser | null {
        return this.currentUserSubject.value;
    }

    get currentUsername(): string | null {
        const user = this.currentUserSubject.value;
        return user?.displayName ?? null;
    }

    async signUp(email: string, password: string, username?: string, avatar?: string): Promise<void> {
        const rawUsername = (username ?? '').trim();
        if (!rawUsername || rawUsername.length < MIN_USERNAME_LENGTH) {
            throw authError('auth/invalid-username');
        }

        try {
            const response = await firstValueFrom(
                this.http.post<AuthResponse>(`${this.apiUrl}/signup`, {
                    email,
                    password,
                    username: rawUsername,
                    avatar,
                }),
            );
            this.setSession(response);
        } catch (error: unknown) {
            throw this.handleHttpError(error);
        }
    }

    async signIn(identifier: string, password: string): Promise<void> {
        const rawIdentifier = (identifier ?? '').trim();
        if (!rawIdentifier) {
            throw authError('auth/invalid-credential');
        }

        try {
            const response = await firstValueFrom(
                this.http.post<AuthResponse>(`${this.apiUrl}/signin`, {
                    identifier: rawIdentifier,
                    password,
                }),
            );
            this.setSession(response);
        } catch (error: unknown) {
            throw this.handleHttpError(error);
        }
    }

    async signOutUser(): Promise<void> {
        const token = this.getStoredToken();
        if (token) {
            try {
                await firstValueFrom(
                    this.http.post(
                        `${this.apiUrl}/signout`,
                        {},
                        {
                            // eslint-disable-next-line @typescript-eslint/naming-convention
                            headers: { Authorization: `Bearer ${token}` },
                        },
                    ),
                );
            } catch {
                // Proceed with local cleanup even if server call fails
            }
        }
        this.clearLocalSession();
        this.router.navigate(['/auth']);
    }

    async clearSession(): Promise<void> {
        const token = this.getStoredToken();
        this.clearLocalSession();
        if (token) {
            try {
                await firstValueFrom(
                    this.http.post(
                        `${this.apiUrl}/clear-session`,
                        {},
                        {
                            // eslint-disable-next-line @typescript-eslint/naming-convention
                            headers: { Authorization: `Bearer ${token}` },
                        },
                    ),
                );
            } catch {
                // Silently fail — called on window close
            }
        }
    }

    async deleteAccount(): Promise<void> {
        const token = this.getStoredToken();
        if (!token) throw authError('auth/no-token');

        try {
            await firstValueFrom(
                this.http.post(
                    `${this.apiUrl}/delete-account`,
                    {},
                    {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        headers: { Authorization: `Bearer ${token}` },
                    },
                ),
            );

            // succès uniquement
            this.clearLocalSession();
            this.currencyStore.reset();
            this.router.navigate(['/auth']);
        } catch (e) {
            throw this.handleHttpError(e);
        }
    }

    getFirebaseErrorMessage(errorCode: string): string {
        const key = FIREBASE_ERROR_MESSAGES[errorCode] ?? DEFAULT_FIREBASE_ERROR_MESSAGE;
        return this.languageService.translate(key);
    }

    getStoredToken(): string | null {
        return localStorage.getItem(TOKEN_STORAGE_KEY);
    }

    async updateProfile(username: string, email: string, avatar: string | null, theme?: string, language?: string): Promise<void> {
        const token = this.getStoredToken();
        if (!token) throw authError('auth/no-token');

        const currentUser = this.currentUserSubject.value;
        if (!currentUser) throw authError('auth/no-user');

        try {
            const response = await firstValueFrom(
                this.http.patch<{
                    uid: string;
                    email: string;
                    username: string;
                    avatar: string;
                    theme?: string;
                    language?: string;
                }>(
                    `${this.apiUrl}/update-profile`,
                    {
                        email: email.trim(),
                        username: username.trim(),
                        avatar: avatar ?? '',
                        ...(theme && { theme }),
                        ...(language && { language }),
                    },
                    {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        headers: { Authorization: `Bearer ${token}` },
                    },
                ),
            );

            const updatedUser: AuthUser = {
                ...currentUser,
                email: response.email,
                displayName: response.username,
                avatar: response.avatar,
                theme: response.theme ?? currentUser.theme,
                language: response.language ?? currentUser.language,
            };

            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
            this.currentUserSubject.next(updatedUser);
        } catch (error: unknown) {
            throw this.handleHttpError(error);
        }
    }

    private setSession(response: AuthResponse): void {
        const user: AuthUser = {
            uid: response.uid,
            email: response.email,
            displayName: response.username,
            avatar: response.avatar ?? null,
            theme: response.theme,
            language: response.language,
        };

        localStorage.setItem(TOKEN_STORAGE_KEY, response.idToken);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        this.currentUserSubject.next(user);
        void this.currencyStore.refresh();
        this.themeService.initializeTheme();
        this.languageService.initializeLanguage();
    }

    private clearLocalSession(): void {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
        this.currentUserSubject.next(null);
    }

    private restoreSession(): void {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        const userJson = localStorage.getItem(USER_STORAGE_KEY);

        if (token && userJson) {
            try {
                const user = JSON.parse(userJson) as AuthUser;
                this.currentUserSubject.next(user);
                // Skip server-side validation in the popup window to avoid
                // clearing the shared localStorage on failure, which would
                // break subsequent popup instances.
                if (!window.location.hash.includes('chat-popup')) {
                    this.validateToken(token);
                }
            } catch {
                this.clearLocalSession();
            }
        }
    }

    private async validateToken(token: string): Promise<void> {
        try {
            const user = await firstValueFrom(
                this.http.get<{ uid: string; email: string; username: string; avatarId: string | null; theme?: string; language?: string }>(
                    `${this.apiUrl}/me`,
                    {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        headers: { Authorization: `Bearer ${token}` },
                    },
                ),
            );

            const authUser: AuthUser = {
                uid: user.uid,
                email: user.email,
                displayName: user.username,
                avatar: user.avatarId ?? null,
                theme: user.theme,
                language: user.language,
            };

            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUser));
            this.currentUserSubject.next(authUser);
            void this.currencyStore.refresh();
        } catch {
            this.clearLocalSession();
        }
    }

    private handleHttpError(error: unknown): Error {
        if (error instanceof HttpErrorResponse) {
            const code = error.error?.code || 'auth/unknown';
            return authError(code, error.error?.message);
        }
        return error instanceof Error ? error : authError('auth/unknown');
    }
}
