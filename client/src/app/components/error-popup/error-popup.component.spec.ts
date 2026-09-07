import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorPopupComponent } from './error-popup.component';

describe('ErrorPopupComponent', () => {
    let component: ErrorPopupComponent;
    let fixture: ComponentFixture<ErrorPopupComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ErrorPopupComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ErrorPopupComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('Popup visibility', () => {
        it('should display the popup when isVisible is true', () => {
            component.isVisible = true;
            fixture.detectChanges();
            const popupElement = fixture.nativeElement.querySelector('.error-popup');
            expect(popupElement).toBeTruthy();
        });

        it('should not display the popup when isVisible is false', () => {
            component.isVisible = false;
            fixture.detectChanges();
            const popupElement = fixture.nativeElement.querySelector('.error-popup');
            expect(popupElement).toBeNull();
        });
    });

    describe('Popup message', () => {
        it('should display the correct error message', () => {
            component.message = 'Popup message test';
            component.isVisible = true;
            fixture.detectChanges();
            const messageElement = fixture.nativeElement.querySelector('.error-message');
            expect(messageElement.textContent).toContain('Popup message test');
        });
    });

    describe('Popup actions', () => {
        it('should close the popup when clicking the close button', () => {
            spyOn(component.closed, 'emit');
            component.isVisible = true;
            fixture.detectChanges();
            const closeBtn = fixture.nativeElement.querySelector('.error-close-btn');
            closeBtn.click();
            fixture.detectChanges();
            expect(component.closed.emit).toHaveBeenCalled();
            expect(component.isVisible).toBeFalse();
        });
        it('should emit reconnect event when clicking the reconnect button', () => {
            spyOn(component.reconnect, 'emit');

            component.isVisible = true;
            component.showReconnectButton = true;
            fixture.detectChanges();

            const reconnectBtn = fixture.nativeElement.querySelector('.error-reconnect-btn');
            reconnectBtn.click();
            fixture.detectChanges();

            expect(component.reconnect.emit).toHaveBeenCalled();
        });
        it('should call handleConfirm() to hide the popup and emit confirmed', () => {
            spyOn(component.confirmed, 'emit');
            component.isVisible = true;
            component.handleConfirm();
            fixture.detectChanges();
            expect(component.isVisible).toBeFalse();
            expect(component.confirmed.emit).toHaveBeenCalled();
        });
    });
});
