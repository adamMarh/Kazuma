import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { GRID_CONTAINER_SIZE, TEN_CONSTANT } from '@app/constants/grid';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { Player } from '@common/interfaces/player.interface';

@Component({
    standalone: true,
    selector: 'app-grid-canvas',
    templateUrl: './grid-canvas.component.html',
    styleUrls: ['./grid-canvas.component.scss'],
    imports: [TranslatePipe],
})
export class GridCanvasComponent {
    @ViewChild('gridContainer', { static: false }) gridContainer!: ElementRef;

    @Input() grid: string[][] = [];
    @Input() items: string[][] = [];
    @Input() size!: number;
    @Input() gridContainerSize: number = GRID_CONTAINER_SIZE;
    @Input() tileSettings: { [key: string]: any } = {};
    @Input() itemSettings: { [key: string]: any } = {};

    @Input() showPlayers: boolean = false;
    @Input() players: Player[] = [];
    @Input() possibleMovements: { x: number; y: number }[] = [];
    @Input() shortestPath: { x: number; y: number }[] = [];
    @Output() movePlayer = new EventEmitter<{ x: number; y: number }>();
    @Output() showPath = new EventEmitter<{ x: number; y: number }>();
    @Output() invalidMove = new EventEmitter<void>();
    @Output() attackPlayer = new EventEmitter<{ playerId: string }>();

    @Output() cellMouseDown = new EventEmitter<{ event: MouseEvent; x: number; y: number }>();
    @Output() cellMouseEnter = new EventEmitter<{ x: number; y: number }>();
    @Output() dragOver = new EventEmitter<DragEvent>();
    @Output() cellDrop = new EventEmitter<{ event: DragEvent; x: number; y: number }>();
    @Output() gridItemDragStart = new EventEmitter<{ event: DragEvent; item: string; x: number; y: number }>();
    @Output() deleteItem = new EventEmitter<{ event: MouseEvent; x: number; y: number }>();
    @Output() itemMouseDown = new EventEmitter<MouseEvent>();

    hoveredItem: string | null = null;
    tooltipPosition = { x: 0, y: 0 };

    get tileSize(): number {
        return this.gridContainerSize / this.size;
    }

    onCellMouseDown(event: MouseEvent, x: number, y: number) {
        this.cellMouseDown.emit({ event, x, y });
    }

    onCellMouseEnter(x: number, y: number) {
        this.cellMouseEnter.emit({ x, y });
    }

    onDragOver(event: DragEvent) {
        this.dragOver.emit(event);
        this.hoveredItem = null;
    }

    onDrop(event: DragEvent, x: number, y: number) {
        this.cellDrop.emit({ event, x, y });
    }

    onGridItemDragStart(event: DragEvent, item: string, x: number, y: number) {
        this.gridItemDragStart.emit({ event, item, x, y });
    }

    onDeleteItem(event: MouseEvent, x: number, y: number) {
        this.deleteItem.emit({ event, x, y });
    }

    onItemMouseDown(event: MouseEvent) {
        this.itemMouseDown.emit(event);
    }

    isPossibleMovement(x: number, y: number): boolean {
        return this.possibleMovements?.some((move) => move.x === x && move.y === y) ?? false;
    }

    isPossiblePath(x: number, y: number): boolean {
        return this.shortestPath?.some((move) => move.x === x && move.y === y) ?? false;
    }

    showItemTooltip(item: string, event: MouseEvent): void {
        this.hoveredItem = item;
        const target = event.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const tooltipWidth = 180;
        const tooltipHeight = 80;
        let x = rect.left + rect.width / 2 - tooltipWidth / 2;
        let y = rect.top - tooltipHeight - TEN_CONSTANT;
        const windowWidth = window.innerWidth;
        if (x < TEN_CONSTANT) x = TEN_CONSTANT;
        if (x + tooltipWidth > windowWidth - TEN_CONSTANT) x = windowWidth - tooltipWidth - TEN_CONSTANT;
        if (y < TEN_CONSTANT) {
            y = rect.bottom + TEN_CONSTANT;
        }
        this.tooltipPosition = { x, y };
    }

    hideItemTooltip(): void {
        this.hoveredItem = null;
    }
}
