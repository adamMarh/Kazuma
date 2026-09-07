import { ItemService } from '@app/services/item/item.service';
import { Game } from '@common/interfaces/game.interface';
import { ItemType } from '@common/interfaces/item.interface';
import { Map as GameMap } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/interfaces/position.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MovementService {
    private movementCosts: Record<string, number> = {
        grass: 1,
        doorOpen: 1,
        water: 2,
        ice: 0,
        wall: Infinity,
        doorClose: Infinity,
    };

    constructor(private readonly itemService?: ItemService) {}

    getPossibleMovements(player: Player, game: Game): Position[] {
        const map = game.map;
        const occupiedPositions = new Set(game.players.map((p) => `${p.position.x},${p.position.y}`));
        const paths = this.calculatePaths(player.position, map, player.movementPoints, occupiedPositions, player);
        const positions: Position[] = [];
        paths.forEach((_, key) => {
            if (key !== `${player.position.x},${player.position.y}`) {
                positions.push(this.parseKey(key));
            }
        });
        return positions;
    }

    findShortestPath(player: Player, targetPos: Position, game: Game, gameMap: GameMap): Position[] {
        if (!game || !player) {
            return [];
        }
        if (targetPos.x === -1 && targetPos.y === -1) {
            return [{ x: -1, y: -1 }];
        }
        const activePlayers = game.players.filter((p) => !game.inactivePlayers.some((ip) => ip.socketId === p.socketId));
        const occupiedPositions = new Set(activePlayers.filter((p) => p.socketId !== player.socketId).map((p) => `${p.position.x},${p.position.y}`));
        const paths = this.calculatePaths(player.position, gameMap, Infinity, occupiedPositions, player);
        const destKey = `${targetPos.x},${targetPos.y}`;
        return paths.has(destKey) ? paths.get(destKey).path.slice(1) : [];
    }

    placePlayers(game: Game, players: Player[]): void {
        const shuffledPositions = [...game.startingPoints].sort(() => Math.random() - 0.5);
        players.forEach((player, index) => {
            {
                player.position = shuffledPositions[index];
                player.startPosition = shuffledPositions[index];
            }
        });
        const assignedPositions = game.players.map((player) => player.startPosition);
        game.startingPoints = assignedPositions;
        game.map.items = game.map.items.map((row, y) =>
            row.map((item, x) => {
                const isUsed = assignedPositions.some((pos) => pos.x === x && pos.y === y);
                return isUsed ? item : item === 'checkpoint' ? 'hidden_checkpoint' : item;
            }),
        );
    }

    dropInPlayer(game: Game, player: Player): void {
        const isInactive = game.inactivePlayers.some((p) => p.socketId === player.socketId);

        if (isInactive) {
            player.position = this.findNearestFreeTile(player.startPosition, game);
            game.map.items[player.startPosition.y][player.startPosition.x] = 'checkpoint';
            return;
        }

        const spawn = this.findNearestFreeTile(this.getHiddenCheckpoint(game), game);

        game.map.items[spawn.y][spawn.x] = 'checkpoint';

        player.position = spawn;
        player.startPosition = spawn;
    }

    movePlayer(
        player: Player,
        path: Position[],
        inDebug: boolean,
        game: Game,
    ): {
        player: Player;
        mapUpdated: boolean;
        inventoryFull: boolean;
        encounteredItem: { position: Position; type: string } | null;
        realPath: Position[];
    } {
        this.updateVisitedTiles(player, path);
        const { itemPosition, itemType } = this.findFirstItemOnPath(path, game);
        const finalPosition = itemPosition || path[path.length - 1];
        const { mapUpdated, inventoryFull, encounteredItem } = this.handleItemCollection(player, game, itemPosition, itemType);
        const effectivePath = this.calculateEffectivePath(path, finalPosition);
        const realPath = this.executeMovement(player, game, effectivePath);

        this.checkWinCondition(player, game);
        return {
            player,
            mapUpdated,
            inventoryFull,
            encounteredItem,
            realPath,
        };
    }

    movementCost(path: Position[], map: GameMap, player?: Player): number {
        let cost = 0;
        path.forEach((pos) => {
            const tileCost = this.getTileCost(pos, map, player);
            cost += tileCost;
        });
        return cost;
    }

    isAdjacent(pos1: Position, pos2: Position): boolean {
        return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y) === 1;
    }

    private findNearestFreeTile(position: Position, game: Game): Position {
        const isOccupied = game.players.some(
            (p) => p.position.x === position.x && p.position.y === position.y && p.startPosition.x !== position.x && p.startPosition.y !== position.y,
        );
        if (isOccupied) {
            let freeTile: Position | null = null;
            let minDistance = Infinity;
            for (let y = 0; y < game.map.tiles.length; y++) {
                for (let x = 0; x < game.map.tiles[0].length; x++) {
                    const pos = { x, y };
                    const occupied = game.players.some((p) => p.position.x === pos.x && p.position.y === pos.y);
                    if (!occupied) {
                        const distance = Math.abs(pos.x - position.x) + Math.abs(pos.y - position.y);
                        if (distance < minDistance) {
                            minDistance = distance;
                            freeTile = pos;
                        }
                    }
                }
            }
            if (freeTile) {
                position = freeTile;
            }
        }
        return position;
    }

    private getHiddenCheckpoint(game: Game): { x: number; y: number } | null {
        for (let y = 0; y < game.map.items.length; y++) {
            for (let x = 0; x < game.map.items[y].length; x++) {
                if (game.map.items[y][x] === 'hidden_checkpoint') {
                    return { x, y };
                }
            }
        }
        return null;
    }

    private updateVisitedTiles(player: Player, path: Position[]): void {
        if (!player.visitedTiles) player.visitedTiles = [];

        path.forEach((pos) => {
            if (!player.visitedTiles.some((p) => p.x === pos.x && p.y === pos.y)) {
                player.visitedTiles.push({ ...pos });
            }
        });
    }

    private findFirstItemOnPath(path: Position[], game: Game): { itemPosition: Position | null; itemType: string | null } {
        const itemPos = path.find((pos) => {
            const cellContent = game.map.items[pos.y][pos.x];
            return cellContent !== 'empty' && cellContent !== 'checkpoint' && cellContent !== 'hidden_checkpoint';
        });
        return {
            itemPosition: itemPos || null,
            itemType: itemPos ? game.map.items[itemPos.y][itemPos.x] : null,
        };
    }

    private handleItemCollection(
        player: Player,
        game: Game,
        itemPosition: Position | null,
        itemType: string | null,
    ): {
        mapUpdated: boolean;
        inventoryFull: boolean;
        encounteredItem: { position: Position; type: string } | null;
    } {
        if (!itemPosition) {
            return { mapUpdated: false, inventoryFull: false, encounteredItem: null };
        }
        if (!itemType) {
            return { mapUpdated: false, inventoryFull: false, encounteredItem: null };
        }
        if (itemType === 'hidden_checkpoint') {
            return { mapUpdated: false, inventoryFull: false, encounteredItem: null };
        }
        const encounteredItem = { position: itemPosition, type: itemType };
        if (player.isInventoryFull) {
            return { mapUpdated: false, inventoryFull: true, encounteredItem };
        }
        player.inventory.push(itemType as ItemType);
        if (itemType === 'flag') {
            player.isFlagHolder = true;
            player.hasHeldFlag = true;
        }
        player.isInventoryFull = player.inventory.length >= 2;
        game.map.items[itemPosition.y][itemPosition.x] = 'empty';
        if (this.itemService) {
            this.itemService.applyItemEffect(player, itemType as ItemType);
        }
        return { mapUpdated: true, inventoryFull: false, encounteredItem };
    }

    private calculateEffectivePath(path: Position[], finalPosition: Position): Position[] {
        const finalIndex = path.findIndex((pos) => pos.x === finalPosition.x && pos.y === finalPosition.y);
        return path.slice(0, finalIndex + 1);
    }

    private executeMovement(player: Player, game: Game, effectivePath: Position[]): Position[] {
        const realPath: Position[] = [];
        for (const pos of effectivePath) {
            const movementCost = this.getTileCost(pos, game.map);
            if (player.movementPoints > 0) {
                player.movementPoints -= movementCost;
                player.position = pos;
                realPath.push(pos);
            } else {
                break;
            }
        }
        return realPath;
    }

    private checkWinCondition(player: Player, game: Game): void {
        const isBackToStart = player.position.x === player.startPosition.x && player.position.y === player.startPosition.y;
        const hasFlag = player.inventory.includes('flag');
        if (isBackToStart && hasFlag) {
            game.ended = true;
            game.winner = game.teams.red.find((playerId) => playerId === player.socketId) ? 'red' : 'blue';
        }
    }

    /**
     * Cette méthode calcule le chemin le plus court à partir d'une position donnée via l'algorithme de Dijkstra.
     * Elle utilise une file de priorité basée sur un tri par coût minimum pour optimiser la recherche du chemin.
     */
    private calculatePaths(
        start: Position,
        map: GameMap,
        maxCost: number,
        occupiedPositions?: Set<string>,
        player?: Player,
    ): Map<string, { cost: number; path: Position[] }> {
        const paths = new Map<string, { cost: number; path: Position[] }>();
        const startKey = `${start.x},${start.y}`;
        paths.set(startKey, { cost: 0, path: [start] });
        const queue: { pos: Position; cost: number; path: Position[] }[] = [{ pos: start, cost: 0, path: [start] }];
        while (queue.length > 0) {
            queue.sort((a, b) => a.cost - b.cost);
            const current = queue.shift();
            const { pos, cost, path } = current;
            for (const [dx, dy] of [
                [0, 1],
                [1, 0],
                [0, -1],
                [-1, 0],
            ]) {
                const newPos: Position = { x: pos.x + dx, y: pos.y + dy };
                if (!this.isValidMove(newPos, map, occupiedPositions, player)) continue;
                const moveCost = this.getTileCost(newPos, map, player);
                const newCost = cost + moveCost;
                if (newCost > maxCost) continue;
                const key = `${newPos.x},${newPos.y}`;
                if (!paths.has(key) || newCost < paths.get(key).cost) {
                    const newPath = [...path, newPos];
                    paths.set(key, { cost: newCost, path: newPath });
                    queue.push({ pos: newPos, cost: newCost, path: newPath });
                }
            }
        }
        return paths;
    }

    private isValidMove(pos: Position, map: GameMap, occupiedPositions?: Set<string>, player?: Player): boolean {
        if (pos.x < 0 || pos.y < 0 || pos.x >= map.tiles[0].length || pos.y >= map.tiles.length) return false;
        const tileType = map.tiles[pos.y][pos.x];
        if (tileType === 'doorClose' && player && this.itemService.canUseCompas(player)) {
            return true;
        }
        if (this.movementCosts[tileType] === Infinity) return false;
        if (occupiedPositions && occupiedPositions.has(`${pos.x},${pos.y}`)) return false;
        return true;
    }

    private getTileCost(pos: Position, map: GameMap, player?: Player): number {
        const tileType = map.tiles[pos.y][pos.x];

        if (tileType === 'doorClose' && player && player.inventory.includes('compas')) {
            return this.movementCosts['doorOpen'];
        }

        return this.movementCosts[tileType];
    }

    private parseKey(key: string): Position {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
    }
}
