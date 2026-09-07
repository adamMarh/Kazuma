/* eslint-disable max-classes-per-file */
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { GameMap } from '@app/interfaces/game-map.interface';
import { CharacterFormService } from '@app/services/character-form/character-form.service';
import { GameService } from '@app/services/game/game.service';
import { MapService } from '@app/services/maps/maps.service';
import { of, throwError } from 'rxjs';
import { GamePageComponent } from './game-page.component';

class MockMapService {
    maps$ = of<GameMap[]>([]);
    loadMaps = jasmine.createSpy('loadMaps');
    checkGameAvailability = jasmine.createSpy('checkGameAvailability');
}

class MockRouter {
    navigate = jasmine.createSpy('navigate');
}

class MockCharacterFormService {
    playerName = 'Alice';
    selectedAvatar = 1;
    attributes = [
        { name: 'spd', value: 10, dice: 2 },
        { name: 'def', value: 5, dice: 1 },
    ];
    resetForm = jasmine.createSpy('resetForm');
}

class MockGameService {
    createGame = jasmine.createSpy('createGame');
}

describe('GamePageComponent', () => {
    let component: GamePageComponent;
    let fixture: ComponentFixture<GamePageComponent>;
    let mockMapService: MockMapService;
    let mockRouter: MockRouter;
    let mockCharacterFormService: MockCharacterFormService;
    let mockGameService: MockGameService;

    const visibleMap: GameMap = {
        _id: 'map1',
        name: 'Visible Map',
        size: '15',
        gameMode: 'classic',
        description: 'test map',
        lastSave: new Date(),
        imageUrl: '',
        hidden: false,
        tiles: [[]],
        items: [[]],
        nbCheckpoints: '0',
        nbRandomItems: '0',
    };
    const hiddenMap: GameMap = {
        ...visibleMap,
        _id: 'map2',
        name: 'Hidden Map',
        hidden: true,
    };

    beforeEach(async () => {
        mockMapService = new MockMapService();
        mockRouter = new MockRouter();
        mockCharacterFormService = new MockCharacterFormService();
        mockGameService = new MockGameService();

        mockMapService.maps$ = of<GameMap[]>([visibleMap, hiddenMap]);

        await TestBed.configureTestingModule({
            imports: [GamePageComponent],
            providers: [
                { provide: MapService, useValue: mockMapService },
                { provide: Router, useValue: mockRouter },
                { provide: CharacterFormService, useValue: mockCharacterFormService },
                { provide: GameService, useValue: mockGameService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(GamePageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('ngOnInit', () => {
        it('should load maps and set visibleMaps$', () => {
            expect(mockMapService.loadMaps).toHaveBeenCalled();
            let result: GameMap[] | undefined;
            component.visibleMaps$.subscribe((maps) => (result = maps));
            expect(result?.length).toBe(1);
            expect(result?.[0]).toBe(visibleMap);
        });
    });

    describe('onSelectGame', () => {
        it('should set selectedMap', () => {
            expect(component.selectedMap).toBeUndefined();
            component.onSelectGame(visibleMap);
            expect(component.selectedMap).toEqual(visibleMap);
        });
    });

    describe('navCreateGame', () => {
        it('should do nothing if no selectedMap', () => {
            component.selectedMap = null;
            component.navCreateGame();
            expect(mockMapService.checkGameAvailability).not.toHaveBeenCalled();
        });

        it("should show form if the map is available, and reset message to ''", () => {
            component.selectedMap = visibleMap;
            mockMapService.checkGameAvailability.and.returnValue(of(true));
            component.message = 'some message';
            component.navCreateGame();

            expect(mockMapService.checkGameAvailability).toHaveBeenCalledWith('map1');
            expect(component.isCharacterFormVisible).toBeTrue();
            expect(component.message).toBe('');
        });

        it('should show message and reload maps if not available', () => {
            component.selectedMap = visibleMap;
            mockMapService.checkGameAvailability.and.returnValue(of(false));
            component.navCreateGame();

            expect(mockMapService.checkGameAvailability).toHaveBeenCalledWith('map1');
            expect(component.isCharacterFormVisible).toBeFalse();
            expect(component.message).toContain("La carte sélectionnée n'est plus disponible.");
            expect(component.selectedMap).toBeNull();
            expect(mockMapService.loadMaps).toHaveBeenCalledTimes(2);
        });

        it('should show error message on error', () => {
            component.selectedMap = visibleMap;
            mockMapService.checkGameAvailability.and.returnValue(throwError(() => new Error('Network error')));
            component.navCreateGame();

            expect(component.message).toContain('Une erreur est survenue');
        });
    });

    describe('createGame', () => {
        it('should build a payload from characterFormService and call gameService.createGame', () => {
            component.selectedMap = visibleMap;
            mockGameService.createGame.and.returnValue(of({}));
            component.createGame();

            expect(mockGameService.createGame).toHaveBeenCalled();

            const [[name, avatar, map, attributes]] = mockGameService.createGame.calls.argsFor(0);

            expect(name).toBe('A');
            expect(avatar).toBe('l');
            expect(map).toBe('i');
            expect(attributes).toBe('c');

            expect(mockRouter.navigate).toHaveBeenCalledWith(['/waiting-room']);
            expect(mockCharacterFormService.resetForm).toHaveBeenCalled();
        });

        it('should set dice to 0 when dice is undefined in characterFormService.attributes', () => {
            mockCharacterFormService.attributes = [
                { name: 'spd', value: 10, dice: 2 },
                { name: 'def', value: 5, dice: undefined as unknown as number },
            ];
            component.selectedMap = visibleMap;

            mockGameService.createGame.and.returnValue(of({}));

            component.createGame();
            const callArgs = mockGameService.createGame.calls.argsFor(0);
            const attributes = callArgs[3];
            expect(attributes).toEqual({
                spd: { value: 10, dice: 2 },
                def: { value: 5, dice: 0 },
            });
        });
    });

    describe('navBack', () => {
        it('should navigate to /', () => {
            component.navBack();
            expect(mockRouter.navigate).toHaveBeenCalledWith(['/'], { replaceUrl: true });
        });
    });

    describe('onFormClosed', () => {
        it('should hide form and reset character form', () => {
            component.isCharacterFormVisible = true;
            component.onFormClosed();
            expect(component.isCharacterFormVisible).toBeFalse();
            expect(mockCharacterFormService.resetForm).toHaveBeenCalled();
        });
    });

    describe('showMessage', () => {
        it('should set message, then clear it after timeout', fakeAsync(() => {
            component['showMessage']('Test message');
            expect(component.message).toBe('Test message');
            tick(GamePageComponent.messageTimeoutMs);
            expect(component.message).toBe('');
        }));
    });
});
