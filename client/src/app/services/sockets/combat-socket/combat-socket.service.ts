import { inject, Injectable } from '@angular/core';
import { SocketService } from '@app/services/sockets/socket.service';
import { CombatState } from '@common/interfaces/combatState.interface';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/interfaces/position.interface';
import { COMBAT_EVENTS } from '@common/socket-events/combat.events';
import { Observable, of, tap } from 'rxjs';
import { LobbySocketService } from '@app/services/sockets/lobby-socket/lobby-socket.service';

@Injectable({
    providedIn: 'root',
})
export class CombatSocketService {
    time: number;
    private socketService = inject(SocketService);
    private lobbySocketService = inject(LobbySocketService);
    private game = this.lobbySocketService.getGameInstance();
    private paused: boolean = false;
    private interval: number | undefined;
    private targetPlayerId: string;

    onAttacked(): Observable<{ combatState: CombatState }> {
        return this.socketService.on<{ combatState: CombatState }>(COMBAT_EVENTS.COMBAT_STATE_UPDATE);
    }

    onCombatStarted(): Observable<any> {
        return this.socketService.on<any>(COMBAT_EVENTS.COMBAT_STARTED);
    }

    onPlayersInCombat(): Observable<any> {
        return this.socketService.on<any>(COMBAT_EVENTS.PLAYERS_IN_COMBAT);
    }

    onTurnChanged(): Observable<{ currentTurn: string }> {
        return this.socketService.on(COMBAT_EVENTS.TURN_CHANGED);
    }

    onCombatEnded(): Observable<{ combatState: CombatState; reason: string; actionPlayer: Player; gameEnded: boolean }> {
        return this.socketService.on<{ combatState: CombatState; reason: string; actionPlayer: Player; gameEnded: boolean }>(
            COMBAT_EVENTS.COMBAT_ENDED,
        );
    }

    getTimerValue(): Observable<{ timerStarted: boolean; timerPaused: boolean; delay: number; targetPlayer: Player }> {
        return this.socketService
            .on<{ timerStarted: boolean; timerPaused: boolean; delay: number; targetPlayer: Player }>(COMBAT_EVENTS.TIMER_STATE)
            .pipe(
                tap((data) => {
                    this.targetPlayerId = data.targetPlayer.socketId;
                }),
            );
    }

    startTimer(gameEnded: boolean, gameId: string): Observable<any> {
        if (!gameEnded) {
            return this.socketService.emit(COMBAT_EVENTS.START_TIMER, { gameId });
        }
        return of(null);
    }

    combatCountdown(delay: number, gameId: string): Observable<number> {
        return new Observable<number>((observer) => {
            const eliminatedPlayers = this.game?.eliminatedPlayers || [];
            const myPlayer = this.game?.players.find((p: Player) => p.socketId === this.socketService.getSocketId());
            this.paused = false;
            if (this.interval) {
                clearInterval(this.interval);
            }
            this.time = delay;
            observer.next(this.time);
            this.interval = window.setInterval(() => {
                if (!this.paused) {
                    this.time--;
                    observer.next(this.time);
                }
                if (this.time <= 0) {
                    clearInterval(this.interval);
                    this.interval = undefined;
                    if (this.game?.fastEliminationActive) {
                        if (this.socketService.getSocketId() !== this.targetPlayerId && !eliminatedPlayers.includes(myPlayer!)) {
                            this.attackOpponent(this.targetPlayerId, gameId).subscribe({
                                next: () => observer.complete(),
                                error: (err) => observer.error(err),
                            });
                        } else {
                            observer.complete();
                        }
                    } else {
                        if (this.socketService.getSocketId() !== this.targetPlayerId) {
                            this.attackOpponent(this.targetPlayerId, gameId).subscribe({
                                next: () => observer.complete(),
                                error: (err) => observer.error(err),
                            });
                        } else {
                            observer.complete();
                        }
                    }
                }
            }, 1000);
        });
    }

    pauseTimer(gameId: string): Observable<any> {
        return this.socketService.emit(COMBAT_EVENTS.RESET_TIMER, { gameId });
    }

    initCombat(position: Position, gameId: string): Observable<any> {
        return this.socketService.emit(COMBAT_EVENTS.INIT_COMBAT, { gameId, position });
    }

    attackOpponent(targetPlayer: string, gameId: string): Observable<any> {
        return this.socketService.emit(COMBAT_EVENTS.ATTACK_OPPONENT, { gameId, targetPlayer });
    }

    attemptFlee(gameId: string): Observable<any> {
        return this.socketService.emit(COMBAT_EVENTS.ATTEMPT_FLEE, { gameId });
    }

    pause() {
        clearInterval(this.interval);
        this.interval = undefined;
        this.paused = true;
    }

    reset() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
        this.time = 0;
        this.paused = false;
    }
}
