import { Injectable } from '@angular/core';
import { Game } from '@common/interfaces/game.interface';
import { LOBBY_EVENTS } from '@common/socket-events/lobby.events';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class SocketService {
    game: Game;
    id: any;
    private socket: Socket;

    constructor() {
        this.socket = io(environment.socketUrl);
    }

    emit<T>(event: string, data?: any): Observable<T> {
        return new Observable<T>((observer) => {
            this.socket.emit(event, data, (response: T | { error?: string }) => {
                if (response && typeof response === 'object' && 'error' in response) {
                    observer.error(response.error);
                } else {
                    observer.next(response as T);
                    observer.complete();
                }
            });
        });
    }

    on<T>(event: string): Observable<T> {
        return new Observable<T>((observer) => {
            const handler = (data: T) => observer.next(data);
            this.socket.on(event, handler);
            return () => {
                if (this.socket.off) {
                    this.socket.off(event, handler);
                }
            };
        });
    }

    getSocketId(): string | null {
        return this.socket?.id || null;
    }

    onError(): Observable<any> {
        return new Observable((observer) => {
            this.socket.on(LOBBY_EVENTS.ERROR, (data) => {
                observer.next(data);
            });
        });
    }

    onConnect(): Observable<void> {
        return new Observable((observer) => {
            this.socket.on('connect', () => {
                observer.next();
                observer.complete();
            });
        });
    }

    isConnected(): boolean {
        return this.socket.connected;
    }

    send(event: string, data?: any): void {
        this.socket.emit(event, data);
    }
}
