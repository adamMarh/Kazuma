import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'app-confirmation-popup',
    templateUrl: './confirmation-popup.component.html',
    styleUrls: ['./confirmation-popup.component.scss', '../../../styles.scss'],
    imports: [],
})
export class ConfirmationPopupComponent {
    @Output() confirm = new EventEmitter<boolean>();
    @Input() message: string = '';
    @Input() isVisible: boolean = false;

    confirmPopup(choice: boolean) {
        this.isVisible = false;
        this.confirm.emit(choice);
    }
}
