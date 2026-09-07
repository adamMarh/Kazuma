import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { GameMap } from '@app/interfaces/game-map.interface';
import { MapService } from '@app/services/maps/maps.service';
import { of, throwError } from 'rxjs';
import { MapCardComponent } from './map-card.component';

describe('MapCardComponent', () => {
    let component: MapCardComponent;
    let fixture: ComponentFixture<MapCardComponent>;
    let mockMapService: jasmine.SpyObj<MapService>;
    let mockRouter: jasmine.SpyObj<Router>;

    const mockGameMap: GameMap = {
        _id: '123',
        name: 'Test Map',
        size: '10',
        tiles: [['grass']],
        items: [['empty']],
        gameMode: 'Classic',
        description: 'Test Description',
        imageUrl: 'test-url',
        lastSave: new Date(),
        hidden: false,
        nbCheckpoints: '2',
        nbRandomItems: '2',
    };
    const hiddenMockedGameMap: GameMap = {
        _id: '123',
        name: 'Test Map',
        size: '10',
        tiles: [['grass']],
        items: [['empty']],
        gameMode: 'Classic',
        description: 'Test Description',
        imageUrl: 'test-url',
        lastSave: new Date(),
        hidden: true,
        nbCheckpoints: '2',
        nbRandomItems: '2',
    };

    beforeEach(async () => {
        mockMapService = jasmine.createSpyObj('MapService', ['deleteMap', 'toggleHideMap']);
        mockRouter = jasmine.createSpyObj('Router', ['navigate']);

        await TestBed.configureTestingModule({
            imports: [MapCardComponent],
            providers: [
                { provide: MapService, useValue: mockMapService },
                { provide: Router, useValue: mockRouter },
            ],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(MapCardComponent);
        component = fixture.componentInstance;
        component.map = mockGameMap;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should navigate to edit map page when editMap is called', () => {
        component.editMap();
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/edit'], { queryParams: { id: '123' } });
    });

    it('should emit mapDeleted event with success message when deleteMap is successful', () => {
        mockMapService.deleteMap.and.returnValue(of(undefined));
        spyOn(component.mapDeleted, 'emit');

        component.deleteMap();

        expect(mockMapService.deleteMap).toHaveBeenCalledWith('123');
        expect(component.mapDeleted.emit).toHaveBeenCalledWith({ message: 'Carte supprimée !' });
    });

    it('should emit mapDeleted event with error message when deleteMap fails', () => {
        mockMapService.deleteMap.and.returnValue(throwError(() => new Error('Error')));
        spyOn(component.mapDeleted, 'emit');

        component.deleteMap();

        expect(mockMapService.deleteMap).toHaveBeenCalledWith('123');
        expect(component.mapDeleted.emit).toHaveBeenCalledWith({ message: 'Cette carte a déjà été supprimée' });
    });

    it('should call toggleHideMap on the service when toggleHideMap is called', () => {
        mockMapService.toggleHideMap.and.returnValue(of(hiddenMockedGameMap));
        component.toggleHideMap();
        expect(mockMapService.toggleHideMap).toHaveBeenCalledWith('123');
    });

    it('should not call mapDeleted event with error message if map._id is undefined', () => {
        spyOn(component.mapDeleted, 'emit');
        component.map = { _id: undefined } as GameMap;
        component.deleteMap();
        expect(mockMapService.deleteMap).not.toHaveBeenCalled();
    });

    it('should not call toggleHideMap if map._id is undefined', () => {
        component.map = { _id: undefined } as GameMap;
        component.toggleHideMap();
        expect(mockMapService.toggleHideMap).not.toHaveBeenCalled();
    });

    it('should emit mapHidden event with error message when toggleHideMap fails', () => {
        mockMapService.toggleHideMap.and.returnValue(throwError(() => new Error('Error')));
        spyOn(component.mapHidden, 'emit');

        component.toggleHideMap();

        expect(mockMapService.toggleHideMap).toHaveBeenCalledWith('123');
        expect(component.mapHidden.emit).toHaveBeenCalledWith({ message: 'Cette carte a été supprimée, impossible de la cacher' });
    });
});
