/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines */
import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FIVE_MOVEMENT, FOUR_MOVEMENT, GRID_CONTAINER_SIZE, GRID_SIZE_TEST, ONE_MOVEMENT, THREE_MOVEMENT, TWO_MOVEMENT } from '@app/constants/grid';
import { GridCanvasComponent } from './grid-canvas.component';

describe('GridCanvasComponent', () => {
    let component: GridCanvasComponent;
    let fixture: ComponentFixture<GridCanvasComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CommonModule, GridCanvasComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(GridCanvasComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create the component', () => {
        expect(component).toBeTruthy();
    });

    it('should calculate tile size correctly', () => {
        component.size = 10;
        component.gridContainerSize = GRID_CONTAINER_SIZE;
        expect(component.tileSize).toBe(GRID_SIZE_TEST);
    });

    it('should emit event on cell mouse down', () => {
        spyOn(component.cellMouseDown, 'emit');
        const event = new MouseEvent('mousedown');

        component.onCellMouseDown(event, TWO_MOVEMENT, THREE_MOVEMENT);

        expect(component.cellMouseDown.emit).toHaveBeenCalledWith({ event, x: 2, y: 3 });
    });

    it('should emit event on cell mouse enter', () => {
        spyOn(component.cellMouseEnter, 'emit');

        component.onCellMouseEnter(FIVE_MOVEMENT, FIVE_MOVEMENT);

        expect(component.cellMouseEnter.emit).toHaveBeenCalledWith({ x: 5, y: 5 });
    });

    it('should emit event on drag over', () => {
        spyOn(component.dragOver, 'emit');
        const event = new DragEvent('dragover');

        component.onDragOver(event);

        expect(component.dragOver.emit).toHaveBeenCalledWith(event);
    });

    it('should emit event on drop', () => {
        spyOn(component.cellDrop, 'emit');
        const event = new DragEvent('drop');

        component.onDrop(event, ONE_MOVEMENT, FOUR_MOVEMENT);

        expect(component.cellDrop.emit).toHaveBeenCalledWith({ event, x: 1, y: 4 });
    });

    it('should emit event on grid item drag start', () => {
        spyOn(component.gridItemDragStart, 'emit');
        const event = new DragEvent('dragstart');

        component.onGridItemDragStart(event, 'wall', TWO_MOVEMENT, THREE_MOVEMENT);

        expect(component.gridItemDragStart.emit).toHaveBeenCalledWith({ event, item: 'wall', x: 2, y: 3 });
    });

    it('should emit event on deleting an item', () => {
        spyOn(component.deleteItem, 'emit');
        const event = new MouseEvent('mousedown', { button: 2 });

        component.onDeleteItem(event, THREE_MOVEMENT, THREE_MOVEMENT);

        expect(component.deleteItem.emit).toHaveBeenCalledWith({ event, x: 3, y: 3 });
    });

    it('should return true if the movement is possible', () => {
        component.possibleMovements = [
            { x: 2, y: 3 },
            { x: 4, y: 5 },
        ];

        expect(component.isPossibleMovement(TWO_MOVEMENT, THREE_MOVEMENT)).toBeTrue();
        expect(component.isPossibleMovement(FOUR_MOVEMENT, FIVE_MOVEMENT)).toBeTrue();
    });

    it('should return false if the movement is not possible', () => {
        component.possibleMovements = [{ x: 1, y: 1 }];

        expect(component.isPossibleMovement(THREE_MOVEMENT, THREE_MOVEMENT)).toBeFalse();
    });

    it('should return true if the path is possible', () => {
        component.shortestPath = [
            { x: 1, y: 2 },
            { x: 3, y: 4 },
        ];

        expect(component.isPossiblePath(ONE_MOVEMENT, TWO_MOVEMENT)).toBeTrue();
        expect(component.isPossiblePath(THREE_MOVEMENT, FOUR_MOVEMENT)).toBeTrue();
    });

    it('should return false if the path is not possible', () => {
        component.shortestPath = [{ x: 2, y: 2 }];

        expect(component.isPossiblePath(FOUR_MOVEMENT, FIVE_MOVEMENT)).toBeFalse();
    });

    it('should return false if shortestPath is empty', () => {
        component.shortestPath = [];

        expect(component.isPossiblePath(THREE_MOVEMENT, THREE_MOVEMENT)).toBeFalse();
    });

    it('should emit event on item mouse down', () => {
        spyOn(component.itemMouseDown, 'emit');
        const event = new MouseEvent('mousedown');

        component.onItemMouseDown(event);

        expect(component.itemMouseDown.emit).toHaveBeenCalledWith(event);
    });

    it('should return false if possibleMovements is undefined', () => {
        component.possibleMovements = undefined as any;
        expect(component.isPossibleMovement(TWO_MOVEMENT, THREE_MOVEMENT)).toBeFalse();
    });

    it('should return false if shortestPath is undefined', () => {
        component.shortestPath = undefined as any;
        expect(component.isPossiblePath(FOUR_MOVEMENT, FIVE_MOVEMENT)).toBeFalse();
    });
    it('should show tooltip with default position (no boundary collisions)', () => {
        spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1000);

        const rect = {
            left: 300,
            top: 400,
            width: 50,
            height: 50,
            bottom: 450,
        } as DOMRect;

        const mockEvent = new MouseEvent('mousemove');
        Object.defineProperty(mockEvent, 'currentTarget', {
            value: {
                getBoundingClientRect: () => rect,
            },
        });

        component.showItemTooltip('testItem', mockEvent);
        expect(component.hoveredItem).toBe('testItem');

        expect(component.tooltipPosition.x).toBe(235);
        expect(component.tooltipPosition.y).toBe(310);
    });

    it('should adjust x if x < 10', () => {
        spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1000);

        const rect = {
            left: 0,
            top: 200,
            width: 50,
            height: 50,
            bottom: 250,
        } as DOMRect;

        const mockEvent = new MouseEvent('mousemove');
        Object.defineProperty(mockEvent, 'currentTarget', {
            value: {
                getBoundingClientRect: () => rect,
            },
        });

        component.showItemTooltip('adjustLeft', mockEvent);
        expect(component.tooltipPosition.x).toBe(10);
        expect(component.hoveredItem).toBe('adjustLeft');
    });

    it('should adjust x if x + tooltipWidth > windowWidth - 10', () => {
        spyOnProperty(window, 'innerWidth', 'get').and.returnValue(500);

        const rect = {
            left: 490,
            top: 200,
            width: 30,
            height: 50,
            bottom: 250,
        } as DOMRect;

        const mockEvent = new MouseEvent('mousemove');
        Object.defineProperty(mockEvent, 'currentTarget', {
            value: {
                getBoundingClientRect: () => rect,
            },
        });

        component.showItemTooltip('adjustRight', mockEvent);
        expect(component.tooltipPosition.x).toBe(310);
        expect(component.hoveredItem).toBe('adjustRight');
    });

    it('should adjust y if y < 10', () => {
        spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1000);
        const rect = {
            left: 200,
            top: 5,
            width: 50,
            height: 50,
            bottom: 55,
        } as DOMRect;

        const mockEvent = new MouseEvent('mousemove');
        Object.defineProperty(mockEvent, 'currentTarget', {
            value: {
                getBoundingClientRect: () => rect,
            },
        });

        component.showItemTooltip('adjustY', mockEvent);
        expect(component.tooltipPosition.y).toBe(65);
        expect(component.hoveredItem).toBe('adjustY');
    });

    it('should hide tooltip by setting hoveredItem to null', () => {
        component.hoveredItem = 'someItem';
        component.hideItemTooltip();
        expect(component.hoveredItem).toBeNull();
    });
});
