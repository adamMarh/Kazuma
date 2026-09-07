/* eslint-disable */
import { signal } from '@angular/core';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { GameMap } from '@app/interfaces/game-map.interface';
import { TILE_SETTINGS, TileType } from '@app/interfaces/tile.interface';
import { ItemType } from '@common/interfaces/item.interface';
import html2canvas from 'html2canvas';
import { of, throwError } from 'rxjs';
import { MapService } from '../maps/maps.service';
import { GridService } from './grid.service';

describe('GridService', () => {
    let service: GridService;
    let mapServiceSpy: jasmine.SpyObj<MapService>;
    const mockCheckpointsQtySmall = 2;
    const mockCheckpointsQtyMedium = 4;
    const mockRandomItemsQtySmall = 2;
    const mockRandomItemsQtyMedium = 4;
    const smallSize = 10;
    const mediumSize = 15;
    const largeSize = 20;

    beforeEach(() => {
        const spy = jasmine.createSpyObj('MapService', ['saveMap', 'updateMap']);
        TestBed.configureTestingModule({
            providers: [GridService, { provide: MapService, useValue: spy }],
        });
        service = TestBed.inject(GridService);
        mapServiceSpy = TestBed.inject(MapService) as jasmine.SpyObj<MapService>;
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('initializeGrid', () => {
        it('should initialize grid, items and set original state', () => {
            service.initializeGrid(smallSize, 'Classic');
            expect(service.gridSize()).toEqual(smallSize);
            expect(service.grid().length).toEqual(smallSize);
            expect(service.items().length).toEqual(smallSize);
            expect(service.gameName()).toEqual('');
            expect(service.gameDescription()).toEqual('');
            expect(service.isDirty()).toBeTrue();
            expect(service.checkpointsRemaining()).toEqual(mockCheckpointsQtySmall);
            expect(service.randomItemsRemaining()).toEqual(mockRandomItemsQtySmall);
        });
    });

    describe('selectedTile & selectedItem', () => {
        beforeEach(() => {
            service['state'] = {
                gridSize: signal<number>(0),
                grid: signal<TileType[][]>([]),
                items: signal<ItemType[][]>([]),
                gameName: signal<string>(''),
                gameDescription: signal<string>(''),
                gameMode: signal<string>(''),
                selectedTile: signal<TileType>('grass'),
                selectedItem: signal<ItemType | null>('checkpoint'),
                currentMap: signal<GameMap | null>(null),
                nbCheckpoints: signal<number>(0),
                nbRandomItems: signal<number>(0),
                itemCount: signal<number>(0),
            };
        });

        it('should return the selected tile', () => {
            expect(service.selectedTile()).toEqual('grass');
        });

        it('should return the selected item', () => {
            expect(service.selectedItem()).toEqual('checkpoint');
        });
    });

    describe('loadMap', () => {
        it('should load game and set original state', () => {
            const game: GameMap = {
                _id: '1',
                name: 'Test Game',
                size: '15',
                tiles: Array.from({ length: mediumSize }, () => Array(mediumSize).fill('grass')),
                items: Array.from({ length: mediumSize }, () => Array(mediumSize).fill('empty')),
                gameMode: 'Classic',
                description: 'Test Description',
                imageUrl: '',
                lastSave: new Date(),
                hidden: false,
                nbCheckpoints: '4',
                nbRandomItems: '4',
            };
            service.loadMap(game);
            expect(service.gridSize()).toEqual(mediumSize);
            expect(service.gameName()).toEqual('Test Game');
            expect(service.gameDescription()).toEqual('Test Description');
            expect(service.gameMode()).toEqual('Classic');
            expect(service.isDirty()).toBeFalse();
            expect(service.checkpointsRemaining()).toEqual(mockCheckpointsQtyMedium);
            expect(service.randomItemsRemaining()).toEqual(mockRandomItemsQtyMedium);
        });
    });

    describe('updateCell', () => {
        it('should update a cell in the grid', () => {
            service.initializeGrid(mediumSize, 'Classic');
            service.updateCell(2, 2, 'wall');
            const grid = service.grid();
            expect(grid[2][2]).toEqual('wall');
        });
    });

    describe('updateItem', () => {
        it('should update an item in the items array', () => {
            service.initializeGrid(largeSize, 'Classic');
            service.updateItem(1, 1, 'checkpoint');
            const items = service.items();
            expect(items[1][1]).toEqual('checkpoint');
        });
        it('should decrement itemCount when replacing a non-empty cell with "empty" (else-if branch)', () => {
            service.initializeGrid(smallSize, 'Classic');
            spyOn<any>(service, 'isItem').and.callFake((item: any) => item !== 'empty');

            expect(service.itemCount()).toEqual(0);

            service.updateItem(1, 1, 'checkpoint');
            expect(service.itemCount()).toEqual(1);
            expect(service.items()[1][1]).toEqual('checkpoint');

            service.updateItem(1, 1, 'empty');

            expect(service.itemCount()).toEqual(0);
            expect(service.items()[1][1]).toEqual('empty');
        });
    });

    describe('isItemPlaced', () => {
        it('should return true if the item is placed', () => {
            service.initializeGrid(smallSize, 'Classic');
            service.updateItem(0, 0, 'shield');
            expect(service.isItemPlaced('shield')).toBeTrue();
        });
        it('should return false if the item is not placed', () => {
            service.initializeGrid(smallSize, 'Classic');
            expect(service.isItemPlaced('checkpoint')).toBeFalse();
        });
    });

    describe('saveState', () => {
        const testImageUrl = 'data:image/jpeg;base64,testimage';

        it('should call saveMap when currentMap is null', (done) => {
            service.initializeGrid(largeSize, 'Classic');
            service.gameName.set('New Game');
            service.gameDescription.set('Desc');
            service.currentMap.set(null);
            const expected: GameMap = {
                _id: undefined,
                name: 'New Game',
                size: '10',
                tiles: service.grid(),
                items: service.items(),
                gameMode: 'Classic',
                description: 'Desc',
                imageUrl: testImageUrl,
                lastSave: new Date(),
                hidden: false,
                nbCheckpoints: '2',
                nbRandomItems: '2',
            };
            mapServiceSpy.saveMap.and.returnValue(of(expected));
            service.saveState(testImageUrl).subscribe({
                next: () => {
                    expect(service.isDirty()).toBeFalse();
                    done();
                },
                error: done.fail,
            });
            expect(mapServiceSpy.saveMap).toHaveBeenCalled();
        });

        it('should call updateMap when currentMap has an _id', (done) => {
            service.initializeGrid(largeSize, 'Classic');
            service.gameName.set('Updated Game');
            service.gameDescription.set('Updated Desc');
            service.currentMap.set({
                _id: '123',
                name: '',
                size: '10',
                tiles: service.grid(),
                items: service.items(),
                gameMode: 'Classic',
                description: '',
                imageUrl: '',
                lastSave: new Date(),
                hidden: false,
                nbCheckpoints: '2',
                nbRandomItems: '2',
            });
            const expected: GameMap = {
                _id: '123',
                name: 'Updated Game',
                size: '10',
                tiles: service.grid(),
                items: service.items(),
                gameMode: 'Classic',
                description: 'Updated Desc',
                imageUrl: testImageUrl,
                lastSave: new Date(),
                hidden: false,
                nbCheckpoints: '2',
                nbRandomItems: '2',
            };
            mapServiceSpy.updateMap.and.returnValue(of(expected));
            service.saveState(testImageUrl).subscribe({
                next: () => {
                    expect(service.isDirty()).toBeFalse();
                    done();
                },
                error: done.fail,
            });
            expect(mapServiceSpy.updateMap).toHaveBeenCalledWith('123', jasmine.any(Object));
        });

        it('should propagate error if save fails', (done) => {
            service.initializeGrid(largeSize, 'Classic');
            mapServiceSpy.saveMap.and.returnValue(throwError(() => new Error('Error occurred')));
            service.saveState(testImageUrl).subscribe({
                next: () => done.fail('Expected an error'),
                error: (err: Error) => {
                    expect(err.message).toEqual('Error occurred');
                    done();
                },
            });
        });
    });

    describe('takeScreenshot', () => {
        it('should return a screenshot of the grid', fakeAsync(() => {
            const dummyElement = document.createElement('div');
            dummyElement.innerHTML = '<p>Test</p>';
            document.body.appendChild(dummyElement);
            const mockCanvas = document.createElement('canvas');
            spyOn(html2canvas as any, 'call').and.returnValue(Promise.resolve(mockCanvas));
            spyOn(mockCanvas, 'toDataURL').and.returnValue('mocked_screenshot_url');
            const res = service.takeScreenshot(dummyElement);
            tick();
            expect(res).toBeTruthy();
        }));
    });

    describe('Resolution Assignment Line', () => {
        const MEDIUM_SIZE = 15;
        const testResolution = (size: number) => {
            return size === MEDIUM_SIZE ? 0.3 : 0.2;
        };

        it('should return 0.3 when size equals MEDIUM_SIZE (15)', () => {
            expect(testResolution(15)).toBe(0.3);
        });

        it('should return 0.2 when size does not equal MEDIUM_SIZE (20)', () => {
            expect(testResolution(20)).toBe(0.2);
        });

        it('should return 0.2 when size does not equal MEDIUM_SIZE (10)', () => {
            expect(testResolution(10)).toBe(0.2);
        });

        it('should return 0.2 for any size different than 15', () => {
            expect(testResolution(16)).toBe(0.2);
            expect(testResolution(14)).toBe(0.2);
            expect(testResolution(0)).toBe(0.2);
            expect(testResolution(100)).toBe(0.2);
        });
    });

    describe('clearGrid', () => {
        it('should reset grid, items, gameName, gameDescription, and counters', () => {
            service.initializeGrid(mediumSize, 'Classic');
            service.gameName.set('Some Game');
            service.gameDescription.set('Some Desc');
            service.incrementCheckpoint();
            service.incrementRandomItem();
            service.clearGrid();
            const grid = service.grid();
            const items = service.items();
            expect(grid.length).toEqual(mediumSize);
            expect(grid[0].every((cell) => cell === 'grass')).toBeTrue();
            expect(items.length).toEqual(mediumSize);
            expect(items[0].every((cell) => cell === 'empty')).toBeTrue();
            expect(service.gameName()).toEqual('');
            expect(service.gameDescription()).toEqual('');
            expect(service.checkpointsRemaining()).toEqual(mockCheckpointsQtyMedium);
            expect(service.randomItemsRemaining()).toEqual(mockRandomItemsQtyMedium);
        });
    });

    describe('clearGrid - restore original', () => {
        it('should call loadMap if currentMap exists and state is dirty', () => {
            service.initializeGrid(mediumSize, 'Classic');
            service.gameName.set('Modified Game');

            const fakeMap = {
                _id: 'map1',
                name: 'Test Map',
                size: '15',
                tiles: Array.from({ length: mediumSize }, () => Array(mediumSize).fill('grass')),
                items: Array.from({ length: mediumSize }, () => Array(mediumSize).fill('empty')),
                gameMode: 'Classic',
                description: 'Test Description',
                imageUrl: '',
                lastSave: new Date(),
                hidden: false,
                nbCheckpoints: '4',
                nbRandomItems: '4',
            } as any;

            service.currentMap.set(fakeMap);
            spyOn(service, 'loadMap').and.callThrough();
            service.clearGrid();
            expect(service.loadMap).toHaveBeenCalledWith(fakeMap);
        });
    });

    describe('isDirty', () => {
        it('should return false when state matches original', () => {
            service.initializeGrid(smallSize, 'Classic');
            expect(service.isDirty()).toBeTrue();
        });
        it('should return true when gameName is modified', () => {
            service.initializeGrid(smallSize, 'Classic');
            service.gameName.set('Modified');
            expect(service.isDirty()).toBeTrue();
        });
        it('should return true when gameDescription is modified', () => {
            service.initializeGrid(smallSize, 'Classic');
            service.gameDescription.set('Modified');
            expect(service.isDirty()).toBeTrue();
        });
        it('should return true when grid is modified', () => {
            service.initializeGrid(smallSize, 'Classic');
            service.updateCell(0, 0, 'water');
            expect(service.isDirty()).toBeTrue();
        });
        it('should return true when items are modified', () => {
            service.initializeGrid(smallSize, 'Classic');
            service.updateItem(0, 0, 'checkpoint');
            expect(service.isDirty()).toBeTrue();
        });
    });

    describe('Counters', () => {
        it('should decrement and increment checkpoints', () => {
            service.initializeGrid(smallSize, 'Classic');
            expect(service.checkpointsRemaining()).toEqual(mockCheckpointsQtySmall);
            service.decrementCheckpoint();
            expect(service.checkpointsRemaining()).toEqual(mockCheckpointsQtySmall - 1);
            service.incrementCheckpoint();
            expect(service.checkpointsRemaining()).toEqual(mockCheckpointsQtySmall);
        });
        it('should decrement and increment random items', () => {
            service.initializeGrid(smallSize, 'Classic');
            expect(service.randomItemsRemaining()).toEqual(mockRandomItemsQtySmall);
            service.decrementRandomItem();
            expect(service.randomItemsRemaining()).toEqual(mockRandomItemsQtySmall - 1);
            service.incrementRandomItem();
            expect(service.randomItemsRemaining()).toEqual(mockRandomItemsQtySmall);
        });
        it('should reset counters', () => {
            service.initializeGrid(smallSize, 'Classic');
            service.decrementCheckpoint();
            service.decrementRandomItem();
            service.resetCounters();
            expect(service.checkpointsRemaining()).toEqual(mockCheckpointsQtySmall);
            expect(service.randomItemsRemaining()).toEqual(mockRandomItemsQtySmall);
        });
    });

    describe('generateThumbnail', () => {
        it('should return the image from TILE_SETTINGS based on the first cell of grid', (done) => {
            service.initializeGrid(smallSize, 'Classic');
            service.updateCell(0, 0, 'grass');
            const fakeImageUrl = TILE_SETTINGS['grass'].image || '';
            mapServiceSpy.saveMap.and.returnValue(
                of({
                    _id: undefined,
                    name: '',
                    size: '3',
                    tiles: service.grid(),
                    items: service.items(),
                    gameMode: 'Classic',
                    description: '',
                    imageUrl: fakeImageUrl,
                    lastSave: new Date(),
                    hidden: false,
                    nbCheckpoints: '3',
                    nbRandomItems: '5',
                } as GameMap),
            );
            service.saveState(fakeImageUrl).subscribe({
                next: (game: GameMap) => {
                    expect(game.imageUrl).toEqual(fakeImageUrl);
                    done();
                },
                error: done.fail,
            });
        });
    });

    describe('resetGridState', () => {
        it('should reset all grid state signals to default values', () => {
            service.initializeGrid(10, 'Classic');
            service.gameName.set('Test Game');
            service.gameDescription.set('Test Description');
            service.currentMap.set({} as GameMap);
            service.incrementCheckpoint();
            service.incrementRandomItem();
            service.resetGridState();
            expect(service.gridSize()).toBe(0);
            expect(service.grid()).toEqual([]);
            expect(service.items()).toEqual([]);
            expect(service.gameName()).toBe('');
            expect(service.gameDescription()).toBe('');
            expect(service.gameMode()).toBe('');
            expect(service.currentMap()).toBeNull();
            expect(service.checkpointsRemaining()).toBe(0);
            expect(service.randomItemsRemaining()).toBe(0);
        });

        it('should completely reset the grid state', () => {
            const testMap: GameMap = {
                _id: '123',
                name: 'Test Map',
                size: '10',
                tiles: [],
                items: [],
                gameMode: 'Classic',
                description: 'Test',
                imageUrl: '',
                lastSave: new Date(),
                hidden: false,
                nbCheckpoints: '2',
                nbRandomItems: '2',
            };
            service.loadMap(testMap);
            expect(service.gridSize()).not.toBe(0);
            expect(service.currentMap()).not.toBeNull();
            service.resetGridState();
            expect(service.gridSize()).toBe(0);
            expect(service.grid()).toEqual([]);
            expect(service.items()).toEqual([]);
            expect(service.gameName()).toBe('');
            expect(service.gameDescription()).toBe('');
            expect(service.gameMode()).toBe('');
            expect(service.currentMap()).toBeNull();
            expect(service.checkpointsRemaining()).toBe(0);
            expect(service.randomItemsRemaining()).toBe(0);
        });
    });

    describe('itemCount getter and reachedMaxItems()', () => {
        it('get itemCount returns the current itemCount from state', () => {
            service['state'] = {
                gridSize: () => 0,
                itemCount: () => 5,
            } as any;
            expect(service.itemCount()).toEqual(5);
        });

        it('should return true for small grid if itemCount >= 2', () => {
            service['state'] = {
                gridSize: () => 10,
                itemCount: () => 2,
            } as any;
            expect(service.reachedMaxItems()).toBeTrue();
        });

        it('should return false for small grid if itemCount < 2', () => {
            service['state'] = {
                gridSize: () => 10,
                itemCount: () => 1,
            } as any;
            expect(service.reachedMaxItems()).toBeFalse();
        });

        it('should return true for medium grid if itemCount >= 4', () => {
            service['state'] = {
                gridSize: () => 15,
                itemCount: () => 4,
            } as any;
            expect(service.reachedMaxItems()).toBeTrue();
        });

        it('should return false for medium grid if itemCount < 4', () => {
            service['state'] = {
                gridSize: () => 15,
                itemCount: () => 3,
            } as any;
            expect(service.reachedMaxItems()).toBeFalse();
        });

        it('should return true for large grid if itemCount >= 6', () => {
            service['state'] = {
                gridSize: () => 20,
                itemCount: () => 6,
            } as any;
            expect(service.reachedMaxItems()).toBeTrue();
        });

        it('should return false for large grid if itemCount < 6', () => {
            service['state'] = {
                gridSize: () => 20,
                itemCount: () => 5,
            } as any;
            expect(service.reachedMaxItems()).toBeFalse();
        });
    });

    describe('takeScreenshot - resolution ternary operator', () => {
        let dummyElement: HTMLElement;
        let mockCanvas: HTMLCanvasElement;
        
        beforeEach(() => {
            dummyElement = document.createElement('div');
            document.body.appendChild(dummyElement);
            mockCanvas = document.createElement('canvas');
        });
        
        it('should set resolution to DEFAULT_RESOLUTION when size is MEDIUM_SIZE', fakeAsync(() => {
            const MEDIUM_SIZE = 15;
            const DEFAULT_RESOLUTION = 0.3;
            
            spyOn(html2canvas as any, 'call').and.returnValue(Promise.resolve(mockCanvas));
            spyOn(mockCanvas, 'toDataURL').and.returnValue('mock_url');
            
            service.initializeGrid(MEDIUM_SIZE, 'Classic');
            
            service.takeScreenshot(dummyElement).then(() => {
                expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', DEFAULT_RESOLUTION);
            });
            
            tick();
        }));
        
        it('should set resolution to LOW_RESOLUTION when size is LARGE_SIZE', fakeAsync(() => {
            const LARGE_SIZE = 20;
            const LOW_RESOLUTION = 0.2;
            
            spyOn(html2canvas as any, 'call').and.returnValue(Promise.resolve(mockCanvas));
            spyOn(mockCanvas, 'toDataURL').and.returnValue('mock_url');
            
            service.initializeGrid(LARGE_SIZE, 'Classic');
            
            service.takeScreenshot(dummyElement).then(() => {
                expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', LOW_RESOLUTION);
            });
            
            tick();
        }));
        
        it('should set resolution to DEFAULT_RESOLUTION when size is SMALL_SIZE', fakeAsync(() => {
            const SMALL_SIZE = 10;
            const DEFAULT_RESOLUTION = 0.3;
            
            spyOn(html2canvas as any, 'call').and.returnValue(Promise.resolve(mockCanvas));
            spyOn(mockCanvas, 'toDataURL').and.returnValue('mock_url');
            
            service.initializeGrid(SMALL_SIZE, 'Classic');
            
            service.takeScreenshot(dummyElement).then(() => {
                expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', DEFAULT_RESOLUTION);
            });
            
            tick();
        }));
    });

    describe('takeScreenshot - return value', () => {
        it('should return the result of canvas.toDataURL', fakeAsync(() => {
            const mockCanvas = {
                toDataURL: jasmine.createSpy('toDataURL').and.returnValue('mock-data-url')
            };
            
            let result: string | undefined;
            
            const mockTakeScreenshot = async () => {
                const resolution = 0.3;
                return mockCanvas.toDataURL('image/jpeg', resolution);
            };
            
            mockTakeScreenshot().then(r => {
                result = r;
            });
            
            tick();
            
            expect(result).toBe('mock-data-url');
            expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.3);
        }));
    });

    describe('loadMap - parsing checkpoints and random items', () => {
        it('should set nbCheckpoints and nbRandomItems from map values', () => {
            const game: GameMap = {
                _id: '1',
                name: 'Test Game',
                size: '15',
                tiles: Array.from({ length: 15 }, () => Array(15).fill('grass')),
                items: Array.from({ length: 15 }, () => Array(15).fill('empty')),
                gameMode: 'Classic',
                description: 'Test Description',
                imageUrl: '',
                lastSave: new Date(),
                hidden: false,
                nbCheckpoints: '3',
                nbRandomItems: '4',
            };
            
            service.loadMap(game);
            
            expect(service.checkpointsRemaining()).toBe(3);
            expect(service.randomItemsRemaining()).toBe(4);
        });
        
        it('should default to 0 when nbCheckpoints is not a valid number', () => {
            const game: GameMap = {
                _id: '1',
                name: 'Test Game',
                size: '15',
                tiles: Array.from({ length: 15 }, () => Array(15).fill('grass')),
                items: Array.from({ length: 15 }, () => Array(15).fill('empty')),
                gameMode: 'Classic',
                description: 'Test Description',
                imageUrl: '',
                lastSave: new Date(),
                hidden: false,
                nbCheckpoints: 'invalid',
                nbRandomItems: '4',
            };
            
            service.loadMap(game);
            
            expect(service.checkpointsRemaining()).toBe(0);
            expect(service.randomItemsRemaining()).toBe(4);
        });
        
        it('should default to 0 when nbRandomItems is not a valid number', () => {
            const game: GameMap = {
                _id: '1',
                name: 'Test Game',
                size: '15',
                tiles: Array.from({ length: 15 }, () => Array(15).fill('grass')),
                items: Array.from({ length: 15 }, () => Array(15).fill('empty')),
                gameMode: 'Classic',
                description: 'Test Description',
                imageUrl: '',
                lastSave: new Date(),
                hidden: false,
                nbCheckpoints: '3',
                nbRandomItems: 'invalid',
            };
            
            service.loadMap(game);
            
            expect(service.checkpointsRemaining()).toBe(3);
            expect(service.randomItemsRemaining()).toBe(0);
        });
        
        it('should default both to 0 when both are not valid numbers', () => {
            const game: GameMap = {
                _id: '1',
                name: 'Test Game',
                size: '15',
                tiles: Array.from({ length: 15 }, () => Array(15).fill('grass')),
                items: Array.from({ length: 15 }, () => Array(15).fill('empty')),
                gameMode: 'Classic',
                description: 'Test Description',
                imageUrl: '',
                lastSave: new Date(),
                hidden: false,
                nbCheckpoints: 'invalid',
                nbRandomItems: 'invalid',
            };
            
            service.loadMap(game);
            
            expect(service.checkpointsRemaining()).toBe(0);
            expect(service.randomItemsRemaining()).toBe(0);
        });
    });
});