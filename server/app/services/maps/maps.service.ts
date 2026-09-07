import { CreateGameMapDto } from '@app/model/dto/game-map/create-game-map.dto';
import { UpdateGameMapDto } from '@app/model/dto/game-map/update-game-map.dto';
import { GameMap, GameMapDocument } from '@app/model/schema/game-map.schema';
import { Map } from '@common/interfaces/map.interface';
import { Position } from '@common/interfaces/position.interface';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

const MIN_ACTION_POINTS = 1;
const MAX_ACTION_POINTS = 5;

@Injectable()
export class MapsService {
    private readonly terrainTiles = new Set(['ice', 'water', 'grass']);
    private readonly doorTiles = new Set(['doorOpen', 'doorClose']);
    private readonly itemTypes = new Set(['shield', 'lance', 'potion', 'crystal', 'compas', 'hourglass', 'random']);

    constructor(@InjectModel(GameMap.name) private gameMapModel: Model<GameMapDocument>) {}

    async getAllMaps(): Promise<GameMapDocument[]> {
        return this.gameMapModel.find().exec();
    }

    /** Admin view: returns maps owned by user + all public maps */
    async getMapsForAdmin(username: string): Promise<GameMapDocument[]> {
        return this.gameMapModel
            .find({
                $or: [{ owner: username }, { visibility: 'public' }],
            })
            .exec();
    }

    /** Game creation view: returns maps owned by user + public maps + private-shared maps */
    async getMapsForGameCreation(username: string): Promise<GameMapDocument[]> {
        return this.gameMapModel
            .find({
                $or: [{ owner: username }, { visibility: 'public' }, { visibility: 'private-shared' }],
            })
            .exec();
    }

    async createMap(createGameMapDto: CreateGameMapDto): Promise<GameMapDocument> {
        this.validateMap(createGameMapDto);
        await this.assertUniqueName(createGameMapDto.name);
        const { ...mapData } = createGameMapDto;
        const actionPoints = this.clampActionPoints(mapData.actionPoints);
        return await this.gameMapModel.create({
            ...mapData,
            lastSave: new Date(),
            visibility: mapData.visibility || 'private',
            owner: mapData.owner,
            actionPoints,
        });
    }

    async getMapById(id: string): Promise<GameMapDocument> {
        const map = await this.gameMapModel.findById(id).exec();
        if (!map) {
            throw new NotFoundException(`Map with id ${id} not found`);
        }
        return map;
    }

    async updateMap(id: string, updateGameMapDto: UpdateGameMapDto, username: string): Promise<GameMapDocument> {
        this.validateMap(updateGameMapDto);
        await this.assertUniqueName(updateGameMapDto.name, id);
        const existingMap = await this.gameMapModel.findById(id).exec();
        if (existingMap) {
            this.assertCanModify(existingMap, username);
        }
        const actionPoints = this.clampActionPoints(updateGameMapDto.actionPoints);
        const updateData = { ...updateGameMapDto, actionPoints };
        // Do not allow changing owner on update
        delete (updateData as Record<string, unknown>).owner;
        const updatedMap = await this.gameMapModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
        if (!updatedMap) {
            await this.createMap({ _id: id, ...updateGameMapDto, owner: username } as CreateGameMapDto);
        }
        return updatedMap;
    }

    async deleteMap(id: string, username: string): Promise<void> {
        const map = await this.gameMapModel.findById(id).exec();
        if (!map) {
            throw new NotFoundException(`Map with id ${id} not found`);
        }
        this.assertCanModify(map, username);
        await this.gameMapModel.findByIdAndDelete(id).exec();
    }

    async updateVisibility(id: string, visibility: string, username: string): Promise<GameMapDocument> {
        const map = await this.getMapById(id);
        if (map.owner !== username) {
            throw new ForbiddenException('Only the owner can change map visibility');
        }
        if (!['public', 'private', 'private-shared'].includes(visibility)) {
            throw new BadRequestException('Invalid visibility value');
        }
        map.visibility = visibility;
        return await map.save();
    }

    async duplicateMap(id: string, username: string): Promise<GameMapDocument> {
        const original = await this.getMapById(id);
        if (original.visibility !== 'public') {
            throw new ForbiddenException('Only public maps can be duplicated');
        }
        const baseName = `${original.name}_copy`;
        const uniqueName = await this.generateUniqueName(baseName);
        const duplicateData = {
            name: uniqueName,
            size: original.size,
            gameMode: original.gameMode,
            tiles: original.tiles,
            items: original.items,
            description: original.description,
            imageUrl: original.imageUrl,
            nbCheckpoints: original.nbCheckpoints,
            nbRandomItems: original.nbRandomItems,
            actionPoints: original.actionPoints || MIN_ACTION_POINTS,
            visibility: 'private' as const,
            owner: username,
            lastSave: new Date(),
        };
        return await this.gameMapModel.create(duplicateData);
    }

    async isGameAvailable(id: string, username?: string): Promise<boolean> {
        const game = await this.gameMapModel.findById(id).exec();
        if (!game) return false;
        // Public and private-shared are available to everyone; private only to owner
        if (game.visibility === 'public' || game.visibility === 'private-shared') return true;
        if (game.visibility === 'private' && username && game.owner === username) return true;
        return false;
    }

    getStartingPoints(map: Map): Position[] {
        const checkpointPositions: Position[] = [];
        map.items.forEach((row, i) => {
            row.forEach((item, j) => {
                if (item === 'checkpoint' || item === 'hidden_checkpoint') {
                    checkpointPositions.push({ x: j, y: i });
                }
            });
        });
        return checkpointPositions;
    }

    /** Check if a map name is already taken (optionally excluding a specific map id). */
    async isNameTaken(name: string, excludeId?: string): Promise<boolean> {
        const query: Record<string, unknown> = { name };
        if (excludeId) {
            query['_id'] = { $ne: excludeId };
        }
        const existing = await this.gameMapModel.findOne(query).exec();
        return !!existing;
    }

    /** Delete all maps owned by a specific user (used on account deletion). */
    async deleteMapsByOwner(username: string): Promise<void> {
        await this.gameMapModel.deleteMany({ owner: username }).exec();
    }

    private async assertUniqueName(name: string, excludeId?: string): Promise<void> {
        if (await this.isNameTaken(name, excludeId)) {
            throw new ConflictException('duplicateName');
        }
    }

    private async generateUniqueName(baseName: string): Promise<string> {
        let candidate = baseName;
        let suffix = 1;
        while (await this.isNameTaken(candidate)) {
            candidate = `${baseName}_${suffix}`;
            suffix++;
        }
        return candidate;
    }

    private assertCanModify(map: GameMapDocument, username: string): void {
        // Public maps can be modified by anyone; private/private-shared only by owner
        if (map.visibility === 'public') return;
        if (map.owner !== username) {
            throw new ForbiddenException('Only the owner can modify this map');
        }
    }

    private clampActionPoints(value?: number): number {
        if (value === undefined || value === null) return MIN_ACTION_POINTS;
        return Math.max(MIN_ACTION_POINTS, Math.min(MAX_ACTION_POINTS, value));
    }

    //  Cette methode utilise un l'algorithme BFS, que nous n'avons - biensûr - pas créé nous même
    private validateMap(dto: CreateGameMapDto | UpdateGameMapDto): void {
        const tiles = dto.tiles;
        const items = dto.items;
        const rows = tiles.length;
        const cols = tiles[0].length;
        const SMALL_MAP_SIZE = 10;
        const MEDIUM_MAP_SIZE = 15;
        const LARGE_MAP_SIZE = 20;
        const smallMapCheckpoints = 2;
        const mediumMapCheckpoints = 4;
        const largeMapCheckpoints = 6;
        const smallMapItems = 2;
        const mediumMapItems = 4;
        const largeMapItems = 6;

        // Validate name and description are not blank
        const nameNotBlank = !!(dto.name && dto.name.trim().length > 0);
        const descriptionNotBlank = !!(dto.description && dto.description.trim().length > 0);

        const mapSize = Number(dto.size);
        let requiredCheckpoints: number;
        let requiredItems: number;
        if (mapSize === SMALL_MAP_SIZE) {
            requiredCheckpoints = smallMapCheckpoints;
            requiredItems = smallMapItems;
        } else if (mapSize === MEDIUM_MAP_SIZE) {
            requiredCheckpoints = mediumMapCheckpoints;
            requiredItems = mediumMapItems;
        } else if (mapSize === LARGE_MAP_SIZE) {
            requiredCheckpoints = largeMapCheckpoints;
            requiredItems = largeMapItems;
        }

        const checkpoints: [number, number][] = [];
        let itemCount = 0;
        let hasFlag = false;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (items[r][c] === 'checkpoint') {
                    checkpoints.push([r, c]);
                }
                if (this.itemTypes.has(items[r][c])) {
                    itemCount++;
                }
                if (items[r][c] === 'flag') {
                    hasFlag = true;
                }
            }
        }

        const missingCheckpoint = checkpoints.length === requiredCheckpoints;
        const missingItems = itemCount === requiredItems;
        const missingFlag = dto.gameMode === 'CTF' ? hasFlag : true;

        // --------------------------------------- DÃ©but du BFS ---------------------------------------
        const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
        const queue: [number, number][] = [];
        for (const [r, c] of checkpoints) {
            if (r >= 0 && r < rows && c >= 0 && c < cols && tiles[r][c] !== 'wall') {
                visited[r][c] = true;
                queue.push([r, c]);
            }
        }

        const neighborOffsets = [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
        ];

        while (queue.length > 0) {
            const [r, c] = queue.shift();
            for (const [dr, dc] of neighborOffsets) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && tiles[nr][nc] !== 'wall' && !visited[nr][nc]) {
                    visited[nr][nc] = true;
                    queue.push([nr, nc]);
                }
            }
        }

        // --------------------------------------- Fin du BFS ---------------------------------------

        let terrainTileCount = 0;
        let terrainTileAccessibility = true;
        let doorTileAdjacency = true;
        /* eslint-disable no-unused-vars */
        const checkWallsUpDown = (r: number, c: number) =>
            [
                [-1, 0],
                [1, 0],
            ].every(([dr, dc]) => {
                const rr = r + dr;
                if (rr < 0 || rr >= rows) return false;
                return tiles[rr][c] === 'wall';
            });

        const checkWallsLeftRight = (r: number, c: number) =>
            [
                [0, -1],
                [0, 1],
            ].every(([dr, dc]) => {
                const cc = c + dc;
                if (cc < 0 || cc >= cols) return false;
                return tiles[r][cc] === 'wall';
            });

        const checkTerrainUpDown = (r: number, c: number) =>
            [
                [-1, 0],
                [1, 0],
            ].every(([dr, dc]) => {
                const rr = r + dr;
                if (rr < 0 || rr >= rows) return false;
                return this.terrainTiles.has(tiles[rr][c]);
            });

        const checkTerrainLeftRight = (r: number, c: number) =>
            [
                [0, -1],
                [0, 1],
            ].every(([dr, dc]) => {
                const cc = c + dc;
                if (cc < 0 || cc >= cols) return false;
                return this.terrainTiles.has(tiles[r][cc]);
            });

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const tile = tiles[r][c];
                if (this.terrainTiles.has(tile)) {
                    terrainTileCount++;
                    if (!visited[r][c]) {
                        terrainTileAccessibility = false;
                    }
                }
                if (this.doorTiles.has(tile)) {
                    const orientation1 = checkWallsUpDown(r, c) && checkTerrainLeftRight(r, c);
                    const orientation2 = checkTerrainUpDown(r, c) && checkWallsLeftRight(r, c);
                    if (!orientation1 && !orientation2) {
                        doorTileAdjacency = false;
                    }
                }
            }
        }

        const totalTiles = rows * cols;
        const half = 0.5;
        const terrainTilePercentage = terrainTileCount / totalTiles >= half;

        const validationResults = {
            nameNotBlank,
            descriptionNotBlank,
            missingCheckpoint,
            missingItems,
            missingFlag,
            terrainTilePercentage,
            terrainTileAccessibility,
            doorTileAdjacency,
        };

        const failedValidations = Object.entries(validationResults)
            .filter(([_, result]) => !result)
            .map(([key]) => key);

        if (failedValidations.length > 0) {
            throw new BadRequestException(failedValidations.join(', '));
        }
    }
}
