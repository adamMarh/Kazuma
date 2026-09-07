import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { GridService } from '@app/services/grid/grid.service';
import { GridCreationComponent } from './grid-creation.component';

describe('GridCreationComponent', () => {
    let component: GridCreationComponent;
    let fixture: ComponentFixture<GridCreationComponent>;
    let gridService: jasmine.SpyObj<GridService>;
    let router: jasmine.SpyObj<Router>;
    const smallSize = 10;
    const mediumSize = 15;
    const largeSize = 20;

    beforeEach(async () => {
        const gridServiceSpy = jasmine.createSpyObj('GridService', ['initializeGrid']);
        const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

        await TestBed.configureTestingModule({
            imports: [CommonModule, GridCreationComponent],
            declarations: [],
            providers: [
                { provide: GridService, useValue: gridServiceSpy },
                { provide: Router, useValue: routerSpy },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(GridCreationComponent);
        component = fixture.componentInstance;
        gridService = TestBed.inject(GridService) as jasmine.SpyObj<GridService>;
        router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    });

    it('should create the component', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize sizes and gameModes correctly', () => {
        expect(component.sizes).toEqual([smallSize, mediumSize, largeSize]);
        expect(component.gameModes).toEqual(['Classique', 'CTF']);
    });

    describe('setGrid', () => {
        it('should call initializeGrid on GridService and navigate to /edit', () => {
            const size = smallSize;
            const gameMode = 'Classique';
            component.tempSize = size;
            component.tempGameMode = gameMode;

            component.setGrid(size, gameMode);

            expect(gridService.initializeGrid).toHaveBeenCalledWith(size, gameMode);
            expect(router.navigate).toHaveBeenCalledWith(['/edit']);
        });

        it('should handle different sizes and game modes', () => {
            const sizes = [smallSize, mediumSize, largeSize];
            const gameModes = ['Classique', 'CTF'];

            sizes.forEach((size) => {
                gameModes.forEach((gameMode) => {
                    component.tempSize = size;
                    component.tempGameMode = gameMode;

                    gridService.initializeGrid.calls.reset();
                    router.navigate.calls.reset();

                    component.setGrid(size, gameMode as 'Classique' | 'CTF');

                    expect(gridService.initializeGrid).toHaveBeenCalledWith(size, gameMode);
                    expect(router.navigate).toHaveBeenCalledWith(['/edit']);
                });
            });
        });

        it('should set errorMessage if tempSize or tempGameMode is not set', () => {
            component.setGrid(component.tempSize, component.tempGameMode);

            expect(component.errorMessage).toBe('Veuillez sélectionner une taille et un mode de jeu avant de continuer.');
            expect(gridService.initializeGrid).not.toHaveBeenCalled();
            expect(router.navigate).not.toHaveBeenCalled();
        });
    });

    describe('navBack', () => {
        it('should navigate to /admin', () => {
            component.navBack();
            expect(router.navigate).toHaveBeenCalledWith(['/admin']);
        });
    });
});
