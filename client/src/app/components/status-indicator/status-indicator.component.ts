import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { STATUS_COLOR, STATUS_LABEL, UserStatus } from '@common/interfaces/friend.interface';

@Component({
    selector: 'app-status-indicator',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './status-indicator.component.html',
    styleUrls: ['./status-indicator.component.scss'],
})
export class StatusIndicatorComponent {
    @Input() status: UserStatus | undefined;

    static labelForStatus(status: UserStatus | undefined): string {
        return STATUS_LABEL[status ?? 'offline'];
    }

    colorForStatus(status: UserStatus | undefined): string {
        return STATUS_COLOR[status ?? 'offline'];
    }
}
