import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@environments/environment';

export interface AccountStats {
    gamesPlayedClassic: number;
    gamesPlayedCTF: number;
    gamesWon: number;
    totalGameTimeMs: number;
}

@Injectable({
    providedIn: 'root',
})
export class StatsService {
    private http = inject(HttpClient);
    private readonly tokenStorageKey = 'auth_token';

    async getStats(): Promise<AccountStats> {
        const token = localStorage.getItem(this.tokenStorageKey);
        if (!token) {
            return this.getEmptyStats();
        }

        return new Promise((resolve) => {
            const headers = new HttpHeaders({
                authorization: `Bearer ${token}`,
            });

            this.http.get<AccountStats>(`${environment.serverUrl}/auth/stats`, { headers }).subscribe({
                next: (data) => resolve(data),
                error: () => {
                    resolve(this.getEmptyStats());
                },
            });
        });
    }

    getTotalGamesPlayed(stats: AccountStats): number {
        return stats.gamesPlayedClassic + stats.gamesPlayedCTF;
    }

    getAverageGameTime(stats: AccountStats): string {
        const totalGames = this.getTotalGamesPlayed(stats);
        if (totalGames === 0) return '0:00';

        const avgMs = Math.floor(stats.totalGameTimeMs / totalGames);
        const minutes = Math.floor(avgMs / 60000);
        const seconds = Math.floor((avgMs % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    private getEmptyStats(): AccountStats {
        return {
            gamesPlayedClassic: 0,
            gamesPlayedCTF: 0,
            gamesWon: 0,
            totalGameTimeMs: 0,
        };
    }
}
