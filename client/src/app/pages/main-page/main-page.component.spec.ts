import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MainPageComponent } from '@app/pages/main-page/main-page.component';

describe('MainPageComponent', () => {
    let component: MainPageComponent;
    let fixture: ComponentFixture<MainPageComponent>;
    let router: Router;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [MainPageComponent],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(MainPageComponent);
        component = fixture.componentInstance;
        router = TestBed.inject(Router);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it("should have three buttons'", () => {
        const buttons = fixture.debugElement.nativeElement.querySelectorAll('button');
        const correctNumberOfButtons = 3;
        expect(buttons.length).toEqual(correctNumberOfButtons);
    });

    it('should trigger the right event when clicking on the "Joindre une partie" button', () => {
        const buttons = fixture.debugElement.nativeElement.querySelectorAll('button');
        spyOn(component, 'onJoiningGame');
        buttons[0].click();
        expect(component.onJoiningGame).toHaveBeenCalled();
    });

    it('should trigger the right event when clicking on the "Créer une partie" button', () => {
        const buttons = fixture.debugElement.nativeElement.querySelectorAll('button');
        spyOn(component, 'onCreatingGame');
        buttons[1].click();
        expect(component.onCreatingGame).toHaveBeenCalled();
    });

    it('should trigger the right event when clicking on the "Administrer une partie" button', () => {
        const buttons = fixture.debugElement.nativeElement.querySelectorAll('button');
        spyOn(component, 'onAdministrateGame');
        buttons[2].click();
        expect(component.onAdministrateGame).toHaveBeenCalled();
    });

    it('should navigate to /join-game when clicking on the "Joindre une partie" button', () => {
        const navigateSpy = spyOn(router, 'navigate');
        component.onJoiningGame();
        expect(navigateSpy).toHaveBeenCalledWith(['/join-game']);
    });

    it('should navigate to /game-session when clicking on the "Créer une partie" button', () => {
        const navigateSpy = spyOn(router, 'navigate');
        component.onCreatingGame();
        expect(navigateSpy).toHaveBeenCalledWith(['/game-session']);
    });

    it('should navigate to /admin when clicking on the "Administrer une partie" button', () => {
        const navigateSpy = spyOn(router, 'navigate');
        component.onAdministrateGame();
        expect(navigateSpy).toHaveBeenCalledWith(['/admin']);
    });
});
