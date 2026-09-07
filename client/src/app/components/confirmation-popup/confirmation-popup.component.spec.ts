import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmationPopupComponent } from './confirmation-popup.component';

describe('ConfirmationPopupComponent', () => {
    let component: ConfirmationPopupComponent;
    let fixture: ComponentFixture<ConfirmationPopupComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [ConfirmationPopupComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ConfirmationPopupComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('Popup visibility', () => {
        it('should not display the popup when isVisible is false', () => {
            component.isVisible = false;
            fixture.detectChanges();
            const popupElement = fixture.debugElement.query(By.css('.popup'));
            expect(popupElement).toBeNull();
        });

        it('should display the popup when isVisible is true', () => {
            component.isVisible = true;
            fixture.detectChanges();
            const popupElement = fixture.debugElement.query(By.css('.popup'));
            expect(popupElement).toBeTruthy();
        });
    });

    describe('Popup message', () => {
        it('should display the correct message', () => {
            component.message = 'Popup message test';
            component.isVisible = true;
            fixture.detectChanges();
            const messageElement = fixture.debugElement.query(By.css('.popup-content p')).nativeElement;
            expect(messageElement.textContent).toContain('Popup message test');
        });
    });

    describe('Popup actions', () => {
        it('should emit false and close the popup when clicking on No icon', () => {
            spyOn(component.confirm, 'emit');
            component.isVisible = true;
            fixture.detectChanges();
            const noBtn = fixture.debugElement.query(By.css('.popup-buttons button img[alt="No icon"]')).parent?.nativeElement;
            noBtn.click();
            fixture.detectChanges();
            expect(component.confirm.emit).toHaveBeenCalledWith(false);
            expect(component.isVisible).toBeFalse();
        });

        it('should emit true and close the popup when clicking on Yes icon', () => {
            spyOn(component.confirm, 'emit');
            component.isVisible = true;
            fixture.detectChanges();
            const yesBtn = fixture.debugElement.query(By.css('.popup-buttons button img[alt="Yes icon"]')).parent?.nativeElement;
            yesBtn.click();
            fixture.detectChanges();
            expect(component.confirm.emit).toHaveBeenCalledWith(true);
            expect(component.isVisible).toBeFalse();
        });
    });
});
