import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TileType } from '@app/interfaces/tile.interface';
import { DragDropService } from '@app/services/drag-drop/drag-drop.service';
import { GridService } from '@app/services/grid/grid.service';
import { MapService } from '@app/services/maps/maps.service';
import { ItemType } from '@common/interfaces/item.interface';
import { of } from 'rxjs';
import { GridEditorComponent } from './grid-editor.component';

describe('GridEditorComponent without id', () => {
    let component: GridEditorComponent;
    let fixture: ComponentFixture<GridEditorComponent>;
    let gridService: jasmine.SpyObj<GridService>;

    beforeEach(() => {
        const fakeTiles: TileType[][] = [['grass']];
        const fakeItems: ItemType[][] = [['empty']];

        const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        const mapServiceSpy = jasmine.createSpyObj('MapService', ['loadMap']);
        const dragDropService = jasmine.createSpyObj('DragDropService', ['setDraggedItem', 'isDragFromToolbar', 'getDraggedItem']);
        gridService = jasmine.createSpyObj('GridService', [
            'gridSize',
            'grid',
            'items',
            'checkpointsRemaining',
            'gameMode',
            'reachedMaxItems',
            'updateItem',
        ]);
        gridService.gridSize.and.returnValue(1);
        gridService.grid.and.returnValue(fakeTiles);
        gridService.items.and.returnValue(fakeItems);
        gridService.gameMode.and.returnValue('classic');

        TestBed.configureTestingModule({
            imports: [GridEditorComponent],
            providers: [
                { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
                { provide: Router, useValue: routerSpy },
                { provide: MapService, useValue: mapServiceSpy },
                { provide: DragDropService, useValue: dragDropService },
                { provide: GridService, useValue: gridService },
            ],
        });

        fixture = TestBed.createComponent(GridEditorComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should load grid and items from gridService if no id is provided but gridSize exists', () => {
        expect(component.grid).toEqual([['grass']]);
        expect(component.items).toEqual([['empty']]);
    });

    it('should return early if reachedMaxItems is true and isDragFromToolbar is true', () => {
        gridService.reachedMaxItems.and.returnValue(true);
        const localDragDropService = TestBed.inject(DragDropService) as jasmine.SpyObj<DragDropService>;
        localDragDropService.isDragFromToolbar.and.returnValue(true);

        const mockDragEvent = {
            preventDefault: jasmine.createSpy('preventDefault'),
            dataTransfer: {
                getData: jasmine.createSpy('getData').and.returnValue('wall'),
            },
        } as any as DragEvent;

        spyOn<any>(component, 'isTileBlocked').and.returnValue(false);

        component.handleCellDrop({ event: mockDragEvent, x: 0, y: 0 });

        expect(gridService.updateItem).not.toHaveBeenCalled();
    });
});
