import { Game } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';

export const MIN_ALLOWED_NUMBER = 0;
export const MAX_ALLOWED_NUMBER = 9;
export const ASCII_A = 65;
export const ASCII_Z = 90;

export const ALLOWED_ELEMENTS = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
export const SPECIAL_CHARS = ['!', '#', '$', '%', '^', '*', '@', '&', '(', ')'];
export const ALLOWED_NUMBERS = /^[0-9]$/;

export const ID_TEST = '1234';
export const NAME_TEST = 'player123';
export const AVATAR_NUM_TEST = 6;
export const ERROR = 'Error';
export const MOCK_GAME: Game = {
    gameId: '1234',
    players: [],
    inactivePlayers: [],
    eliminatedPlayers: [],
    map: {
        _id: '1',
        name: 'Test Map',
        size: '4',
        gameMode: 'Mode1',
        description: '',
        lastSave: new Date(),
        imageUrl: '',
        visibility: 'public',
        owner: 'testOwner',
        tiles: [],
        items: [],
        nbCheckpoints: '',
        nbRandomItems: '',
    },
    isLocked: false,
    dropInActive: false,
    fastEliminationActive: false,
    started: false,
    ended: false,
    maxPlayers: 4,
    playerTurns: [],
    currentPlayerIndex: 0,
    startingPoints: [],
    selectedAvatars: {},
    isInDebugMode: false,
    teams: {
        red: [],
        blue: [],
    },
    winner: '',
};

export const MOCK_PLAYER: Player = {
    socketId: 'abc123',
    name: 'player123',
    avatar: 'avatar1.png',
    speed: 3,
    defense: 4,
    attack: 5,
    healthpoints: 10,
    position: { x: 0, y: 0 },
    startPosition: { x: 0, y: 0 },
    fleeAttempts: 0,
    battlesWon: 0,
    inventory: [],
    isInventoryFull: false,
    dice: { atk: 6, def: 4 },
    isMyTurn: false,
    movementPoints: 3,
    actionPoints: 2,
    isEliminated: false,
};

export const MOCK_JOIN_RESPONSE = {
    game: MOCK_GAME,
    myPlayer: MOCK_PLAYER,
};

export const MOCK_PLAYER_DATA = {
    name: 'player123',
    avatar: 6,
    attributes: [{ name: 'def', value: 6, dice: 4 }],
};
