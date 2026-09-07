/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines */
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TILE_SETTINGS, TileType } from '@app/interfaces/tile.interface';
import { DragDropService } from '@app/services/drag-drop/drag-drop.service';
import { GridService } from '@app/services/grid/grid.service';
import { ITEM_SETTINGS, ItemType } from '@common/interfaces/item.interface';
import { ToolbarComponent } from './toolbar.component';

@Component({
    selector: 'app-host',
    template: '<app-toolbar (saveClicked)="onSave()" (exitClicked)="onExit()"></app-toolbar>',
    standalone: true,
})
class HostComponent {
    onSave(): void {}
    onExit(): void {}
}

describe('ToolbarComponent', () => {
    let component: ToolbarComponent;
    let fixture: ComponentFixture<ToolbarComponent>;
    let gridService: jasmine.SpyObj<GridService>;
    let dragDropService: jasmine.SpyObj<DragDropService>;

    beforeEach(async () => {
        const gridServiceSpy = jasmine.createSpyObj(
            'GridService',
            ['isItemPlaced', 'updateItem', 'incrementCheckpoint', 'incrementRandomItem', 'checkpointsRemaining', 'randomItemsRemaining', 'gameMode'],
            {
                selectedTile: { set: jasmine.createSpy('selectedTile.set') },
                selectedItem: { set: jasmine.createSpy('selectedItem.set') },
            },
        );

        const dragDropServiceSpy = jasmine.createSpyObj('DragDropService', ['setDraggedItem', 'getDraggedItem', 'clearDraggedItem']);

        await TestBed.configureTestingModule({
            imports: [ToolbarComponent, HostComponent],
            providers: [
                { provide: GridService, useValue: gridServiceSpy },
                { provide: DragDropService, useValue: dragDropServiceSpy },
            ],
        }).compileComponents();

        gridService = TestBed.inject(GridService) as jasmine.SpyObj<GridService>;
        dragDropService = TestBed.inject(DragDropService) as jasmine.SpyObj<DragDropService>;
        fixture = TestBed.createComponent(ToolbarComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('getTileKeys', () => {
        it('should return all tile keys from TILE_SETTINGS', () => {
            const result = component.getTileKeys();
            expect(result.length).toBeGreaterThan(0);
            for (const key of Object.keys(TILE_SETTINGS)) {
                expect(result).toContain(key as TileType);
            }
        });
    });

    describe('getItemKeys', () => {
        it('should return item keys excluding checkpoint and empty', () => {
            const result = component.getItemKeys();
            expect(result).not.toContain('checkpoint');
            expect(result).not.toContain('empty');
            const expectedKeys = Object.keys(ITEM_SETTINGS).filter((key) => key !== 'checkpoint' && key !== 'empty' && key !== 'flag');
            for (const key of expectedKeys) {
                expect(result).toContain(key as ItemType);
            }
        });
    });

    describe('setSelectedTile', () => {
        it('should update selectedTile in gridService', () => {
            const tile: TileType = 'grass';
            component.setSelectedTile(tile);
            expect(gridService.selectedTile.set).toHaveBeenCalledWith(tile);
        });
    });

    describe('setSelectedItem', () => {
        it('should update selectedItem in gridService', () => {
            const item: ItemType = 'shield';
            component.setSelectedItem(item);
            expect(gridService.selectedItem.set).toHaveBeenCalledWith(item);
        });
    });

    describe('toggleSecondaryToolbar', () => {
        it('should open secondary toolbar if it was closed', () => {
            component.showSecondaryToolbar = null;
            component.toggleSecondaryToolbar('tiles');
            expect(component.showSecondaryToolbar as 'tiles' | 'items' | null).toBe('tiles');
        });

        it('should close secondary toolbar if it was open with the same type', () => {
            component.showSecondaryToolbar = 'tiles';
            component.toggleSecondaryToolbar('tiles');
            expect(component.showSecondaryToolbar).toBeNull();
        });

        it('should change secondary toolbar if it was open with a different type', () => {
            component.showSecondaryToolbar = 'tiles';
            component.toggleSecondaryToolbar('items');
            expect(component.showSecondaryToolbar as 'tiles' | 'items' | null).toBe('items');
        });
    });

    describe('showTileDescription and hideTileDescription', () => {
        it('should update hoveredTile', () => {
            const tile: TileType = 'grass';
            component.showTileDescription(tile);
            expect(component.hoveredTile).toBe(tile);
            component.hideTileDescription();
            expect(component.hoveredTile).toBeNull();
        });
    });

    describe('showItemDescription and hideItemDescription', () => {
        it('should update hoveredItem', () => {
            const item: ItemType = 'shield';
            component.showItemDescription(item);
            expect(component.hoveredItem).toBe(item);
            component.hideItemDescription();
            expect(component.hoveredItem).toBeNull();
        });
    });

    describe('showToolDescription and hideToolDescription', () => {
        it('should update hoveredTool', () => {
            const tool = 'save';
            component.showToolDescription(tool);
            expect(component.hoveredTool).toBe(tool);
            component.hideToolDescription();
            expect(component.hoveredTool).toBeNull();
        });
    });

    describe('onSave', () => {
        it('should emit saveClicked event', () => {
            spyOn(component.saveClicked, 'emit');
            component.onSave();
            expect(component.saveClicked.emit).toHaveBeenCalled();
        });
    });

    describe('onExit', () => {
        it('should emit exitClicked event', () => {
            spyOn(component.exitClicked, 'emit');
            component.onExit();
            expect(component.exitClicked.emit).toHaveBeenCalled();
        });
    });

    describe('onItemDragStart', () => {
        it('should not set draggedItem if item is already placed', () => {
            const event = jasmine.createSpyObj('DragEvent', ['preventDefault'], {
                dataTransfer: {
                    setData: jasmine.createSpy('setData'),
                    effectAllowed: null,
                },
            });
            const item: ItemType = 'shield';
            gridService.isItemPlaced.and.returnValue(true);
            component.onItemDragStart(event as unknown as DragEvent, item);
            expect(dragDropService.setDraggedItem).not.toHaveBeenCalled();
        });

        it('should set draggedItem if item is not placed', () => {
            const event = jasmine.createSpyObj('DragEvent', ['preventDefault'], {
                dataTransfer: {
                    setData: jasmine.createSpy('setData'),
                    effectAllowed: null,
                },
            });
            const item: ItemType = 'shield';
            gridService.isItemPlaced.and.returnValue(false);
            component.onItemDragStart(event as unknown as DragEvent, item);
            expect(event.dataTransfer.setData).toHaveBeenCalledWith('item', item);
            expect(event.dataTransfer.effectAllowed).toBe('move');
            expect(dragDropService.setDraggedItem).toHaveBeenCalledWith(item, -1, -1, true);
        });
    });

    describe('onToolbarDragOver', () => {
        it('should prevent default behavior', () => {
            const event = jasmine.createSpyObj('DragEvent', ['preventDefault']);
            component.onToolbarDragOver(event as unknown as DragEvent);
            expect(event.preventDefault).toHaveBeenCalled();
        });
    });

    describe('onToolbarDrop', () => {
        it('should do nothing when dataTransfer is not available', () => {
            const event = jasmine.createSpyObj('DragEvent', ['preventDefault'], {
                dataTransfer: null,
            });
            component.onToolbarDrop(event as unknown as DragEvent);
            expect(gridService.updateItem).not.toHaveBeenCalled();
        });

        it('should do nothing when target is not a toolbar button with matching item', () => {
            const item: ItemType = 'shield';
            const event = jasmine.createSpyObj('DragEvent', ['preventDefault'], {
                dataTransfer: {
                    getData: jasmine.createSpy('getData').and.returnValue(item),
                },
                target: document.createElement('div'),
            });
            component.onToolbarDrop(event as unknown as DragEvent);
            expect(gridService.updateItem).not.toHaveBeenCalled();
        });

        it('should update grid for regular item when dropped on matching toolbar button', () => {
            const item: ItemType = 'shield';
            const target = document.createElement('div');
            target.dataset['item'] = item;
            const event = jasmine.createSpyObj('DragEvent', ['preventDefault'], {
                dataTransfer: {
                    getData: jasmine.createSpy('getData').and.returnValue(item),
                },
                target,
            });
            dragDropService.getDraggedItem.and.returnValue({ item, x: 1, y: 2 });
            component.onToolbarDrop(event as unknown as DragEvent);
            expect(gridService.updateItem).toHaveBeenCalledWith(1, 2, 'empty');
            expect(gridService.incrementCheckpoint).not.toHaveBeenCalled();
            expect(gridService.incrementRandomItem).not.toHaveBeenCalled();
            expect(dragDropService.clearDraggedItem).toHaveBeenCalled();
        });

        it('should increment checkpoint counter when dropping checkpoint item', () => {
            const item: ItemType = 'checkpoint';
            const target = document.createElement('div');
            target.dataset['item'] = item;
            const event = jasmine.createSpyObj('DragEvent', ['preventDefault'], {
                dataTransfer: {
                    getData: jasmine.createSpy('getData').and.returnValue(item),
                },
                target,
            });
            dragDropService.getDraggedItem.and.returnValue({ item, x: 1, y: 2 });
            component.onToolbarDrop(event as unknown as DragEvent);
            expect(gridService.updateItem).toHaveBeenCalledWith(1, 2, 'empty');
            expect(gridService.incrementCheckpoint).toHaveBeenCalled();
            expect(dragDropService.clearDraggedItem).toHaveBeenCalled();
        });

        it('should increment random item counter when dropping random item', () => {
            const item: ItemType = 'random';
            const target = document.createElement('div');
            target.dataset['item'] = item;
            const event = jasmine.createSpyObj('DragEvent', ['preventDefault'], {
                dataTransfer: {
                    getData: jasmine.createSpy('getData').and.returnValue(item),
                },
                target,
            });
            dragDropService.getDraggedItem.and.returnValue({ item, x: 1, y: 2 });
            component.onToolbarDrop(event as unknown as DragEvent);
            expect(gridService.updateItem).toHaveBeenCalledWith(1, 2, 'empty');
            expect(gridService.incrementRandomItem).toHaveBeenCalled();
            expect(dragDropService.clearDraggedItem).toHaveBeenCalled();
        });
    });
});
