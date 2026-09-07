import { Component, EventEmitter, Output, inject } from '@angular/core';
import { TILE_SETTINGS, TileType } from '@app/interfaces/tile.interface';
import { DragDropService } from '@app/services/drag-drop/drag-drop.service';
import { GridService } from '@app/services/grid/grid.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { ITEM_SETTINGS, ItemType } from '@common/interfaces/item.interface';

@Component({
    standalone: true,
    selector: 'app-toolbar',
    imports: [TranslatePipe],
    templateUrl: './toolbar.component.html',
    styleUrls: ['./toolbar.component.scss'],
})
export class ToolbarComponent {
    @Output() saveClicked = new EventEmitter<void>();
    @Output() exitClicked = new EventEmitter<void>();
    @Output() generateClicked = new EventEmitter<void>();
    gridService = inject(GridService);
    dragDropService = inject(DragDropService);

    readonly tileSettings = TILE_SETTINGS;
    readonly itemSettings = ITEM_SETTINGS;
    hoveredTile: TileType | null = null;
    hoveredItem: ItemType | null = null;
    hoveredTool: string | null = null;
    showSecondaryToolbar: 'tiles' | 'items' | null = null;

    getTileKeys(): TileType[] {
        return Object.keys(TILE_SETTINGS) as TileType[];
    }

    getItemKeys(): ItemType[] {
        return (Object.keys(ITEM_SETTINGS) as ItemType[]).filter(
            (item): item is Exclude<ItemType, 'checkpoint' | 'empty' | 'flag' | 'hidden_checkpoint'> =>
                item !== 'checkpoint' && item !== 'empty' && item !== 'flag' && item !== 'hidden_checkpoint',
        );
    }

    isCTFMode(): boolean {
        return this.gridService.gameMode() === 'CTF';
    }

    setSelectedTile(tile: TileType) {
        this.gridService.selectedTile.set(tile);
    }

    setSelectedItem(item: ItemType) {
        this.gridService.selectedItem.set(item);
    }

    toggleSecondaryToolbar(type: 'tiles' | 'items') {
        this.showSecondaryToolbar = this.showSecondaryToolbar === type ? null : type;
    }

    showTileDescription(tile: TileType) {
        this.hoveredTile = tile;
    }

    hideTileDescription() {
        this.hoveredTile = null;
    }

    showItemDescription(item: ItemType) {
        this.hoveredItem = item;
    }

    hideItemDescription() {
        this.hoveredItem = null;
    }

    showToolDescription(tool: string) {
        this.hoveredTool = tool;
    }

    hideToolDescription() {
        this.hoveredTool = null;
    }

    onSave(): void {
        this.saveClicked.emit();
    }

    onExit() {
        this.exitClicked.emit();
    }

    onGenerate(): void {
        this.generateClicked.emit();
    }

    onItemDragStart(event: DragEvent, item: ItemType) {
        if (this.gridService.isItemPlaced(item)) {
            return;
        }
        if (event.dataTransfer) {
            event.dataTransfer.setData('item', item);
            event.dataTransfer.effectAllowed = 'move';
            this.dragDropService.setDraggedItem(item, -1, -1, true);
        }
    }

    onToolbarDragOver(event: DragEvent): void {
        event.preventDefault();
    }

    onToolbarDrop(event: DragEvent): void {
        event.preventDefault();
        if (!event.dataTransfer) {
            return;
        }
        const item = event.dataTransfer.getData('item') as ItemType;
        const draggedItem = this.dragDropService.getDraggedItem();
        const target = event.target as HTMLElement;
        const toolbarButton = target.closest('[data-item]') as HTMLElement;
        if (toolbarButton && toolbarButton.dataset['item'] === item) {
            if (draggedItem && draggedItem.x !== -1 && draggedItem.y !== -1) {
                this.gridService.updateItem(draggedItem.x, draggedItem.y, 'empty');
                if (item === 'checkpoint') {
                    this.gridService.incrementCheckpoint();
                } else if (item === 'random') {
                    this.gridService.incrementRandomItem();
                }
            }
            this.dragDropService.clearDraggedItem();
        }
    }
}
