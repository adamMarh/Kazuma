import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PlayerStats } from '@common/interfaces/player-stats.interface';
import { SocketService } from '@app/services/sockets/socket.service';
import { GlobalStats } from '@common/interfaces/player-global-stats';

@Injectable({
    providedIn: 'root',
})
export class EndGameService {
    private socketService = inject(SocketService);

    getEndGameStats(gameId: string): Observable<PlayerStats[]> {
        this.socketService.send('get-end-game-stats', { gameId });
        return this.socketService.on<PlayerStats[]>('end-game-stats');
    }

    loadGlobalStats(gameId: string): Observable<GlobalStats> {
        this.socketService.send('get-end-game-global-stats', { gameId });
        return this.socketService.on<GlobalStats>('end-game-global-stats');
    }

    sortStats(stats: PlayerStats[], stat: keyof PlayerStats, orderUp: boolean): PlayerStats[] {
        return [...stats].sort((playerA, playerB) => {
            const aStat = playerA[stat];
            const bStat = playerB[stat];

            if (aStat === bStat) return playerA.name.localeCompare(playerB.name);
            return orderUp ? (aStat > bStat ? 1 : -1) : aStat < bStat ? 1 : -1;
        });
    }
}
