import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { GameMap } from '@app/interfaces/game-map.interface';
import { MapService } from '@app/services/maps/maps.service';
import { of } from 'rxjs';
import { AdminPageComponent } from './admin-page.component';

describe('AdminPageComponent', () => {
    let component: AdminPageComponent;
    let fixture: ComponentFixture<AdminPageComponent>;
    let routerSpy: jasmine.SpyObj<Router>;
    let mapServiceSpy: jasmine.SpyObj<MapService>;
    const smallSize = 10;
    const mediumSize = 10;

    const dummyMaps: GameMap[] = [
        {
            _id: '1',
            name: 'Map 1',
            size: '10',
            tiles: Array.from({ length: smallSize }, () => Array(smallSize).fill('grass')),
            items: Array.from({ length: smallSize }, () => Array(smallSize).fill('empty')),
            gameMode: 'Classic',
            description: 'Description 1',
            imageUrl: '',
            lastSave: new Date(),
            hidden: false,
            nbCheckpoints: '3',
            nbRandomItems: '5',
        },
        {
            _id: '2',
            name: 'Map 2',
            size: '15',
            tiles: Array.from({ length: mediumSize }, () => Array(mediumSize).fill('grass')),
            items: Array.from({ length: mediumSize }, () => Array(mediumSize).fill('empty')),
            gameMode: 'Classic',
            description: 'Description 2',
            imageUrl: '',
            lastSave: new Date(),
            hidden: false,
            nbCheckpoints: '3',
            nbRandomItems: '5',
        },
    ];

    beforeEach(() => {
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        mapServiceSpy = jasmine.createSpyObj('MapService', ['loadMaps'], { maps$: of(dummyMaps) });
        const activatedRouteStub = { queryParams: of({ id: dummyMaps[0]._id }) };

        TestBed.configureTestingModule({
            imports: [AdminPageComponent],
            providers: [
                { provide: Router, useValue: routerSpy },
                { provide: MapService, useValue: mapServiceSpy },
                { provide: ActivatedRoute, useValue: activatedRouteStub },
            ],
        });

        fixture = TestBed.createComponent(AdminPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('ngOnInit', () => {
        it('should call loadMaps and set maps$', () => {
            component.ngOnInit();
            expect(mapServiceSpy.loadMaps).toHaveBeenCalled();
            component.maps$.subscribe((maps) => {
                expect(maps).toEqual(dummyMaps);
            });
        });
    });

    describe('navMapCreation', () => {
        it('should navigate to /create', () => {
            component.navMapCreation();
            expect(routerSpy.navigate).toHaveBeenCalledWith(['/create']);
        });
    });

    describe('navBack', () => {
        it('should navigate to /', () => {
            component.navBack();
            expect(routerSpy.navigate).toHaveBeenCalledWith(['/']);
        });
    });

    describe('onMapDeleted', () => {
        it('should set message and clear it after timeout when message is non-empty', fakeAsync(() => {
            const event = { message: 'Map deleted successfully' };
            component.onMapDeleted(event);
            expect(component.message).toEqual(event.message);
            tick(AdminPageComponent.messageTimeout);
            expect(component.message).toEqual('');
        }));

        it('should set message to empty and not schedule a timeout when event message is empty', fakeAsync(() => {
            const event = { message: '' };
            component.onMapDeleted(event);
            expect(component.message).toEqual('');
            tick(AdminPageComponent.messageTimeout);
            expect(component.message).toEqual('');
        }));
    });

    describe('onMapHidden', () => {
        it('should set the message and clear it after timeout when message is non-empty', fakeAsync(() => {
            const event = { message: 'Map already deleted, cannot hide it' };
            component.onMapDeleted(event);
            component.onMapHidden(event);
            expect(component.message).toEqual(event.message);
            tick(AdminPageComponent.messageTimeout);
            expect(component.message).toEqual('');
        }));
    });
});
