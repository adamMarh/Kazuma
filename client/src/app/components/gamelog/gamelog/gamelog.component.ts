import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TIMER_100 } from '@app/constants/different-timer';
import { GameService } from '@app/services/game/game.service';
import { GameLogEntry, GameLogService } from '@app/services/gamelog/gamelog.service';
import { LanguageService } from '@app/services/language/language.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { SocketService } from '@app/services/sockets/socket.service';
import { Player } from '@common/interfaces/player.interface';

@Component({
    selector: 'app-gamelog',
    templateUrl: './gamelog.component.html',
    standalone: true,
    imports: [FormsModule, TranslatePipe],
    styleUrls: ['./gamelog.component.scss'],
})
export class GamelogComponent implements OnInit {
    allLogs: GameLogEntry[] = [];
    displayedLogs: GameLogEntry[] = [];
    filterByMe: boolean = false;
    currentPlayerId: string;
    myPlayer: Player | null = null;

    private gameLogService = inject(GameLogService);
    private socketService = inject(SocketService);
    private gameService = inject(GameService);
    private languageService = inject(LanguageService);

    getTranslatedMessage(log: GameLogEntry): string {
        if (log.messageKey) {
            const translated = this.languageService.translate(log.messageKey, log.messageParams);
            if (translated !== log.messageKey) {
                return translated;
            }
        }
        return log.message;
    }

    ngOnInit(): void {
        this.currentPlayerId = this.socketService.getSocketId() ?? '';
        this.gameService.myPlayer$.subscribe((player) => {
            this.myPlayer = player;
            this.applyFilter();
        });

        this.gameLogService.logs$.subscribe((logs) => {
            this.allLogs = logs;
            this.applyFilter();
            setTimeout(() => this.scrollToBottom(), TIMER_100);
        });
    }

    scrollToBottom(): void {
        const container = document.querySelector('.log-messages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    applyFilter(): void {
        if (this.filterByMe && this.myPlayer) {
            const myName = this.myPlayer.name;
            this.displayedLogs = this.allLogs.filter((log) => log.players.includes(myName));
        } else {
            this.displayedLogs = this.allLogs;
        }
    }

    toggleMyLogs(): void {
        this.filterByMe = !this.filterByMe;
        this.applyFilter();
    }
}
