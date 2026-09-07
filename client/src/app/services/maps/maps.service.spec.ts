/* eslint-disable */
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GameMap } from '@app/interfaces/game-map.interface';
import { environment } from 'src/environments/environment';
import { MapService } from './maps.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('MapService', () => {
    let service: MapService;
    let httpMock: HttpTestingController;
    const apiUrl = `${environment.serverUrl}/maps`;
    const smallSize = 10;
    const mediumSize = 15;

    const dummyMaps: GameMap[] = [
        {
            _id: '1',
            name: 'Map 1',
            size: '10',
            tiles: Array.from({ length: 10 }, () => Array(smallSize).fill('grass')),
            items: Array.from({ length: 10 }, () => Array(smallSize).fill('empty')),
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
            tiles: Array.from({ length: 15 }, () => Array(mediumSize).fill('grass')),
            items: Array.from({ length: 15 }, () => Array(mediumSize).fill('empty')),
            gameMode: 'Classic',
            description: 'Description 2',
            imageUrl: '',
            lastSave: new Date(),
            hidden: false,
            nbCheckpoints: '3',
            nbRandomItems: '5',
        },
    ];

    const dummyMap: GameMap = {
        _id: '1',
        name: 'Map 1',
        size: '10',
        tiles: Array.from({ length: 10 }, () => Array(smallSize).fill('grass')),
        items: Array.from({ length: 10 }, () => Array(smallSize).fill('empty')),
        gameMode: 'Classic',
        description: 'Description 1',
        imageUrl: '',
        lastSave: new Date(),
        hidden: false,
        nbCheckpoints: '3',
        nbRandomItems: '5',
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [MapService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()],
        });
        service = TestBed.inject(MapService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    describe('getAllMaps', () => {
        it('should perform a GET request and return an Observable<GameMap[]>', () => {
            service.getAllMaps().subscribe((maps) => {
                expect(maps.length).toBe(2);
                expect(maps).toEqual(dummyMaps);
            });
            const req = httpMock.expectOne(apiUrl);
            expect(req.request.method).toBe('GET');
            req.flush(dummyMaps);
        });
    });

    describe('loadMaps', () => {
        it('should update mapsSubject with the maps from getAllMaps', () => {
            service.loadMaps();
            const req = httpMock.expectOne(apiUrl);
            req.flush(dummyMaps);
            service.maps$.subscribe((maps) => {
                expect(maps).toEqual(dummyMaps);
            });
        });
    });

    describe('saveMap', () => {
        it('should perform a POST request and return the saved map', () => {
            service.saveMap(dummyMap).subscribe((map) => {
                expect(map).toEqual(dummyMap);
            });
            const req = httpMock.expectOne(apiUrl);
            expect(req.request.method).toBe('POST');
            expect(req.request.body).toEqual(dummyMap);
            req.flush(dummyMap);
        });
    });

    describe('updateMap', () => {
        it('should perform a PUT request to update the map', () => {
            service.updateMap(dummyMap._id, dummyMap).subscribe((map) => {
                expect(map).toEqual(dummyMap);
            });
            const req = httpMock.expectOne(`${apiUrl}/${dummyMap._id}`);
            expect(req.request.method).toBe('PUT');
            expect(req.request.body).toEqual(dummyMap);
            req.flush(dummyMap);
        });
    });

    describe('loadMap', () => {
        it('should perform a GET request for a specific map', () => {
            service.loadMap(dummyMap._id).subscribe((map) => {
                expect(map).toEqual(dummyMap);
            });
            const req = httpMock.expectOne(`${apiUrl}/${dummyMap._id}`);
            expect(req.request.method).toBe('GET');
            req.flush(dummyMap);
        });
    });

    describe('editMap', () => {
        it('should perform a PUT request and update mapsSubject', () => {
            service.mapsSubject.next(dummyMaps);
            const updatedMap: GameMap = { ...dummyMap, name: 'Updated Map' };
            service.editMap(updatedMap).subscribe((map) => {
                expect(map).toEqual(updatedMap);
            });
            const req = httpMock.expectOne(`${apiUrl}/${dummyMap._id}`);
            expect(req.request.method).toBe('PUT');
            req.flush(updatedMap);
            service.maps$.subscribe((maps) => {
                const found = maps.find((m) => m._id === dummyMap._id);
                expect(found?.name).toEqual('Updated Map');
            });
        });
    });

    describe('deleteMap', () => {
        it('should perform a DELETE request and update mapsSubject on success', () => {
            service.mapsSubject.next(dummyMaps);
            service.deleteMap('1').subscribe(() => {
                service.maps$.subscribe((maps) => {
                    expect(maps.find((m) => m._id === '1')).toBeUndefined();
                });
            });
            const req = httpMock.expectOne(`${apiUrl}/1`);
            expect(req.request.method).toBe('DELETE');
            req.flush(null);
        });

        it('should update mapsSubject and propagate error when a 404 error occurs', () => {
            const notFound = 404;
            service.mapsSubject.next(dummyMaps);
            service.deleteMap('1').subscribe({
                next: () => fail('expected error'),
                error: (err) => {
                    expect(err.status).toBe(notFound);
                    service.maps$.subscribe((maps) => {
                        expect(maps.find((m) => m._id === '1')).toBeUndefined();
                    });
                },
            });
            const req = httpMock.expectOne(`${apiUrl}/1`);
            expect(req.request.method).toBe('DELETE');
            req.flush({}, { status: 404, statusText: 'Not Found' });
        });

        it('should propagate error when a non-404 error occurs', () => {
            const serverError = 500;
            service.mapsSubject.next(dummyMaps);
            service.deleteMap('1').subscribe({
                next: () => fail('expected error'),
                error: (err) => {
                    expect(err.status).toBe(serverError);
                },
            });
            const req = httpMock.expectOne(`${apiUrl}/1`);
            expect(req.request.method).toBe('DELETE');
            req.flush({}, { status: 500, statusText: 'Server Error' });
        });
    });

    describe('toggleHideMap', () => {
        it('should perform a PATCH request and update mapsSubject', () => {
            service.mapsSubject.next(dummyMaps);
            const updatedMap: GameMap = { ...dummyMaps[0], hidden: !dummyMaps[0].hidden };
            service.toggleHideMap(dummyMaps[0]._id!).subscribe((map) => {
                expect(map).toEqual(updatedMap);
            });
            const req = httpMock.expectOne(`${apiUrl}/${dummyMaps[0]._id}/toggle`);
            expect(req.request.method).toBe('PATCH');
            req.flush(updatedMap);
            service.maps$.subscribe((maps) => {
                const found = maps.find((m) => m._id === dummyMaps[0]._id);
                expect(found?.hidden).toEqual(updatedMap.hidden);
            });
        });

        it('should throw a 404 error when toggling hide on an already deleted map', () => {
            const notFound = 404;
            service.mapsSubject.next(dummyMaps);
            service.toggleHideMap('1').subscribe({
                next: () => fail('expected error'),
                error: (err) => {
                    expect(err.status).toBe(notFound);
                    service.maps$.subscribe((maps) => {
                        expect(maps.find((m) => m._id === '1')).toBeUndefined();
                    });
                },
            });
            const req = httpMock.expectOne(`${apiUrl}/1/toggle`);
            expect(req.request.method).toBe('PATCH');
            req.flush({}, { status: 404, statusText: 'Not Found' });
        });

        it('should propagate error when a 500 error occurs', () => {
            const serverError = 500;
            service.mapsSubject.next(dummyMaps);
            service.toggleHideMap('1').subscribe({
                next: () => fail('expected error'),
                error: (err) => {
                    expect(err.status).toBe(serverError);
                },
            });
            const req = httpMock.expectOne(`${apiUrl}/1/toggle`);
            expect(req.request.method).toBe('PATCH');
            req.flush({}, { status: 500, statusText: 'Server Error' });
        });
    });

    describe('checkGameAvailability', () => {
        it('should perform a GET request and return availability', () => {
            service.checkGameAvailability('game1').subscribe((available) => {
                expect(available).toBeTrue();
            });
            const req = httpMock.expectOne(`${apiUrl}/game1/available`);
            expect(req.request.method).toBe('GET');
            req.flush(true);
        });
    });
});
