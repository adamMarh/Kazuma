import { inject, Injectable, signal } from '@angular/core';
import {
    DEFAULT_RESOLUTION,
    GRID_SIZES,
    LARGE_SIZE,
    LARGE_SIZE_ITEMS_FLAGS,
    LOW_RESOLUTION,
    MEDIUM_SIZE,
    MEDIUM_SIZE_ITEMS_FLAGS,
    SMALL_SIZE,
    SMALL_SIZE_ITEMS_FLAGS,
} from '@app/constants/grid';
import { GameMap } from '@app/interfaces/game-map.interface';
import { TileType } from '@app/interfaces/tile.interface';
import { MapService } from '@app/services/maps/maps.service';
import { ItemType } from '@common/interfaces/item.interface';
import html2canvas from 'html2canvas';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class GridService {
    private static readonly namePlaceholder = 'NAME_PLACEHOLDER';
    private originalGrid: TileType[][] = [];
    private originalItems: ItemType[][] = [];
    private originalGameName: string = '';
    private originalGameDescription: string = '';
    private mapService = inject(MapService);
    private maxFlagsAndRandoms: number;

    private state = {
        gridSize: signal<number>(0),
        grid: signal<TileType[][]>([]),
        items: signal<ItemType[][]>([]),
        selectedTile: signal<TileType>('grass'),
        selectedItem: signal<ItemType | null>(null),
        gameName: signal<string>(''),
        gameDescription: signal<string>(''),
        gameMode: signal<string>('Classic'),
        currentMap: signal<GameMap | null>(null),
        itemCount: signal<number>(0),
        nbCheckpoints: signal<number>(0),
        nbRandomItems: signal<number>(0),
        actionPoints: signal<number>(1),
    };

    get gridSize() {
        return this.state.gridSize;
    }
    get grid() {
        return this.state.grid;
    }
    get items() {
        return this.state.items;
    }
    get selectedTile() {
        return this.state.selectedTile;
    }
    get selectedItem() {
        return this.state.selectedItem;
    }
    get gameName() {
        return this.state.gameName;
    }
    get gameDescription() {
        return this.state.gameDescription;
    }
    get gameMode() {
        return this.state.gameMode;
    }
    get currentMap() {
        return this.state.currentMap;
    }
    get itemCount() {
        return this.state.itemCount;
    }
    get checkpointsRemaining() {
        return this.state.nbCheckpoints;
    }
    get randomItemsRemaining() {
        return this.state.nbRandomItems;
    }
    get actionPoints() {
        return this.state.actionPoints;
    }

    initializeGrid(size: number, gameMode: string): void {
        this.state.gridSize.set(size);
        this.state.grid.set(Array.from({ length: size }, () => Array(size).fill('grass')));
        this.state.items.set(Array.from({ length: size }, () => Array(size).fill('empty')));
        this.state.gameName.set('');
        this.state.gameDescription.set('');
        this.state.gameMode.set(gameMode);
        this.state.currentMap.set(null);
        this.state.itemCount.set(0);
        this.state.actionPoints.set(1);
        this.setCounters(size);
        this.setMaxFlagsAndRandoms(size);
        this.setOriginalState(this.state.grid(), this.state.items(), GridService.namePlaceholder, '');
    }
    loadMap(map: GameMap): void {
        this.state.currentMap.set(map);
        const size = parseInt(map.size, 10) as typeof GRID_SIZES.small | typeof GRID_SIZES.medium | typeof GRID_SIZES.large;
        this.state.gridSize.set(size);
        this.state.grid.set(map.tiles as TileType[][]);
        this.state.items.set(map.items as ItemType[][]);
        this.state.gameName.set(map.name);
        this.state.gameDescription.set(map.description);
        this.state.gameMode.set(map.gameMode);
        const initialCount = map.items.reduce((acc, row) => acc.concat(row), []).filter((item: string) => this.isItem(item)).length;
        this.state.itemCount.set(initialCount);
        this.state.nbCheckpoints.set(parseInt(map.nbCheckpoints, 10) || 0);
        this.state.nbRandomItems.set(parseInt(map.nbRandomItems, 10) || 0);
        this.state.actionPoints.set(map.actionPoints || 1);
        this.setOriginalState(map.tiles as TileType[][], map.items as ItemType[][], map.name, map.description);
        this.setMaxFlagsAndRandoms(size);
    }

    updateCell(x: number, y: number, type: TileType): void {
        this.state.grid.update((current) => {
            const newGrid = current.map((row) => [...row]);
            newGrid[y][x] = type;
            return newGrid;
        });
    }

    updateItem(x: number, y: number, item: ItemType) {
        const previousItem = this.state.items()[y][x];
        this.state.items.update((current) => {
            const newItems = current.map((row) => [...row]);
            newItems[y][x] = item;
            return newItems;
        });
        if (this.isItem(item) && previousItem === 'empty') {
            this.state.itemCount.update((v) => v + 1);
        } else if (item === 'empty' && this.isItem(previousItem)) {
            this.state.itemCount.update((v) => v - 1);
        }
    }

    isItemPlaced(item: ItemType): boolean {
        if (item === 'checkpoint' || item === 'random' || item === 'hidden_checkpoint') {
            return false;
        }
        return this.state.items().some((row) => row.includes(item));
    }

    reachedMaxItems(): boolean {
        const size = this.state.gridSize();
        let maxItems: number;
        if (size <= SMALL_SIZE) {
            maxItems = 2;
        } else if (size <= MEDIUM_SIZE) {
            maxItems = 4;
        } else {
            maxItems = 6;
        }
        return this.state.itemCount() >= maxItems;
    }

    saveState(screeShotUrl: string): Observable<GameMap> {
        const currentMap = this.state.currentMap();
        const game: GameMap = {
            ...(currentMap?._id && { _id: currentMap._id }),
            name: this.state.gameName(),
            size: this.state.gridSize().toString(),
            tiles: this.state.grid(),
            items: this.state.items(),
            gameMode: this.state.gameMode(),
            description: this.state.gameDescription(),
            imageUrl: screeShotUrl,
            lastSave: new Date(),
            visibility: currentMap?.visibility || 'private',
            owner: currentMap?.owner || '',
            nbCheckpoints: this.state.nbCheckpoints().toString(),
            nbRandomItems: this.state.nbRandomItems().toString(),
            actionPoints: this.state.actionPoints(),
        };
        const apiCall$ = game._id ? this.mapService.updateMap(game._id, game) : this.mapService.saveMap(game);
        return apiCall$.pipe(
            tap(() => {
                this.setOriginalState(this.state.grid(), this.state.items(), this.state.gameName(), this.state.gameDescription());
            }),
            catchError((err) => {
                const errorMsg = err.error?.message || err.message;
                return throwError(() => new Error(errorMsg));
            }),
        );
    }

    async takeScreenshot(element: HTMLElement): Promise<string> {
        const size = this.state.gridSize();
        let resolution = DEFAULT_RESOLUTION;
        if (size > SMALL_SIZE) {
            resolution = size === MEDIUM_SIZE ? DEFAULT_RESOLUTION : LOW_RESOLUTION;
        }
        const canvas = await html2canvas(element, { logging: false, scale: 1 });
        return canvas.toDataURL('image/jpeg', resolution);
    }

    clearGrid() {
        const shouldRestoreOriginal = this.currentMap() && this.isDirty();
        if (shouldRestoreOriginal) {
            const currentMap = this.currentMap();
            if (currentMap) {
                this.loadMap(currentMap);
            }
        } else if (!this.state.currentMap()) {
            const size = this.state.gridSize();
            this.state.grid.set(Array.from({ length: size }, () => Array(size).fill('grass')));
            this.state.items.set(Array.from({ length: size }, () => Array(size).fill('empty')));
            this.state.gameName.set('');
            this.state.gameDescription.set('');
            this.resetCounters();
            this.state.itemCount.set(0);
        }
    }

    decrementCheckpoint() {
        if (this.state.nbCheckpoints() > 0) {
            this.state.nbCheckpoints.update((value) => value - 1);
        }
    }

    decrementRandomItem() {
        if (this.state.nbRandomItems() > 0) {
            this.state.nbRandomItems.update((value) => value - 1);
        }
    }
    incrementCheckpoint() {
        if (this.state.nbCheckpoints() < this.maxFlagsAndRandoms) {
            this.state.nbCheckpoints.update((value) => value + 1);
        }
    }
    incrementRandomItem() {
        if (this.state.nbRandomItems() < this.maxFlagsAndRandoms) {
            this.state.nbRandomItems.update((value) => value + 1);
        }
    }
    isDirty(): boolean {
        return (
            this.state.gameName() !== this.originalGameName ||
            this.state.gameDescription() !== this.originalGameDescription ||
            JSON.stringify(this.state.grid()) !== JSON.stringify(this.originalGrid) ||
            JSON.stringify(this.state.items()) !== JSON.stringify(this.originalItems)
        );
    }

    resetCounters() {
        const size = this.state.gridSize();
        this.setCounters(size);
    }

    applyGeneratedGrid(tiles: TileType[][], items: ItemType[][]): void {
        this.state.grid.set(tiles.map((row) => [...row]));
        this.state.items.set(items.map((row) => [...row]));
        // Recount items
        const itemCount = items.reduce((acc, row) => acc + row.filter((item) => this.isItem(item)).length, 0);
        this.state.itemCount.set(itemCount);
        // Reset and decrement counters for placed checkpoints/random items
        const size = this.state.gridSize();
        this.setCounters(size);
        for (const row of items) {
            for (const item of row) {
                if (item === 'checkpoint') {
                    this.state.nbCheckpoints.update((v) => v - 1);
                } else if (item === 'random') {
                    this.state.nbRandomItems.update((v) => v - 1);
                }
            }
        }
    }

    resetGridState(): void {
        this.state.gridSize.set(0);
        this.state.grid.set([]);
        this.state.items.set([]);
        this.state.gameName.set('');
        this.state.gameDescription.set('');
        this.state.gameMode.set('');
        this.state.currentMap.set(null);
        this.state.nbCheckpoints.set(0);
        this.state.nbRandomItems.set(0);
        this.state.actionPoints.set(1);
    }

    private isItem(value: string): boolean {
        return ['shield', 'lance', 'potion', 'crystal', 'compas', 'hourglass', 'random'].includes(value as ItemType);
    }

    private setCounters(size: number | null): void {
        if (size === SMALL_SIZE) {
            this.state.nbCheckpoints.set(SMALL_SIZE_ITEMS_FLAGS);
            this.state.nbRandomItems.set(SMALL_SIZE_ITEMS_FLAGS);
        } else if (size === MEDIUM_SIZE) {
            this.state.nbCheckpoints.set(MEDIUM_SIZE_ITEMS_FLAGS);
            this.state.nbRandomItems.set(MEDIUM_SIZE_ITEMS_FLAGS);
        } else if (size === LARGE_SIZE) {
            this.state.nbCheckpoints.set(LARGE_SIZE_ITEMS_FLAGS);
            this.state.nbRandomItems.set(LARGE_SIZE_ITEMS_FLAGS);
        }
    }

    private setMaxFlagsAndRandoms(size: number): void {
        if (size === SMALL_SIZE) {
            this.maxFlagsAndRandoms = SMALL_SIZE_ITEMS_FLAGS;
        } else if (size === MEDIUM_SIZE) {
            this.maxFlagsAndRandoms = MEDIUM_SIZE_ITEMS_FLAGS;
        } else if (size === LARGE_SIZE) {
            this.maxFlagsAndRandoms = LARGE_SIZE_ITEMS_FLAGS;
        }
    }

    private setOriginalState(grid: TileType[][], items: ItemType[][], gameName: string, gameDescription: string): void {
        this.originalGrid = JSON.parse(JSON.stringify(grid));
        this.originalItems = JSON.parse(JSON.stringify(items));
        this.originalGameName = gameName;
        this.originalGameDescription = gameDescription;
    }
}
