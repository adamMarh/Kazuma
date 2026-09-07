/* eslint-disable max-lines */
import { Injectable } from '@angular/core';
import { LARGE_SIZE_ITEMS_FLAGS, MEDIUM_SIZE, MEDIUM_SIZE_ITEMS_FLAGS, SMALL_SIZE, SMALL_SIZE_ITEMS_FLAGS } from '@app/constants/grid';
import { TileType } from '@app/interfaces/tile.interface';
import { ItemType } from '@common/interfaces/item.interface';

export interface MapGeneratorOptions {
    size: number;
    gameMode: string;
    waterPercentage: number;
    icePercentage: number;
}

interface Structure {
    x: number;
    y: number;
    width: number;
    height: number;
    doorPositions: { x: number; y: number }[];
}

interface Position {
    x: number;
    y: number;
}

const DEFAULT_WATER_PERCENTAGE = 10;
const DEFAULT_ICE_PERCENTAGE = 5;
const MIN_STRUCTURE_INTERIOR = 2;
const MAX_STRUCTURE_INTERIOR_SMALL = 3;
const MAX_STRUCTURE_INTERIOR_MEDIUM = 4;
const MAX_STRUCTURE_INTERIOR_LARGE = 5;
const MIN_STARTING_POINT_DISTANCE = 3;
const MIN_BODY_SIZE = 4;
const HALF = 0.5;
const MAX_GENERATION_ATTEMPTS = 100;
const TERRAIN_TILES = new Set<TileType>(['grass', 'water', 'ice']);

@Injectable({ providedIn: 'root' })
export class MapGeneratorService {
    private previousGrid: string | null = null;

    static getDefaultOptions(size: number, gameMode: string): MapGeneratorOptions {
        return {
            size,
            gameMode,
            waterPercentage: DEFAULT_WATER_PERCENTAGE,
            icePercentage: DEFAULT_ICE_PERCENTAGE,
        };
    }

    generate(options: MapGeneratorOptions): { tiles: TileType[][]; items: ItemType[][] } {
        for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
            const result = this.tryGenerate(options);
            if (result) {
                const serialized = JSON.stringify(result.tiles) + JSON.stringify(result.items);
                if (serialized !== this.previousGrid) {
                    this.previousGrid = serialized;
                    return result;
                }
            }
        }
        // Fallback: return a plain grassfield (should be extremely rare)
        const fallbackSize = options.size;
        return {
            tiles: Array.from({ length: fallbackSize }, () => Array<TileType>(fallbackSize).fill('grass')),
            items: Array.from({ length: fallbackSize }, () => Array<ItemType>(fallbackSize).fill('empty')),
        };
    }

    private tryGenerate(options: MapGeneratorOptions): { tiles: TileType[][]; items: ItemType[][] } | null {
        const { size, gameMode, waterPercentage, icePercentage } = options;
        const tiles: TileType[][] = Array.from({ length: size }, () => Array<TileType>(size).fill('grass'));
        const items: ItemType[][] = Array.from({ length: size }, () => Array<ItemType>(size).fill('empty'));

        // 1. Determine counts
        const numStructures = this.getStructureCount(size);
        const numCheckpoints = this.getCheckpointCount(size);
        const numItems = this.getItemCount(size);
        const uniqueItems: ItemType[] = ['shield', 'lance', 'potion', 'crystal', 'compas', 'hourglass'];

        // 2. Place structures
        const structures = this.placeStructures(tiles, items, size, numStructures, uniqueItems);
        if (!structures || structures.length < numStructures) return null;

        // 3. Place water bodies
        if (waterPercentage > 0) {
            const success = this.placeTerrainBodies(tiles, size, 'water', waterPercentage, structures);
            if (!success) return null;
        }

        // 4. Place ice bodies
        if (icePercentage > 0) {
            const success = this.placeTerrainBodies(tiles, size, 'ice', icePercentage, structures);
            if (!success) return null;
        }

        // 5. Place starting points (checkpoints) outside structures
        const startingPoints = this.placeStartingPoints(tiles, items, size, numCheckpoints, structures);
        if (!startingPoints || startingPoints.length < numCheckpoints) return null;

        // 6. Place remaining items up to the exact required item count
        this.placeRemainingItems(tiles, items, size, numItems, uniqueItems, structures);

        // 7. Place flag if CTF
        if (gameMode === 'CTF') {
            this.placeFlag(tiles, items, size, structures);
        }

        // 8. Validate
        if (!this.validateGenerated(tiles, items, size, numCheckpoints)) return null;

        return { tiles, items };
    }

    private getStructureCount(size: number): number {
        if (size <= SMALL_SIZE) return 1;
        if (size <= MEDIUM_SIZE) return 2;
        return 3;
    }

    private getCheckpointCount(size: number): number {
        if (size <= SMALL_SIZE) return SMALL_SIZE_ITEMS_FLAGS;
        if (size <= MEDIUM_SIZE) return MEDIUM_SIZE_ITEMS_FLAGS;
        return LARGE_SIZE_ITEMS_FLAGS;
    }

    private getItemCount(size: number): number {
        if (size <= SMALL_SIZE) return SMALL_SIZE_ITEMS_FLAGS;
        if (size <= MEDIUM_SIZE) return MEDIUM_SIZE_ITEMS_FLAGS;
        return LARGE_SIZE_ITEMS_FLAGS;
    }

    private getMaxStructureInterior(size: number): number {
        if (size <= SMALL_SIZE) return MAX_STRUCTURE_INTERIOR_SMALL;
        if (size <= MEDIUM_SIZE) return MAX_STRUCTURE_INTERIOR_MEDIUM;
        return MAX_STRUCTURE_INTERIOR_LARGE;
    }

    // ────────────────────────── Structure Placement ──────────────────────────

    private placeStructures(tiles: TileType[][], items: ItemType[][], size: number, count: number, uniqueItems: ItemType[]): Structure[] | null {
        const structures: Structure[] = [];
        const maxInterior = this.getMaxStructureInterior(size);
        const usedItemsInStructures: Set<ItemType> = new Set();

        for (let i = 0; i < count; i++) {
            let placed = false;
            for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
                const interiorW = this.randomInt(MIN_STRUCTURE_INTERIOR, maxInterior);
                const interiorH = this.randomInt(MIN_STRUCTURE_INTERIOR, maxInterior);
                // Full structure includes walls: +2 on each dimension
                const fullW = interiorW + 2;
                const fullH = interiorH + 2;

                // Must be at least 1 tile from edge to allow doors to not be on map edge
                const maxX = size - fullW - 1;
                const maxY = size - fullH - 1;
                if (maxX < 1 || maxY < 1) continue;

                const sx = this.randomInt(1, maxX);
                const sy = this.randomInt(1, maxY);

                // Check overlap with existing structures (with 1 tile buffer)
                if (this.overlapsStructures(sx, sy, fullW, fullH, structures)) continue;

                // Place walls
                this.placeStructureWalls(tiles, sx, sy, fullW, fullH);

                // Place door(s) - at least one
                const doorPositions = this.placeStructureDoors(tiles, sx, sy, fullW, fullH, size);
                if (doorPositions.length === 0) {
                    // Undo walls
                    this.clearStructureWalls(tiles, sx, sy, fullW, fullH);
                    continue;
                }

                // Place interior terrain (grass)
                for (let dy = 1; dy < fullH - 1; dy++) {
                    for (let dx = 1; dx < fullW - 1; dx++) {
                        tiles[sy + dy][sx + dx] = 'grass';
                    }
                }

                // Place one item inside the structure
                const interiorPositions: Position[] = [];
                for (let dy = 1; dy < fullH - 1; dy++) {
                    for (let dx = 1; dx < fullW - 1; dx++) {
                        interiorPositions.push({ x: sx + dx, y: sy + dy });
                    }
                }
                const itemPos = interiorPositions[this.randomInt(0, interiorPositions.length - 1)];
                // Pick a unique item not yet placed in a structure
                const availableItems = uniqueItems.filter((it) => !usedItemsInStructures.has(it));
                if (availableItems.length > 0) {
                    const selectedItem = availableItems[this.randomInt(0, availableItems.length - 1)];
                    items[itemPos.y][itemPos.x] = selectedItem;
                    usedItemsInStructures.add(selectedItem);
                }

                structures.push({ x: sx, y: sy, width: fullW, height: fullH, doorPositions });
                placed = true;
                break;
            }
            if (!placed) return null;
        }
        return structures;
    }

    private overlapsStructures(x: number, y: number, w: number, h: number, structures: Structure[]): boolean {
        const buffer = 2;
        for (const s of structures) {
            if (x - buffer < s.x + s.width && x + w + buffer > s.x && y - buffer < s.y + s.height && y + h + buffer > s.y) {
                return true;
            }
        }
        return false;
    }

    private placeStructureWalls(tiles: TileType[][], sx: number, sy: number, w: number, h: number): void {
        // Top and bottom walls
        for (let dx = 0; dx < w; dx++) {
            tiles[sy][sx + dx] = 'wall';
            tiles[sy + h - 1][sx + dx] = 'wall';
        }
        // Left and right walls
        for (let dy = 0; dy < h; dy++) {
            tiles[sy + dy][sx] = 'wall';
            tiles[sy + dy][sx + w - 1] = 'wall';
        }
    }

    private clearStructureWalls(tiles: TileType[][], sx: number, sy: number, w: number, h: number): void {
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                if (dy === 0 || dy === h - 1 || dx === 0 || dx === w - 1) {
                    tiles[sy + dy][sx + dx] = 'grass';
                }
            }
        }
    }

    private placeStructureDoors(tiles: TileType[][], sx: number, sy: number, w: number, h: number, size: number): Position[] {
        const doorCandidates: { pos: Position; wallAxis: 'horizontal' | 'vertical' }[] = [];

        // Top wall (excluding corners) - horizontal wall, door needs walls left+right, terrain up+down
        for (let dx = 1; dx < w - 1; dx++) {
            const px = sx + dx;
            const py = sy;
            if (this.isValidDoorPosition(px, py, 'horizontal', size, tiles)) {
                doorCandidates.push({ pos: { x: px, y: py }, wallAxis: 'horizontal' });
            }
        }
        // Bottom wall (excluding corners)
        for (let dx = 1; dx < w - 1; dx++) {
            const px = sx + dx;
            const py = sy + h - 1;
            if (this.isValidDoorPosition(px, py, 'horizontal', size, tiles)) {
                doorCandidates.push({ pos: { x: px, y: py }, wallAxis: 'horizontal' });
            }
        }
        // Left wall (excluding corners)
        for (let dy = 1; dy < h - 1; dy++) {
            const px = sx;
            const py = sy + dy;
            if (this.isValidDoorPosition(px, py, 'vertical', size, tiles)) {
                doorCandidates.push({ pos: { x: px, y: py }, wallAxis: 'vertical' });
            }
        }
        // Right wall (excluding corners)
        for (let dy = 1; dy < h - 1; dy++) {
            const px = sx + w - 1;
            const py = sy + dy;
            if (this.isValidDoorPosition(px, py, 'vertical', size, tiles)) {
                doorCandidates.push({ pos: { x: px, y: py }, wallAxis: 'vertical' });
            }
        }

        if (doorCandidates.length === 0) return [];

        // Place 1-2 doors
        this.shuffle(doorCandidates);
        const numDoors = Math.min(doorCandidates.length, this.randomInt(1, 2));
        const placed: Position[] = [];

        for (let i = 0; i < numDoors && i < doorCandidates.length; i++) {
            const candidate = doorCandidates[i];
            tiles[candidate.pos.y][candidate.pos.x] = 'doorClose';
            placed.push(candidate.pos);
        }

        return placed;
    }

    private isValidDoorPosition(px: number, py: number, wallAxis: 'horizontal' | 'vertical', size: number, tiles: TileType[][]): boolean {
        // Door cannot be on edge of map
        if (px <= 0 || px >= size - 1 || py <= 0 || py >= size - 1) return false;

        if (wallAxis === 'horizontal') {
            // Door on top/bottom wall: walls left & right (same row), terrain above & below
            const leftTile = tiles[py][px - 1];
            const rightTile = tiles[py][px + 1];
            if (leftTile !== 'wall' && rightTile !== 'wall') return false;
            // Check that tiles above and below are or will be terrain
            // Above: outside structure = grass (will be terrain), below: inside = grass
            const aboveTile = py - 1 >= 0 ? tiles[py - 1][px] : null;
            const belowTile = py + 1 < size ? tiles[py + 1][px] : null;
            if (aboveTile !== null && !TERRAIN_TILES.has(aboveTile) && aboveTile !== 'grass') return false;
            if (belowTile !== null && !TERRAIN_TILES.has(belowTile) && belowTile !== 'grass') return false;
            return true;
        } else {
            // Door on left/right wall: walls above & below (same column), terrain left & right
            const aboveTile = tiles[py - 1][px];
            const belowTile = tiles[py + 1][px];
            if (aboveTile !== 'wall' && belowTile !== 'wall') return false;
            const leftTile = px - 1 >= 0 ? tiles[py][px - 1] : null;
            const rightTile = px + 1 < size ? tiles[py][px + 1] : null;
            if (leftTile !== null && !TERRAIN_TILES.has(leftTile) && leftTile !== 'grass') return false;
            if (rightTile !== null && !TERRAIN_TILES.has(rightTile) && rightTile !== 'grass') return false;
            return true;
        }
    }

    // ────────────────────────── Terrain Body Placement ──────────────────────────

    private placeTerrainBodies(tiles: TileType[][], size: number, terrainType: TileType, percentage: number, structures: Structure[]): boolean {
        const totalTiles = size * size;
        const targetCount = Math.max(1, Math.round((totalTiles * percentage) / 100));
        const bodySize = Math.min(MIN_BODY_SIZE, targetCount);

        // Try to place at least one body
        let placed = 0;
        for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS && placed < targetCount; attempt++) {
            const startX = this.randomInt(0, size - 1);
            const startY = this.randomInt(0, size - 1);

            if (!this.canPlaceTerrain(startX, startY, tiles, size, structures)) continue;

            // Grow a connected body using random walk
            const body: Position[] = [{ x: startX, y: startY }];
            const bodySet = new Set<string>([`${startX},${startY}`]);
            const remaining = Math.min(targetCount - placed, bodySize + this.randomInt(0, bodySize));

            for (let grow = 1; grow < remaining; grow++) {
                const frontier: Position[] = [];
                for (const p of body) {
                    for (const [dx, dy] of [
                        [-1, 0],
                        [1, 0],
                        [0, -1],
                        [0, 1],
                    ]) {
                        const nx = p.x + dx;
                        const ny = p.y + dy;
                        const key = `${nx},${ny}`;
                        if (!bodySet.has(key) && this.canPlaceTerrain(nx, ny, tiles, size, structures)) {
                            frontier.push({ x: nx, y: ny });
                        }
                    }
                }
                if (frontier.length === 0) break;
                const next = frontier[this.randomInt(0, frontier.length - 1)];
                body.push(next);
                bodySet.add(`${next.x},${next.y}`);
            }

            // Apply the body to tiles
            for (const p of body) {
                tiles[p.y][p.x] = terrainType;
                placed++;
            }
        }

        // If we still need more tiles scattered, place individually
        for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS * 2 && placed < targetCount; attempt++) {
            const x = this.randomInt(0, size - 1);
            const y = this.randomInt(0, size - 1);
            if (this.canPlaceTerrain(x, y, tiles, size, structures)) {
                tiles[y][x] = terrainType;
                placed++;
            }
        }

        return placed > 0;
    }

    private canPlaceTerrain(x: number, y: number, tiles: TileType[][], size: number, structures: Structure[]): boolean {
        if (x < 0 || x >= size || y < 0 || y >= size) return false;
        if (tiles[y][x] !== 'grass') return false;
        // Don't place inside or on structure walls
        for (const s of structures) {
            if (x >= s.x && x < s.x + s.width && y >= s.y && y < s.y + s.height) return false;
        }
        return true;
    }

    // ────────────────────────── Starting Points ──────────────────────────

    private placeStartingPoints(tiles: TileType[][], items: ItemType[][], size: number, count: number, structures: Structure[]): Position[] | null {
        const points: Position[] = [];

        for (let i = 0; i < count; i++) {
            let placed = false;
            for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS * 3; attempt++) {
                const x = this.randomInt(0, size - 1);
                const y = this.randomInt(0, size - 1);

                if (!this.isValidStartingPointPosition(x, y, tiles, items, size, structures, points)) continue;

                items[y][x] = 'checkpoint';
                points.push({ x, y });
                placed = true;
                break;
            }
            if (!placed) return null;
        }
        return points;
    }

    private isValidStartingPointPosition(
        x: number,
        y: number,
        tiles: TileType[][],
        items: ItemType[][],
        size: number,
        structures: Structure[],
        existingPoints: Position[],
    ): boolean {
        if (x < 0 || x >= size || y < 0 || y >= size) return false;
        // Must be on terrain
        if (!TERRAIN_TILES.has(tiles[y][x])) return false;
        // Must be empty item slot
        if (items[y][x] !== 'empty') return false;
        // Cannot be inside a structure
        for (const s of structures) {
            if (x >= s.x && x < s.x + s.width && y >= s.y && y < s.y + s.height) return false;
        }
        // Minimum distance of 3 from other starting points
        for (const p of existingPoints) {
            const dist = Math.abs(x - p.x) + Math.abs(y - p.y);
            if (dist < MIN_STARTING_POINT_DISTANCE) return false;
        }
        return true;
    }

    // ────────────────────────── Item Placement ──────────────────────────

    private placeRemainingItems(
        tiles: TileType[][],
        items: ItemType[][],
        size: number,
        numItems: number,
        uniqueItems: ItemType[],
        structures: Structure[],
    ): void {
        // Count items already placed in structures (non-checkpoint, non-empty)
        const placedItems = new Set<ItemType>();
        let alreadyPlaced = 0;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const item = items[y][x];
                if (item !== 'empty' && item !== 'checkpoint') {
                    placedItems.add(item);
                    alreadyPlaced++;
                }
            }
        }

        let remaining = numItems - alreadyPlaced;
        if (remaining <= 0) return;

        // Build pool: remaining unique items + equal number of 'random' slots, then shuffle
        const remainingUnique = uniqueItems.filter((item) => !placedItems.has(item));
        const pool: ItemType[] = [...remainingUnique, ...Array<ItemType>(remainingUnique.length).fill('random')];
        this.shuffle(pool);

        for (let i = 0; i < pool.length && remaining > 0; i++) {
            this.placeItemRandomly(tiles, items, size, pool[i], structures);
            remaining--;
        }

        // Fill any leftover slots (if pool was exhausted) with random items
        for (let i = 0; i < remaining; i++) {
            this.placeItemRandomly(tiles, items, size, 'random', structures);
        }
    }

    private placeItemRandomly(tiles: TileType[][], items: ItemType[][], size: number, item: ItemType, structures: Structure[]): void {
        for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
            const x = this.randomInt(0, size - 1);
            const y = this.randomInt(0, size - 1);
            if (!TERRAIN_TILES.has(tiles[y][x])) continue;
            if (items[y][x] !== 'empty') continue;
            // Don't place inside structures (items in structures are already placed)
            let insideStructure = false;
            for (const s of structures) {
                if (x > s.x && x < s.x + s.width - 1 && y > s.y && y < s.y + s.height - 1) {
                    insideStructure = true;
                    break;
                }
            }
            if (insideStructure) continue;
            items[y][x] = item;
            return;
        }
    }

    private placeFlag(tiles: TileType[][], items: ItemType[][], size: number, structures: Structure[]): void {
        this.placeItemRandomly(tiles, items, size, 'flag', structures);
    }

    // ────────────────────────── Validation ──────────────────────────

    private validateGenerated(tiles: TileType[][], items: ItemType[][], size: number, requiredCheckpoints: number): boolean {
        // 1. Check checkpoint count
        let checkpointCount = 0;
        const checkpoints: Position[] = [];
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (items[y][x] === 'checkpoint') {
                    checkpointCount++;
                    checkpoints.push({ x, y });
                }
            }
        }
        if (checkpointCount !== requiredCheckpoints) return false;

        // 2. Terrain >= 50%
        let terrainCount = 0;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (TERRAIN_TILES.has(tiles[y][x])) terrainCount++;
            }
        }
        if (terrainCount / (size * size) < HALF) return false;

        // 3. BFS accessibility from checkpoints
        const visited: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
        const queue: Position[] = [];
        for (const cp of checkpoints) {
            if (tiles[cp.y][cp.x] !== 'wall') {
                visited[cp.y][cp.x] = true;
                queue.push(cp);
            }
        }
        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) break;
            const { x, y } = current;
            for (const [dx, dy] of [
                [-1, 0],
                [1, 0],
                [0, -1],
                [0, 1],
            ]) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < size && ny >= 0 && ny < size && !visited[ny][nx] && tiles[ny][nx] !== 'wall') {
                    visited[ny][nx] = true;
                    queue.push({ x: nx, y: ny });
                }
            }
        }
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (TERRAIN_TILES.has(tiles[y][x]) && !visited[y][x]) return false;
            }
        }

        // 4. Door adjacency validation
        const doorTiles = new Set<TileType>(['doorOpen', 'doorClose']);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (doorTiles.has(tiles[y][x])) {
                    // Door cannot be on edge
                    if (x <= 0 || x >= size - 1 || y <= 0 || y >= size - 1) return false;

                    const wallsUpDown = tiles[y - 1][x] === 'wall' && tiles[y + 1][x] === 'wall';
                    const wallsLeftRight = tiles[y][x - 1] === 'wall' && tiles[y][x + 1] === 'wall';
                    const terrainUpDown = TERRAIN_TILES.has(tiles[y - 1][x]) && TERRAIN_TILES.has(tiles[y + 1][x]);
                    const terrainLeftRight = TERRAIN_TILES.has(tiles[y][x - 1]) && TERRAIN_TILES.has(tiles[y][x + 1]);

                    const orientation1 = wallsUpDown && terrainLeftRight;
                    const orientation2 = wallsLeftRight && terrainUpDown;
                    if (!orientation1 && !orientation2) return false;
                }
            }
        }

        return true;
    }

    // ────────────────────────── Utility ──────────────────────────

    private randomInt(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    private shuffle<T>(arr: T[]): void {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = this.randomInt(0, i);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
}
