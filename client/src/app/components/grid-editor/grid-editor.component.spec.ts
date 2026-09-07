/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines */
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { GameMap } from '@app/interfaces/game-map.interface';
import { DragDropService } from '@app/services/drag-drop/drag-drop.service';
import { GridService } from '@app/services/grid/grid.service';
import { MapService } from '@app/services/maps/maps.service';
import { of, throwError } from 'rxjs';
import { GridEditorComponent } from './grid-editor.component';

describe('GridEditorComponent', () => {
    let dragDropService: jasmine.SpyObj<DragDropService>;
    let component: GridEditorComponent;
    let fixture: ComponentFixture<GridEditorComponent>;
    let routerSpy: jasmine.SpyObj<Router>;
    let mapServiceSpy: jasmine.SpyObj<MapService>;
    let gridService: jasmine.SpyObj<GridService>;

    const smallSize = 10;

    const dummyMap: GameMap = {
        _id: '123',
        name: 'Dummy Map',
        size: '10',
        tiles: Array.from({ length: smallSize }, () => Array(smallSize).fill('grass')),
        items: Array.from({ length: smallSize }, () => Array(smallSize).fill('empty')),
        gameMode: 'Classic',
        description: 'Dummy Desc',
        imageUrl: '',
        lastSave: new Date(),
        hidden: false,
        nbCheckpoints: '3',
        nbRandomItems: '5',
    };

    beforeEach(() => {
        jasmine.getEnv().allowRespy(true);

        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        mapServiceSpy = jasmine.createSpyObj('MapService', ['loadMap']);
        dragDropService = jasmine.createSpyObj('DragDropService', ['setDraggedItem', 'isDragFromToolbar', 'getDraggedItem', 'clearDraggedItem']);

        gridService = jasmine.createSpyObj('GridService', [
            'gridSize',
            'updateCell',
            'updateItem',
            'selectedTile',
            'checkpointsRemaining',
            'randomItemsRemaining',
            'isDirty',
            'resetGridState',
            'takeScreenshot',
            'saveState',
            'grid',
            'items',
            'loadMap',
            'decrementCheckpoint',
            'decrementRandomItem',
            'incrementCheckpoint',
            'incrementRandomItem',
            'checkpointsRemaining',
            'randomItemsRemaining',
            'reachedMaxItems',
        ]);

        const activatedRouteStub = { queryParams: of({ id: dummyMap._id }) };
        mapServiceSpy.loadMap.and.returnValue(of(dummyMap));

        TestBed.configureTestingModule({
            imports: [GridEditorComponent],
            providers: [
                { provide: ActivatedRoute, useValue: activatedRouteStub },
                { provide: Router, useValue: routerSpy },
                { provide: MapService, useValue: mapServiceSpy },
                { provide: DragDropService, useValue: dragDropService },
                { provide: GridService, useValue: gridService },
            ],
        });

        fixture = TestBed.createComponent(GridEditorComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('ngOnInit', () => {
        it('should call loadMap if id is present in queryParams', () => {
            component.ngOnInit();
            expect(mapServiceSpy.loadMap).toHaveBeenCalledWith(dummyMap._id);
        });

        it('should handle error when mapService.loadMap fails', fakeAsync(() => {
            mapServiceSpy.loadMap.and.returnValue(throwError(() => new Error('Erreur du service')));

            expect(() => {
                component.ngOnInit();
                tick();
            }).toThrow(new Error('Erreur lors du chargement de la carte.'));
        }));

        it('should set isDragging to false on mouse up', () => {
            component.isDragging = true;
            component.onMouseUp();
            expect(component.isDragging).toBeFalse();
        });

        it('should set isDragging true and isErasing false when left click is pressed', () => {
            const mouseEvent = { button: 0 } as MouseEvent;
            const handleCellActionSpy = spyOn<any>(component, 'handleCellAction');
            component.handleCellMouseDown({ event: mouseEvent, x: 2, y: 3 });

            expect(component.isDragging).toBeTrue();
            expect(component.isErasing).toBeFalse();
            expect(handleCellActionSpy).toHaveBeenCalledWith(2, 3, false);
        });
    });

    describe('handleCellMouseEnter', () => {
        it('should set isDragging true and isErasing true when right click is pressed', () => {
            const mouseEvent = { button: 2 } as MouseEvent;
            const handleCellActionSpy = spyOn<any>(component, 'handleCellAction');
            component.handleCellMouseDown({ event: mouseEvent, x: 1, y: 1 });

            expect(component.isDragging).toBeTrue();
            expect(component.isErasing).toBeTrue();
            expect(handleCellActionSpy).toHaveBeenCalledWith(1, 1, true);
        });

        it('should call handleCellAction when isDragging is true', () => {
            const handleCellActionSpy = spyOn<any>(component, 'handleCellAction');
            component.isDragging = true;
            component.isErasing = true;
            component.handleCellMouseEnter({ x: 5, y: 5 });
            expect(handleCellActionSpy).toHaveBeenCalledWith(5, 5, true);
        });

        it('should not call handleCellAction when isDragging is false', () => {
            const handleCellActionSpy = spyOn<any>(component, 'handleCellAction');
            component.isDragging = false;
            component.handleCellMouseEnter({ x: 1, y: 1 });
            expect(handleCellActionSpy).not.toHaveBeenCalled();
        });

        it('should update lastHandledCell when lastHandledCell is null and isDragging is true', () => {
            const handleCellActionSpy = spyOn<any>(component, 'handleCellAction');
            component.isDragging = true;
            component.isErasing = false;
            component.lastHandledCell = null;
            component.handleCellMouseEnter({ x: 3, y: 4 });
            expect(component.lastHandledCell).not.toBeNull();
            expect(handleCellActionSpy).toHaveBeenCalledWith(3, 4, false);
        });

        it('should update lastHandledCell when coordinates differ and isDragging is true', () => {
            const handleCellActionSpy = spyOn<any>(component, 'handleCellAction');
            component.isDragging = true;
            component.isErasing = false;
            component.lastHandledCell = { x: 1, y: 1 };
            component.handleCellMouseEnter({ x: 2, y: 2 });
            expect(handleCellActionSpy).toHaveBeenCalledWith(2, 2, false);
        });

        it('should update lastHandledCell when only x coordinate differs', () => {
            const handleCellActionSpy = spyOn<any>(component, 'handleCellAction');
            component.isDragging = true;
            component.isErasing = false;
            component.lastHandledCell = { x: 1, y: 2 };
            component.handleCellMouseEnter({ x: 2, y: 2 });
            expect(handleCellActionSpy).toHaveBeenCalledWith(2, 2, false);
        });

        it('should update lastHandledCell when only y coordinate differs', () => {
            const handleCellActionSpy = spyOn<any>(component, 'handleCellAction');
            component.isDragging = true;
            component.isErasing = false;
            component.lastHandledCell = { x: 2, y: 1 };
            component.handleCellMouseEnter({ x: 2, y: 2 });
            expect(handleCellActionSpy).toHaveBeenCalledWith(2, 2, false);
        });
        it('should not update lastHandledCell when coordinates are the same', () => {
            const handleCellActionSpy = spyOn<any>(component, 'handleCellAction');
            component.isDragging = true;
            component.isErasing = false;
            component.lastHandledCell = { x: 2, y: 2 };
            component.handleCellMouseEnter({ x: 2, y: 2 });
            expect(handleCellActionSpy).not.toHaveBeenCalled();
        });
    });

    describe('handleItemMouseDown', () => {
        it('should stop event propagation', () => {
            const event = new MouseEvent('mousedown');
            spyOn(event, 'stopPropagation');
            component.handleItemMouseDown(event);
            expect(event.stopPropagation).toHaveBeenCalled();
        });
    });

    describe('handleGridItemDragStart', () => {
        it('should set dataTransfer item and call setDraggedItem when dataTransfer is defined', () => {
            const mockDataTransfer = {
                setData: jasmine.createSpy(),
                effectAllowed: '',
            } as unknown as DataTransfer;
            const mockEvent = {
                dataTransfer: mockDataTransfer,
            } as DragEvent;
            component.handleGridItemDragStart({ event: mockEvent, item: 'random', x: 4, y: 5 });
            expect(mockDataTransfer.setData).toHaveBeenCalledWith('item', 'random');
            expect(mockDataTransfer.effectAllowed).toBe('move');
            expect(dragDropService.setDraggedItem).toHaveBeenCalledWith('random', 4, 5);
        });
    });

    describe('handleDragOver', () => {
        it('should prevent default on drag over', () => {
            const event = new DragEvent('dragover');
            spyOn(event, 'preventDefault');
            component.handleDragOver(event);
            expect(event.preventDefault).toHaveBeenCalled();
        });
    });

    describe('handleCellDrop', () => {
        function createFakeEvent(itemType: string): DragEvent {
            return {
                preventDefault: jasmine.createSpy('preventDefault'),
                dataTransfer: {
                    getData: () => itemType,
                },
            } as unknown as DragEvent;
        }
        beforeEach(() => {
            dragDropService.getDraggedItem = jasmine.createSpy().and.returnValue({ x: -1, y: -1 });
            dragDropService.isDragFromToolbar.and.returnValue(false);
            gridService.grid.and.returnValue([['grass']]);
            gridService.items.and.returnValue([['empty']]);
        });

        it('should prevent default on drop event', () => {
            const event = createFakeEvent('checkpoint');
            component.handleCellDrop({ event, x: 0, y: 0 });
            expect(event.preventDefault).toHaveBeenCalled();
        });

        it('should return early if tile is blocked', () => {
            const event = createFakeEvent('item');
            spyOn(component as any, 'isTileBlocked').and.returnValue(true);

            component.handleCellDrop({ event, x: 0, y: 0 });

            expect(gridService.updateItem).not.toHaveBeenCalled();
        });

        it('should place checkpoint if allowed from toolbar', () => {
            const event = createFakeEvent('checkpoint');
            dragDropService.isDragFromToolbar.and.returnValue(true);
            gridService.checkpointsRemaining.and.returnValue(1);

            component.handleCellDrop({ event, x: 0, y: 0 });

            expect(gridService.updateItem).toHaveBeenCalledWith(0, 0, 'checkpoint');
            expect(gridService.decrementCheckpoint).toHaveBeenCalled();
        });

        it('should place random if allowed from toolbar', () => {
            const event = createFakeEvent('random');
            dragDropService.isDragFromToolbar.and.returnValue(true);
            gridService.randomItemsRemaining.and.returnValue(1);

            component.handleCellDrop({ event, x: 0, y: 0 });

            expect(gridService.updateItem).toHaveBeenCalledWith(0, 0, 'random');
            expect(gridService.decrementRandomItem).toHaveBeenCalled();
        });

        it('should clear previous dragged item if valid', () => {
            dragDropService.getDraggedItem.and.returnValue({ x: 1, y: 1, item: 'shield' });
            const event = createFakeEvent('shield');
            gridService.grid.and.returnValue([['grass'], ['grass']]);
            gridService.items.and.returnValue([['empty'], ['empty']]);

            component.handleCellDrop({ event, x: 0, y: 0 });

            expect(gridService.updateItem).toHaveBeenCalledWith(1, 1, 'empty');
            expect(gridService.updateItem).toHaveBeenCalledWith(0, 0, 'shield');
            expect(dragDropService.clearDraggedItem).toHaveBeenCalled();
        });

        it('should return early if no checkpoints remaining', () => {
            const event = {
                preventDefault: jasmine.createSpy('preventDefault'),
                dataTransfer: {
                    getData: () => 'checkpoint',
                },
            } as unknown as DragEvent;
            dragDropService.isDragFromToolbar.and.returnValue(true);
            gridService.checkpointsRemaining.and.returnValue(0);
            gridService.grid.and.returnValue([['grass']]);
            gridService.items.and.returnValue([['empty']]);
            component.handleCellDrop({ event, x: 0, y: 0 });
            expect(gridService.updateItem).not.toHaveBeenCalled();
            expect(gridService.decrementCheckpoint).not.toHaveBeenCalled();
        });

        it('should return early if no random items remaining', () => {
            const event = {
                preventDefault: jasmine.createSpy('preventDefault'),
                dataTransfer: {
                    getData: () => 'random',
                },
            } as unknown as DragEvent;
            dragDropService.isDragFromToolbar.and.returnValue(true);
            gridService.randomItemsRemaining.and.returnValue(0);
            gridService.grid.and.returnValue([['grass']]);
            gridService.items.and.returnValue([['empty']]);
            component.handleCellDrop({ event, x: 0, y: 0 });
            expect(gridService.updateItem).not.toHaveBeenCalled();
            expect(gridService.decrementRandomItem).not.toHaveBeenCalled();
        });
    });

    describe('handleDeleteItem', () => {
        it('should call updateItem with empty when right click is pressed', () => {
            const event = new MouseEvent('mousedown', { button: 2 });
            gridService.items.and.returnValue([
                ['empty', 'checkpoint'],
                ['random', 'empty'],
            ]);
            component.handleDeleteItem({ event, x: 1, y: 1 });
            expect(gridService.updateItem).toHaveBeenCalledWith(1, 1, 'empty');
        });

        it('should not call updateItem when left click is pressed', () => {
            const event = new MouseEvent('mousedown', { button: 0 });
            component.handleDeleteItem({ event, x: 1, y: 1 });
            expect(gridService.updateItem).not.toHaveBeenCalled();
        });

        it('should call incrementCheckpoint when deleting a checkpoint', () => {
            const event = new MouseEvent('mousedown', { button: 2 });
            spyOn(event, 'preventDefault');

            gridService.items.and.returnValue([['checkpoint']]);

            component.handleDeleteItem({ event, x: 0, y: 0 });

            expect(event.preventDefault).toHaveBeenCalled();
            expect(gridService.incrementCheckpoint).toHaveBeenCalled();
            expect(gridService.updateItem).toHaveBeenCalledWith(0, 0, 'empty');
        });

        it('should call incrementRandomItem when deleting a random item', () => {
            const event = new MouseEvent('mousedown', { button: 2 });
            spyOn(event, 'preventDefault');

            gridService.items.and.returnValue([['random']]);

            component.handleDeleteItem({ event, x: 0, y: 0 });

            expect(event.preventDefault).toHaveBeenCalled();
            expect(gridService.incrementRandomItem).toHaveBeenCalled();
            expect(gridService.updateItem).toHaveBeenCalledWith(0, 0, 'empty');
        });
    });

    describe('onExit', () => {
        it('should set showUnsavedPopup to true if gridService.isDirty() returns true', () => {
            spyOn(gridService, 'isDirty').and.returnValue(true);
            component.onExit();
            expect(component.showUnsavedPopup).toBeTrue();
        });

        it('should call quit if gridService.isDirty() returns false', () => {
            spyOn(gridService, 'isDirty').and.returnValue(false);
            spyOn<any>(component, 'quit');
            component.onExit();
            expect(component['quit']).toHaveBeenCalled();
        });
    });

    describe('onSave', () => {
        let form: NgForm;
        beforeEach(() => {
            form = {
                get valid() {
                    return true;
                },
                control: {
                    markAllAsTouched: jasmine.createSpy('markAllAsTouched'),
                    markAsPristine: jasmine.createSpy('markAsPristine'),
                },
            } as any as NgForm;
        });

        it('should successfully save state and call quit', fakeAsync(() => {
            spyOn(gridService, 'takeScreenshot').and.returnValue(Promise.resolve('dummyScreenshotUrl'));
            spyOn(gridService, 'saveState').and.returnValue(of(dummyMap));
            spyOn<any>(component, 'quit');

            component.onSave(form);
            tick();
            expect(component.isSaving).toBeFalse();
            expect(component.gameSavedMessage).toEqual('La carte a été sauvegardée!');
            tick(GridEditorComponent.quitTimeout);
            expect(component['quit']).toHaveBeenCalled();
        }));

        it('should handle error from saveState and set errorPopupVisible', fakeAsync(() => {
            spyOn(gridService, 'takeScreenshot').and.returnValue(Promise.resolve('dummyScreenshotUrl'));
            spyOn(gridService, 'saveState').and.returnValue(throwError(() => new Error('Save error')));

            component.onSave(form);
            tick();
            expect(component.isSaving).toBeFalse();
            expect(component.errorMessage).toContain('Save error');
            expect(component.errorPopupVisible).toBeTrue();
        }));

        it('should mark all fields as touched and return if form is invalid', () => {
            const invalidForm = {
                valid: false,
                control: {
                    markAllAsTouched: jasmine.createSpy('markAllAsTouched'),
                },
            } as any as NgForm;
            component.onSave(invalidForm);
            expect(invalidForm.control.markAllAsTouched).toHaveBeenCalled();
        });

        it('should handle case when gridCanvasComponent is null', fakeAsync(() => {
            component.gridCanvasComponent = {
                gridContainer: undefined,
            } as any;
            spyOn(gridService, 'saveState').and.returnValue(of(dummyMap));
            spyOn<any>(component, 'quit');
            component.onSave(form);
            tick();
            expect(gridService.saveState).toHaveBeenCalledWith('');
            expect(component.isSaving).toBeFalse();
            expect(component.gameSavedMessage).toEqual('La carte a été sauvegardée!');
        }));

        it('should handle case when gridContainer has nativeElement', fakeAsync(() => {
            component.gridCanvasComponent = {
                gridContainer: {
                    nativeElement: document.createElement('div'),
                },
            } as any;
            const mockScreenshotUrl = 'screenshot-url';
            spyOn(gridService, 'takeScreenshot').and.returnValue(Promise.resolve(mockScreenshotUrl));
            spyOn(gridService, 'saveState').and.returnValue(of(dummyMap));
            spyOn<any>(component, 'quit');
            component.onSave(form);
            tick();
            expect(gridService.takeScreenshot).toHaveBeenCalled();
            expect(gridService.saveState).toHaveBeenCalledWith(mockScreenshotUrl);
            expect(component.isSaving).toBeFalse();
        }));

        it('should return if isSaving is true', () => {
            component.isSaving = true;
            component.onSave(form);
            expect(gridService.saveState).not.toHaveBeenCalled();
        });
    });

    describe('onErrorPopupClosed', () => {
        it('should set errorPopupVisible to false', () => {
            component.errorPopupVisible = true;
            component.onErrorPopupClosed();
            expect(component.errorPopupVisible).toBeFalse();
        });
    });

    describe('onConfirmExit', () => {
        it('should set showUnsavedPopup to false and call quit if response is true', () => {
            component.showUnsavedPopup = true;
            spyOn<any>(component, 'quit');
            component.onConfirmExit(true);
            expect(component.showUnsavedPopup).toBeFalse();
            expect(component['quit']).toHaveBeenCalled();
        });

        it('should set showUnsavedPopup to false and not call quit if response is false', () => {
            component.showUnsavedPopup = true;
            spyOn<any>(component, 'quit');
            component.onConfirmExit(false);
            expect(component.showUnsavedPopup).toBeFalse();
            expect(component['quit']).not.toHaveBeenCalled();
        });
    });

    describe('handleCellAction', () => {
        it('should erase the tile and set it to grass if isErase is true', () => {
            gridService.grid.and.returnValue([['doorOpen']]);
            gridService.items.and.returnValue([['empty']]);

            (component as any).handleCellAction(0, 0, true);

            expect(gridService.updateCell).toHaveBeenCalledWith(0, 0, 'grass');
            expect(gridService.updateItem).not.toHaveBeenCalled();
        });

        it('should return if tile is door and item is not empty', () => {
            gridService.grid.and.returnValue([['doorOpen']]);
            gridService.items.and.returnValue([['random']]);
            gridService.selectedTile.and.returnValue('doorClose');

            (component as any).handleCellAction(0, 0, false);

            expect(gridService.updateCell).not.toHaveBeenCalled();
            expect(gridService.updateItem).not.toHaveBeenCalled();
        });

        it('should toggle doorClose to doorOpen when selected tile is doorClose', () => {
            gridService.grid.and.returnValue([['doorClose']]);
            gridService.items.and.returnValue([['empty']]);
            gridService.selectedTile.and.returnValue('doorClose');

            (component as any).handleCellAction(0, 0, false);

            expect(gridService.updateCell).toHaveBeenCalledWith(0, 0, 'doorOpen');
            expect(gridService.updateItem).toHaveBeenCalledWith(0, 0, 'empty');
        });

        it('should toggle doorOpen to doorClose when selected tile is doorClose', () => {
            gridService.grid.and.returnValue([['doorOpen']]);
            gridService.items.and.returnValue([['empty']]);
            gridService.selectedTile.and.returnValue('doorClose');

            (component as any).handleCellAction(0, 0, false);

            expect(gridService.updateCell).toHaveBeenCalledWith(0, 0, 'doorClose');
            expect(gridService.updateItem).toHaveBeenCalledWith(0, 0, 'empty');
        });

        it('should update both cell and item when valid tile is selected', () => {
            gridService.grid.and.returnValue([['grass']]);
            gridService.items.and.returnValue([['random']]);
            gridService.selectedTile.and.returnValue('water');

            (component as any).handleCellAction(0, 0, false);

            expect(gridService.updateCell).toHaveBeenCalledWith(0, 0, 'water');
            expect(gridService.updateItem).toHaveBeenCalledWith(0, 0, 'random');
        });
    });

    describe('quit', () => {
        it('should not navigate if gridService.isDirty() returns true', () => {
            spyOn(gridService, 'isDirty').and.returnValue(true);
            (component as any).quit();
            expect(routerSpy.navigate).not.toHaveBeenCalled();
            expect(gridService.resetGridState).not.toHaveBeenCalled();
        });

        it('should navigate to /admin when quit is called', fakeAsync(() => {
            const spy = spyOn(component['router'], 'navigate');
            (component as any).quit();
            tick(GridEditorComponent.quitTimeout);
            expect(spy).toHaveBeenCalledWith(['/admin']);
        }));
    });

    describe('getFriendlyErrorMessage', () => {
        it('should return a friendly error message based on raw message', () => {
            const rawMessage = 'terrainTilePercentage, doorTileAdjacency';
            const friendlyMessage = (component as any).getFriendlyErrorMessage(rawMessage);
            expect(friendlyMessage).toContain('Les tuiles de terrain occupent moins de 50%');
            expect(friendlyMessage).toContain('Une ou plusieurs portes ne respectent pas');
        });
    });
});
