import { TestBed } from '@angular/core/testing';
import { DragDropService } from './drag-drop.service';

describe('DragDropService', () => {
    let service: DragDropService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(DragDropService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should set and get dragged item', () => {
        service.setDraggedItem('checkpoint', 1, 1);
        expect(service.getDraggedItem()).toEqual({ item: 'checkpoint', x: 1, y: 1 });
    });

    it('should clear dragged item, isDragging and isFromToolbar', () => {
        service.setDraggedItem('checkpoint', 1, 1, true);
        service.clearDraggedItem();
        expect(service.getDraggedItem()).toBeNull();
        expect(service.isDragging()).toBeFalse();
        expect(service.isDragFromToolbar()).toBeFalse();
    });

    it('should return false by default for isDraggable', () => {
        expect(service.isDraggable()).toBeFalse();
    });

    it('should update isDraggableItem when setDraggable is called', () => {
        service.setDraggable(true);
        expect(service.isDraggable()).toBeTrue();

        service.setDraggable(false);
        expect(service.isDraggable()).toBeFalse();
    });
});
