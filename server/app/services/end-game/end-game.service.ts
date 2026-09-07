import { DURATION_SIXTY_THOUSAND, DURATION_THOUSAND, PERCENTAGE } from '@app/constants/game';
import { Game } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EndGameService {
    calculateTilesVisitedPercentage(player: Player, mapTiles: string[][]): number {
        const terrainTiles = ['grass', 'ice', 'water'];

        const totalTerrainTiles = mapTiles.flat().filter((tile) => terrainTiles.includes(tile)).length;
        const visited = player.visitedTiles ?? [];
        const visitedCount = visited.filter(
            ({ x, y }) => y >= 0 && y < mapTiles.length && x >= 0 && x < mapTiles[0].length && terrainTiles.includes(mapTiles[y][x]),
        ).length;

        if (totalTerrainTiles === 0) return 0;

        return Math.round((visitedCount / totalTerrainTiles) * PERCENTAGE);
    }

    calculateGameDuration(game: Game): string {
        const durationInSec = (game.endTime?.getTime?.() ?? Date.now()) - game.startTime.getTime();
        const minutes = Math.floor(durationInSec / DURATION_SIXTY_THOUSAND);
        const seconds = Math.floor((durationInSec % DURATION_SIXTY_THOUSAND) / DURATION_THOUSAND);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    calculateTotalTurns(game: Game): number {
        return game.players.reduce((sum, player) => sum + (player.turnsPlayed || 0), 0);
    }

    calculateVisitedTilesPercentage(game: Game): number {
        const terrainTiles = ['grass', 'ice', 'water'];
        const mapTiles = game.map.tiles;
        const totalTerrainTiles = mapTiles.flat().filter((tile) => terrainTiles.includes(tile)).length;

        const visitedTiles = new Set<string>();
        game.players.forEach((player) => {
            player.visitedTiles?.forEach(({ x, y }) => {
                if (terrainTiles.includes(mapTiles[y][x])) {
                    visitedTiles.add(`${x},${y}`);
                }
            });
        });

        return totalTerrainTiles > 0 ? Math.round((visitedTiles.size / totalTerrainTiles) * PERCENTAGE) : 0;
    }

    calculateDoorManipulatedPercentage(game: Game): number {
        const mapTiles = game.map.tiles;
        const totalDoors = mapTiles.flat().filter((tile) => tile === 'doorOpen' || tile === 'doorClose').length;
        const manipulated = game.doorsManipulated ? game.doorsManipulated.size : 0;
        return totalDoors > 0 ? Math.round((manipulated / totalDoors) * 100) : 0;
    }

    calculateFlagHolders(game: Game): number {
        if (game.map.gameMode !== 'CTF') return 0;
        const playersWithFlag = new Set<string>();
        game.players.forEach((player) => {
            if (player.collectedUniqueItems?.includes('flag')) {
                playersWithFlag.add(player.socketId);
            }
        });
        return playersWithFlag.size;
    }
}
