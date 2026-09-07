import { ItemType } from './item.interface';
import { Position } from './position.interface';

export interface Player {
    socketId: string;
    name: string;
    avatar: string;
    speed: number;
    defense: number;
    attack: number;
    healthpoints: number;
    position: Position;
    startPosition?: Position;
    fleeAttempts: number;
    battlesWon: number;
    inventory: ItemType[];
    isInventoryFull: boolean;
    isAdmin?: boolean;
    hasLeft?: boolean;
    dice: {
        atk: number;
        def: number;
    };
    isMyTurn: boolean;
    movementPoints: number;
    actionPoints: number;
    isBot?: boolean;
    isAgressive?: boolean;
    isFlagHolder?: boolean;
    hasHeldFlag?: boolean;
    successfulFleeAttempts?: number;
    visitedTiles?: Position[];
    totalDamageDone?: number;
    totalDamageTaken?: number;
    turnsPlayed?: number;
    combatsParticipated?: number;
    collectedUniqueItems?: ItemType[];
    battlesLost?: number;
    hasFlagMusicOption?: boolean;
    isEliminated: boolean;
}
