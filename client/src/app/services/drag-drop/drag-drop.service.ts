import { Injectable } from '@angular/core';
import { ItemType } from '@common/interfaces/item.interface';

@Injectable({ providedIn: 'root' })
export class DragDropService {
    private draggedItem: { item: ItemType; x: number; y: number } | null = null;
    private isDraggingItem = false;
    private isFromToolbar = false;
    private isDraggableItem = false;

    setDraggedItem(item: ItemType, x: number, y: number, isFromToolbar: boolean = false) {
        this.draggedItem = { item, x, y };
        this.isDraggingItem = true;
        this.isFromToolbar = isFromToolbar;
    }

    getDraggedItem() {
        return this.draggedItem;
    }

    clearDraggedItem() {
        this.draggedItem = null;
        this.isDraggingItem = false;
        this.isFromToolbar = false;
    }

    isDragging(): boolean {
        return this.isDraggingItem;
    }

    isDragFromToolbar(): boolean {
        return this.isFromToolbar;
    }

    isDraggable(): boolean {
        return this.isDraggableItem;
    }

    setDraggable(isDraggable: boolean) {
        this.isDraggableItem = isDraggable;
    }
}
