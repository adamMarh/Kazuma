import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AuthService } from '@app/services/auth/auth.service';
import { LanguageService } from '@app/services/language/language.service';
import { environment } from '@environments/environment';
import { Observable, of, shareReplay, Subject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface AvatarDoc {
    id: string;
    name: string;
    imageBase64: string;
    owner?: string;
}

const DEFAULT_AVATAR_SRC = './assets/images/profile-avatars/avatar1.png';
const MAX_IMAGE_DIMENSION = 400;
const JPEG_QUALITY = 0.8;

@Injectable({ providedIn: 'root' })
export class AvatarService {
    readonly defaultAvatarSrc = DEFAULT_AVATAR_SRC;

    private http = inject(HttpClient);
    private authService = inject(AuthService);
    private languageService = inject(LanguageService);

    // Cache: avatarId or 'uid:<uid>' or 'username:<name>' -> data-URI string
    private cache = new Map<string, string>();
    // In-flight observables to avoid duplicate HTTP requests
    private inflight = new Map<string, Observable<string>>();

    private invalidated$ = new Subject<string[]>();
    readonly avatarInvalidated$ = this.invalidated$.asObservable();

    getAvatarSrcById(avatarId: string): Observable<string> {
        if (!avatarId) return of(DEFAULT_AVATAR_SRC);
        return this.resolve(avatarId, `${environment.serverUrl}/avatars/${encodeURIComponent(avatarId)}`);
    }

    getAvatarSrcByUid(uid: string): Observable<string> {
        if (!uid) return of(DEFAULT_AVATAR_SRC);
        const key = `uid:${uid}`;
        return this.resolve(key, `${environment.serverUrl}/avatars/by-uid/${encodeURIComponent(uid)}`);
    }

    getAvatarSrcByUsername(username: string): Observable<string> {
        if (!username) return of(DEFAULT_AVATAR_SRC);
        const key = `username:${username}`;
        return this.resolve(key, `${environment.serverUrl}/avatars/by-username/${encodeURIComponent(username)}`);
    }

    getMyAvatars(): Observable<AvatarDoc[]> {
        const token = this.authService.getStoredToken();
        if (token) {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
            return this.http
                .get<AvatarDoc[]>(`${environment.serverUrl}/avatars/me/avatars`, { headers })
                .pipe(catchError(() => this.http.get<AvatarDoc[]>(`${environment.serverUrl}/avatars`)));
        }
        return this.http.get<AvatarDoc[]>(`${environment.serverUrl}/avatars`);
    }

    uploadAvatar(imageBase64: string): Observable<AvatarDoc> {
        const token = this.authService.getStoredToken();
        if (!token) throw new Error(this.languageService.translate('messages.authRequired'));
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        return this.http.post<AvatarDoc>(`${environment.serverUrl}/avatars/upload`, { imageBase64 }, { headers }).pipe(
            map((avatar) => {
                this.cache.set(avatar.id, `data:image/jpeg;base64,${avatar.imageBase64}`);
                return avatar;
            }),
        );
    }

    deleteAvatar(avatarId: string): Observable<{ message: string }> {
        const token = this.authService.getStoredToken();
        if (!token) throw new Error(this.languageService.translate('messages.authRequired'));
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        return this.http.delete<{ message: string }>(`${environment.serverUrl}/avatars/${encodeURIComponent(avatarId)}`, { headers }).pipe(
            map((res) => {
                this.cache.delete(avatarId);
                return res;
            }),
        );
    }

    getCached(cacheKey: string): string {
        return this.cache.get(cacheKey) ?? DEFAULT_AVATAR_SRC;
    }

    invalidateUser(uid?: string, username?: string): void {
        const keys: string[] = [];
        if (uid) {
            const key = `uid:${uid}`;
            this.cache.delete(key);
            this.inflight.delete(key);
            keys.push(key);
        }
        if (username) {
            const key = `username:${username}`;
            this.cache.delete(key);
            this.inflight.delete(key);
            keys.push(key);
        }
        if (keys.length) this.invalidated$.next(keys);
    }

    async compressImageFile(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error(this.languageService.translate('messages.fileReadError')));
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error(this.languageService.translate('messages.imageLoadError')));
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    if (width > height) {
                        if (width > MAX_IMAGE_DIMENSION) {
                            height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
                            width = MAX_IMAGE_DIMENSION;
                        }
                    } else if (height > MAX_IMAGE_DIMENSION) {
                        width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
                        height = MAX_IMAGE_DIMENSION;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error(this.languageService.translate('messages.imageCompressionError')));
                        return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1]);
                };
                img.src = reader.result as string;
            };
            reader.readAsDataURL(file);
        });
    }

    private resolve(cacheKey: string, url: string): Observable<string> {
        const cached = this.cache.get(cacheKey);
        if (cached !== undefined) return of(cached);
        const inflight = this.inflight.get(cacheKey);
        if (inflight !== undefined) return inflight;

        const obs$ = this.http.get<{ imageBase64: string } | null>(url).pipe(
            map((res) => {
                const src = res?.imageBase64 ? `data:image/jpeg;base64,${res.imageBase64}` : DEFAULT_AVATAR_SRC;
                this.cache.set(cacheKey, src);
                this.inflight.delete(cacheKey);
                return src;
            }),
            catchError(() => {
                this.inflight.delete(cacheKey);
                return of(DEFAULT_AVATAR_SRC);
            }),
            shareReplay(1),
        );

        this.inflight.set(cacheKey, obs$);
        return obs$;
    }
}
