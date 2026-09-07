import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { SocketService } from '@app/services/sockets/socket.service';
import { Player } from '@common/interfaces/player.interface';
import { Team } from '@common/interfaces/team.interface';

@Component({
    selector: 'app-player-list',
    standalone: true,
    imports: [CommonModule, TranslatePipe],
    templateUrl: './player-list.component.html',
    styleUrls: ['./player-list.component.scss'],
})
export class PlayerListComponent {
    @Input() players: Player[] = [];
    @Input() currentPlayerId: string | null = null;
    @Input() inactivePlayers: Player[] = [];
    @Input() eliminatedPlayers: Player[] = [];
    @Input() teams: Team | null = null;
    @Input() gameMode: string | null = null;

    socketService = inject(SocketService);

    getPlayersInTurnOrder(): Player[] {
        return [...this.players];
    }

    isCurrentPlayer(player: Player): boolean {
        return player.socketId === this.currentPlayerId;
    }
    getPlayerTeam(player: Player): 'red' | 'blue' | null {
        if (!this.teams || !this.gameMode || this.gameMode !== 'CTF') {
            return null;
        }
        if (this.teams.red.includes(player.socketId)) {
            return 'red';
        } else if (this.teams.blue.includes(player.socketId)) {
            return 'blue';
        }
        return null;
    }
    isPlayerInactive(player: Player): boolean {
        return this.inactivePlayers.some((p) => p.socketId === player.socketId);
    }
    hasFlagInInventory(player: Player): boolean {
        return player.inventory && player.inventory.includes('flag');
    }
}
