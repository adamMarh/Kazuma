import { Injectable, inject } from '@angular/core';
import { ElectronService } from '@app/services/electron/electron.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ChatPopoutService {
    poppedOutSubject = new BehaviorSubject<boolean>(false);
    isPoppedOut$ = this.poppedOutSubject.asObservable();
    private electron = inject(ElectronService);

    constructor() {
        if (this.electron.isElectron) {
            this.electron.on('chat:anchored', () => {
                this.poppedOutSubject.next(false);
            });
        }
    }

    get isPoppedOut(): boolean {
        return this.poppedOutSubject.value;
    }

    popOut(gameId: string): void {
        if (!this.electron.isElectron) return;
        this.electron.send('chat:pop-out', gameId);
        this.poppedOutSubject.next(true);
    }

    anchor(): void {
        if (!this.electron.isElectron) return;
        this.electron.send('chat:anchor');
    }
}
