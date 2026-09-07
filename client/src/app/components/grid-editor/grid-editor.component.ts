import { Component, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationPopupComponent } from '@app/components/confirmation-popup/confirmation-popup.component';
import { ErrorPopupComponent } from '@app/components/error-popup/error-popup.component';
import { GridCanvasComponent } from '@app/components/grid-canvas/grid-canvas.component';
import { ToolbarComponent } from '@app/components/toolbar/toolbar.component';
import { TILE_SETTINGS } from '@app/interfaces/tile.interface';
import { DragDropService } from '@app/services/drag-drop/drag-drop.service';
import { GridService } from '@app/services/grid/grid.service';
import { LanguageService } from '@app/services/language/language.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { MapGeneratorOptions, MapGeneratorService } from '@app/services/map-generator/map-generator.service';
import { MapService } from '@app/services/maps/maps.service';
import { ITEM_SETTINGS, ItemType } from '@common/interfaces/item.interface';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';

@Component({
    standalone: true,
    selector: 'app-grid-editor',
    templateUrl: './grid-editor.component.html',
    styleUrls: ['./grid-editor.component.scss'],
    imports: [ToolbarComponent, GridCanvasComponent, FormsModule, ErrorPopupComponent, ConfirmationPopupComponent, TranslatePipe],
})
export class GridEditorComponent implements OnInit, OnDestroy {
    static readonly saveTimeout = 3000;
    static readonly quitTimeout = 300;
    static readonly nameCheckDebounce = 400;

    @ViewChild(GridCanvasComponent, { static: false }) gridCanvasComponent!: GridCanvasComponent;

    gameSavedMessage: string = '';
    showUnsavedPopup: boolean = false;
    errorMessage: string = '';
    errorPopupVisible: boolean = false;
    isSaving: boolean = false;
    quitting: boolean = false;
    nameAlreadyTaken: boolean = false;

    isDragging: boolean = false;
    isErasing: boolean = false;
    lastHandledCell: { x: number; y: number } | null = null;

    grid: string[][] = [];
    items: string[][] = [];

    showGeneratorPanel: boolean = false;
    generatorWaterPercentage: number = 10;
    generatorIcePercentage: number = 5;
    isGenerating: boolean = false;

    readonly tileSettings = TILE_SETTINGS;
    readonly itemSettings = ITEM_SETTINGS;

    protected gridService = inject(GridService);
    private dragDropService = inject(DragDropService);
    private mapGeneratorService = inject(MapGeneratorService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private mapService = inject(MapService);
    private languageService = inject(LanguageService);

    private nameCheck$ = new Subject<string>();
    private destroy$ = new Subject<void>();

    @HostListener('document:mouseup')
    onMouseUp() {
        this.isDragging = false;
        this.lastHandledCell = null;
    }

    ngOnInit(): void {
        this.nameCheck$
            .pipe(
                debounceTime(GridEditorComponent.nameCheckDebounce),
                distinctUntilChanged(),
                switchMap((name) => {
                    const excludeId = this.gridService.currentMap()?._id;
                    return this.mapService.checkNameAvailability(name, excludeId);
                }),
                takeUntil(this.destroy$),
            )
            .subscribe((result) => {
                this.nameAlreadyTaken = result.taken;
            });

        this.route.queryParams.subscribe((params) => {
            if (params['id']) {
                this.gridService.resetGridState();
                this.mapService.loadMap(params['id']).subscribe({
                    next: (map) => {
                        this.gridService.loadMap(map);
                        this.grid = map.tiles as string[][];
                        this.items = map.items as string[][];
                    },
                    error: () => {
                        throw new Error('Erreur lors du chargement de la carte.');
                    },
                });
            } else if (this.gridService.gridSize()) {
                this.grid = this.gridService.grid();
                this.items = this.gridService.items();
            }
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    onNameChange(name: string): void {
        this.nameCheck$.next(name);
    }

    handleCellMouseDown({ event, x, y }: { event: MouseEvent; x: number; y: number }) {
        this.isDragging = true;
        this.isErasing = event.button === 2;
        this.lastHandledCell = { x, y };
        this.handleCellAction(x, y, this.isErasing);
    }

    handleCellMouseEnter({ x, y }: { x: number; y: number }) {
        if (this.isDragging && (!this.lastHandledCell || this.lastHandledCell.x !== x || this.lastHandledCell.y !== y)) {
            this.lastHandledCell = { x, y };
            this.handleCellAction(x, y, this.isErasing);
        }
    }

    handleItemMouseDown(event: MouseEvent) {
        event.stopPropagation();
    }

    handleGridItemDragStart({ event, item, x, y }: { event: DragEvent; item: string; x: number; y: number }) {
        const typedItem = item as ItemType;
        if (event.dataTransfer) {
            event.dataTransfer.setData('item', typedItem);
            event.dataTransfer.effectAllowed = 'move';
            this.dragDropService.setDraggedItem(typedItem, x, y);
        }
    }

    handleDragOver(event: DragEvent) {
        event.preventDefault();
    }

    handleCellDrop({ event, x, y }: { event: DragEvent; x: number; y: number }) {
        event.preventDefault();
        if (event.dataTransfer) {
            const item = event.dataTransfer.getData('item') as ItemType;
            const tile = this.gridService.grid()[y][x];
            if (this.isTileBlocked(tile, x, y)) {
                return;
            }
            const draggedItem = this.dragDropService.getDraggedItem();
            if (item === 'checkpoint' && this.dragDropService.isDragFromToolbar()) {
                if (this.gridService.checkpointsRemaining() > 0) {
                    this.gridService.updateItem(x, y, item);
                    this.gridService.decrementCheckpoint();
                } else {
                    return;
                }
            } else if (item === 'random' && this.dragDropService.isDragFromToolbar()) {
                if (this.gridService.randomItemsRemaining() > 0 && !this.gridService.reachedMaxItems()) {
                    this.gridService.updateItem(x, y, item);
                    this.gridService.decrementRandomItem();
                } else {
                    return;
                }
            } else if (this.gridService.reachedMaxItems() && this.dragDropService.isDragFromToolbar()) {
                return;
            }
            if (draggedItem && draggedItem.x !== -1 && draggedItem.y !== -1) {
                this.gridService.updateItem(draggedItem.x, draggedItem.y, 'empty');
            }
            this.gridService.updateItem(x, y, item);
            this.dragDropService.clearDraggedItem();
        }
    }

    handleDeleteItem({ event, x, y }: { event: MouseEvent; x: number; y: number }) {
        if (event.button === 2) {
            event.preventDefault();
            const item = this.gridService.items()[y][x];
            if (item === 'checkpoint') {
                this.gridService.incrementCheckpoint();
            } else if (item === 'random') {
                this.gridService.incrementRandomItem();
            }
            this.gridService.updateItem(x, y, 'empty');
        }
    }

    async onSave(form: NgForm): Promise<void> {
        if (!form.valid) {
            form.control.markAllAsTouched();
            return;
        }
        if (this.nameAlreadyTaken) {
            this.errorMessage = this.languageService.translate('gridEditorFeedback.nameTaken');
            this.errorPopupVisible = true;
            return;
        }
        if (this.isSaving) {
            return;
        }
        this.isSaving = true;

        let screenshotUrl = '';
        if (this.gridCanvasComponent && this.gridCanvasComponent.gridContainer) {
            screenshotUrl = await this.gridService.takeScreenshot(this.gridCanvasComponent.gridContainer.nativeElement);
        }

        this.gridService.saveState(screenshotUrl).subscribe({
            next: () => {
                this.isSaving = false;
                this.gameSavedMessage = this.languageService.translate('gridEditorFeedback.mapSaved');
                setTimeout(() => {
                    this.gameSavedMessage = '';
                }, GridEditorComponent.saveTimeout);
                this.quit();
            },
            error: (err: Error) => {
                this.isSaving = false;
                this.errorMessage = this.getFriendlyErrorMessage(err.message);
                this.errorPopupVisible = true;
            },
        });
    }

    onErrorPopupClosed() {
        this.errorPopupVisible = false;
    }

    onExit(): void {
        if (this.gridService.isDirty()) {
            this.showUnsavedPopup = true;
        } else {
            this.quit();
        }
    }

    onConfirmExit(response: boolean): void {
        this.showUnsavedPopup = false;
        if (response) {
            this.quit();
        }
    }

    toggleGeneratorPanel(): void {
        this.showGeneratorPanel = !this.showGeneratorPanel;
    }

    generateMap(): void {
        this.isGenerating = true;
        const options: MapGeneratorOptions = {
            size: this.gridService.gridSize(),
            gameMode: this.gridService.gameMode(),
            waterPercentage: this.generatorWaterPercentage,
            icePercentage: this.generatorIcePercentage,
        };

        try {
            const result = this.mapGeneratorService.generate(options);
            this.gridService.applyGeneratedGrid(result.tiles, result.items);
            this.grid = this.gridService.grid();
            this.items = this.gridService.items();
            this.showGeneratorPanel = false;
        } catch {
            this.errorMessage = this.languageService.translate('gridEditorFeedback.generationFailed');
            this.errorPopupVisible = true;
        } finally {
            this.isGenerating = false;
        }
    }

    private handleCellAction(x: number, y: number, isErase: boolean) {
        const currentTile = this.gridService.grid()[y][x];
        const selectedTile = this.gridService.selectedTile();
        const onTileItem = this.gridService.items()[y][x];
        if ((selectedTile === 'doorClose' || selectedTile === 'wall') && onTileItem !== 'empty') {
            return;
        }
        if (isErase) {
            this.gridService.updateCell(x, y, 'grass');
            return;
        }
        if ((currentTile === 'doorClose' || currentTile === 'doorOpen') && selectedTile === 'doorClose') {
            const newTileType = currentTile === 'doorClose' ? 'doorOpen' : 'doorClose';
            this.gridService.updateCell(x, y, newTileType);
            this.gridService.updateItem(x, y, onTileItem);
            return;
        }
        this.gridService.updateCell(x, y, selectedTile);
        this.gridService.updateItem(x, y, onTileItem);
    }

    private isTileBlocked(tile: string, x: number, y: number): boolean {
        return (
            tile === 'doorClose' ||
            tile === 'doorOpen' ||
            tile === 'wall' ||
            (this.gridService.items()[y][x] && this.gridService.items()[y][x] !== 'empty')
        );
    }

    private quit(): void {
        setTimeout(() => {
            this.router.navigate(['/admin']);
        }, GridEditorComponent.quitTimeout);
    }

    private getFriendlyErrorMessage(rawMessage: string): string {
        const errorMapping: { [key: string]: string } = {
            nameNotBlank: this.languageService.translate('gridEditorFeedback.validationErrors.nameNotBlank'),
            descriptionNotBlank: this.languageService.translate('gridEditorFeedback.validationErrors.descriptionNotBlank'),
            terrainTilePercentage: this.languageService.translate('gridEditorFeedback.validationErrors.terrainTilePercentage'),
            terrainTileAccessibility: this.languageService.translate('gridEditorFeedback.validationErrors.terrainTileAccessibility'),
            doorTileAdjacency: this.languageService.translate('gridEditorFeedback.validationErrors.doorTileAdjacency'),
            missingCheckpoint: this.languageService.translate('gridEditorFeedback.validationErrors.missingCheckpoint'),
            missingItems: this.languageService.translate('gridEditorFeedback.validationErrors.missingItems'),
            missingFlag: this.languageService.translate('gridEditorFeedback.validationErrors.missingFlag'),
            duplicateName: this.languageService.translate('gridEditorFeedback.validationErrors.duplicateName'),
        };

        const keys = rawMessage.split(',').map((key) => key.trim());
        const errorHeader = this.languageService.translate('gridEditorFeedback.validationError');
        return errorHeader + '\n\n' + keys.map((key, index) => `${index + 1}. ${errorMapping[key] || key}`).join('\n');
    }
}
