import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { GameInvitation } from '@common/interfaces/friend.interface';

const AUTO_DECLINE_SECONDS = 15;

@Component({
    selector: 'app-game-invitation-dialog',
    standalone: true,
    imports: [CommonModule, TranslatePipe],
    templateUrl: './game-invitation-dialog.component.html',
    styleUrls: ['./game-invitation-dialog.component.scss'],
})
export class GameInvitationDialogComponent implements OnInit, OnDestroy {
    @Input() invitation!: GameInvitation;
    @Output() accepted = new EventEmitter<GameInvitation>();
    @Output() declined = new EventEmitter<void>();

    countdown = AUTO_DECLINE_SECONDS;
    private timer: ReturnType<typeof setInterval> | null = null;

    ngOnInit(): void {
        this.timer = setInterval(() => {
            this.countdown--;
            if (this.countdown <= 0) {
                this.decline();
            }
        }, 1000);
    }

    ngOnDestroy(): void {
        if (this.timer) clearInterval(this.timer);
    }

    accept(): void {
        if (this.timer) clearInterval(this.timer);
        this.accepted.emit(this.invitation);
    }

    decline(): void {
        if (this.timer) clearInterval(this.timer);
        this.declined.emit();
    }
}
