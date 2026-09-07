import { Map } from './map.interface';
import { Player } from './player.interface';
import { Position } from './position.interface';
import { Team } from './team.interface';

export interface Game {
    gameId: string;
    players: Player[];
    map: Map;
    isLocked: boolean;
    dropInActive: boolean;
    fastEliminationActive: boolean;
    started: boolean;
    ended: boolean;
    maxPlayers: number;
    playerTurns: string[];
    inactivePlayers: Player[];
    eliminatedPlayers: Player[];
    currentPlayerIndex: number;
    startingPoints: Position[];
    selectedAvatars: Record<string, number>;
    isInDebugMode: boolean;
    startTime?: Date;
    endTime?: Date;
    teams: Team;
    winner: string;
    doorsManipulated?: Set<string>;
    currencyRewardsDistributed?: boolean;
    entryFee?: number;
    pot?: number;
    friendsOnly?: boolean;
    creatorUid?: string;
}
