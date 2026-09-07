import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { GameMap, MapVisibility } from '@app/interfaces/game-map.interface';
import { AuthService } from '@app/services/auth/auth.service';
import { BehaviorSubject, catchError, Observable, tap, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class MapService {
    mapsSubject = new BehaviorSubject<GameMap[]>([]);
    maps$ = this.mapsSubject.asObservable();

    private http = inject(HttpClient);
    private authService = inject(AuthService);
    private readonly error404: number = 404;
    private readonly apiUrl = `${environment.serverUrl}/maps`;

    private get username(): string {
        return this.authService.currentUsername || '';
    }

    getAllMaps(): Observable<GameMap[]> {
        return this.http.get<GameMap[]>(this.apiUrl);
    }

    /** Load maps for admin view: owned + public */
    loadMaps(): void {
        this.http.get<GameMap[]>(`${this.apiUrl}?filter=admin&username=${encodeURIComponent(this.username)}`).subscribe((maps) => {
            this.mapsSubject.next(maps);
        });
    }

    /** Load maps for game creation view: owned + public + private-shared */
    loadMapsForGameCreation(): void {
        this.http.get<GameMap[]>(`${this.apiUrl}?filter=gameCreation&username=${encodeURIComponent(this.username)}`).subscribe((maps) => {
            this.mapsSubject.next(maps);
        });
    }

    saveMap(map: GameMap): Observable<GameMap> {
        return this.http.post<GameMap>(this.apiUrl, { ...map, owner: this.username });
    }

    updateMap(id: string | undefined, map: GameMap): Observable<GameMap> {
        return this.http.put<GameMap>(`${this.apiUrl}/${id}?username=${encodeURIComponent(this.username)}`, map);
    }

    loadMap(id: string | undefined): Observable<GameMap> {
        return this.http.get<GameMap>(`${this.apiUrl}/${id}`);
    }

    editMap(updatedMap: GameMap): Observable<GameMap> {
        return this.http.put<GameMap>(`${this.apiUrl}/${updatedMap._id}?username=${encodeURIComponent(this.username)}`, updatedMap).pipe(
            tap((editedMap) => {
                const updatedMaps = this.mapsSubject.getValue().map((map) => (map._id === editedMap._id ? editedMap : map));
                this.mapsSubject.next(updatedMaps);
            }),
        );
    }

    deleteMap(mapId: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${mapId}?username=${encodeURIComponent(this.username)}`).pipe(
            tap(() => {
                const updatedMaps = this.mapsSubject.getValue().filter((m) => m._id !== mapId);
                this.mapsSubject.next(updatedMaps);
            }),
            catchError((err) => {
                if (err.status === this.error404) {
                    const updatedMaps = this.mapsSubject.getValue().filter((m) => m._id !== mapId);
                    this.mapsSubject.next(updatedMaps);
                    return throwError(() => err);
                }
                return throwError(() => err);
            }),
        );
    }

    updateVisibility(mapId: string, visibility: MapVisibility): Observable<GameMap> {
        return this.http.patch<GameMap>(`${this.apiUrl}/${mapId}/visibility?username=${encodeURIComponent(this.username)}`, { visibility }).pipe(
            tap((updatedMap) => {
                const updatedMaps = this.mapsSubject.getValue().map((map) => {
                    return map._id === mapId ? updatedMap : map;
                });
                this.mapsSubject.next(updatedMaps);
            }),
            catchError((err) => {
                if (err.status === this.error404) {
                    const updatedMaps = this.mapsSubject.getValue().filter((m) => m._id !== mapId);
                    this.mapsSubject.next(updatedMaps);
                    return throwError(() => err);
                }
                return throwError(() => err);
            }),
        );
    }

    duplicateMap(mapId: string): Observable<GameMap> {
        return this.http.post<GameMap>(`${this.apiUrl}/${mapId}/duplicate?username=${encodeURIComponent(this.username)}`, {}).pipe(
            tap((newMap) => {
                const currentMaps = this.mapsSubject.getValue();
                this.mapsSubject.next([...currentMaps, newMap]);
            }),
        );
    }

    checkNameAvailability(name: string, excludeId?: string): Observable<{ taken: boolean }> {
        let url = `${this.apiUrl}/check-name?name=${encodeURIComponent(name)}`;
        if (excludeId) {
            url += `&excludeId=${encodeURIComponent(excludeId)}`;
        }
        return this.http.get<{ taken: boolean }>(url);
    }

    checkGameAvailability(gameId: string): Observable<boolean> {
        return this.http.get<boolean>(`${this.apiUrl}/${gameId}/available?username=${encodeURIComponent(this.username)}`);
    }

    isOwner(map: GameMap): boolean {
        return map.owner === this.username;
    }
}
