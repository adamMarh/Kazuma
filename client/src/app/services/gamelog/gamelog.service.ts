import { Injectable, inject } from '@angular/core';
import { SocketService } from '@app/services/sockets/socket.service';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface GameLogEntry {
    timestamp: string;
    message: string;
    messageKey?: string;
    messageParams?: { [key: string]: string | number };
    players: string[];
    type: string;
}

@Injectable({
    providedIn: 'root',
})
export class GameLogService {
    logSubject = new BehaviorSubject<GameLogEntry[]>([]);
    logs$: Observable<GameLogEntry[]> = this.logSubject.asObservable();

    private socketService = inject(SocketService);

    constructor() {
        this.socketService.on<GameLogEntry>(GAME_EVENTS.LOG).subscribe((logEntry) => {
            const currentLogs = this.logSubject.getValue();
            this.logSubject.next([...currentLogs, logEntry]);
        });

        this.socketService.on(GAME_EVENTS.GAME_STARTED).subscribe(() => {
            this.resetLogs();
        });
    }
    addLog(log: GameLogEntry): void {
        const currentLogs = this.logSubject.getValue();
        this.logSubject.next([...currentLogs, log]);
    }

    filterLogsForPlayer(playerId: string): Observable<GameLogEntry[]> {
        return this.logs$.pipe(map((logs) => logs.filter((log) => log.players.includes(playerId))));
    }

    resetLogs(): void {
        this.logSubject.next([]);
    }
}
