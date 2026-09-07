import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '@app/services/language/translate.pipe';

@Component({
    standalone: true,
    selector: 'app-error-popup',
    templateUrl: './error-popup.component.html',
    styleUrls: ['./error-popup.component.scss', '../../../styles.scss'],
    imports: [TranslatePipe],
})
export class ErrorPopupComponent {
    @Input() message: string = '';
    @Input() isVisible: boolean = false;
    @Input() showReconnectButton: boolean = false;
    @Input() notification: boolean = false;
    @Input() confirmation: boolean = false;

    @Output() closed = new EventEmitter<void>();
    @Output() reconnect = new EventEmitter<void>();
    @Output() confirmed = new EventEmitter<void>();

    closePopup() {
        this.isVisible = false;
        this.closed.emit();
    }

    handleReconnect() {
        this.reconnect.emit();
    }

    handleConfirm() {
        this.isVisible = false;
        this.confirmed.emit();
    }
}
