/* eslint-disable @typescript-eslint/member-ordering */
import { ID_BASE, MULTIPLIER } from '@app/constants/lobby';
import { MapsService } from '@app/services/maps/maps.service';
import { Attribute } from '@common/interfaces/attribute.interface';
import { Game } from '@common/interfaces/game.interface';
import { Map } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { Team } from '@common/interfaces/team.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class LobbyService {
    private selectedAvatars: Record<string, string> = {};
    private readonly botNames = ['Maes', 'Ninho', 'SDM', 'Booba', 'Dems'];
    private readonly avatars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    constructor(private mapService: MapsService) {}

    private generateGameId(games: { [gameId: string]: Game }): string {
        let id = '';
        do {
            id = Math.floor(ID_BASE + Math.random() * MULTIPLIER).toString();
        } while (games[id]);
        return id;
    }

    /**
     * DRY: Helper method to create a new player object.
     */
    private createPlayer(
        socketId: string,
        name: string,
        avatar: string,
        speed: number,
        attack: number,
        defense: number,
        healthpoints: number,
        diceAtk: number,
        diceDef: number,
        isAdmin: boolean,
        additionalProps?: Partial<Player>,
        actionPoints: number = 1,
    ): Player {
        return {
            socketId,
            name,
            avatar,
            speed,
            attack,
            defense,
            healthpoints,
            position: { x: 0, y: 0 },
            startPosition: { x: 0, y: 0 },
            battlesWon: 0,
            inventory: [],
            isAdmin,
            isInventoryFull: false,
            dice: {
                atk: diceAtk,
                def: diceDef,
            },
            isMyTurn: false,
            movementPoints: speed,
            actionPoints,
            fleeAttempts: 0,
            isEliminated: false,
            ...additionalProps,
        };
    }

    createGame(
        clientId: string,
        games: { [gameId: string]: Game },
        payload: {
            name: string;
            avatar: number;
            map: Map;
            attributes: Record<string, Attribute>;
            entryFee?: number;
            friendsOnly?: boolean;
            creatorUid?: string;
        },
    ): Game {
        const gameId = this.generateGameId(games);
        const mapActionPoints = payload.map.actionPoints || 1;
        const admin = this.createPlayer(
            clientId,
            payload.name,
            payload.avatar.toString(),
            payload.attributes.spd.value,
            payload.attributes.atk.value,
            payload.attributes.def.value,
            payload.attributes.hp.value,
            payload.attributes.atk.dice,
            payload.attributes.def.dice,
            true,
            undefined,
            mapActionPoints,
        );
        const map = this.processRandomItems(payload.map);
        const startingPoints = this.mapService.getStartingPoints(map);
        const maxPlayers = map.size === '15' ? 4 : map.size === '20' ? 6 : 2;
        const entryFee = payload.entryFee && payload.entryFee > 0 ? payload.entryFee : 0;
        const game: Game = {
            gameId,
            players: [admin],
            inactivePlayers: [],
            eliminatedPlayers: [],
            map,
            isLocked: false,
            dropInActive: false,
            fastEliminationActive: false,
            started: false,
            ended: false,
            maxPlayers,
            playerTurns: [admin.socketId],
            currentPlayerIndex: 0,
            startingPoints,
            selectedAvatars: { [clientId]: payload.avatar },
            isInDebugMode: false,
            teams: {
                red: [],
                blue: [],
            },
            winner: '',
            currencyRewardsDistributed: false,
            entryFee,
            pot: entryFee,
            friendsOnly: !!payload.friendsOnly,
            creatorUid: payload.creatorUid || '',
        };
        return game;
    }

    joinGame(clientId: string, game: Game, name: string, avatar: number, attributes: Record<string, Attribute>): void {
        const uniqueName = this.generateUniqueName(name, game);
        const mapActionPoints = game.map.actionPoints || 1;
        const newPlayer = this.createPlayer(
            clientId,
            uniqueName,
            avatar.toString(),
            attributes.spd.value,
            attributes.atk.value,
            attributes.def.value,
            attributes.hp.value,
            attributes.atk.dice,
            attributes.def.dice,
            false,
            undefined,
            mapActionPoints,
        );
        game.players.push(newPlayer);
        game.playerTurns.push(newPlayer.socketId);
        game.selectedAvatars[clientId] = avatar;
        if (game.players.length >= game.maxPlayers) {
            game.isLocked = true;
        }
    }

    addBot(isAggressive: boolean, game: Game): void {
        const botName = this.generateUniqueBotName(game);
        const speed = this.getRandomStat();
        const healthpoints = 10 - speed;
        const attack = this.getRandomStat();
        const defense = 10 - attack;
        const diceAtk = this.getRandomStat();
        const diceDef = 10 - diceAtk;
        const avatar = this.getUniqueAvatar(game);
        const mapActionPoints = game.map.actionPoints || 1;

        const botPlayer = this.createPlayer(
            botName,
            botName,
            avatar.toString(),
            speed,
            attack,
            defense,
            healthpoints,
            diceAtk,
            diceDef,
            false,
            {
                isBot: true,
                isAgressive: isAggressive,
            },
            mapActionPoints,
        );
        game.players.push(botPlayer);
        game.playerTurns.push(botPlayer.socketId);
        game.selectedAvatars[botName] = avatar;
        if (game.players.length >= game.maxPlayers) {
            game.isLocked = true;
        }
    }

    private processRandomItems(originalMap: Map): Map {
        type ItemType = 'shield' | 'lance' | 'potion' | 'crystal' | 'compas' | 'hourglass';
        const allItems: ItemType[] = ['shield', 'lance', 'potion', 'crystal', 'compas', 'hourglass'];
        const processedMap = JSON.parse(JSON.stringify(originalMap)) as Map;
        const existingItems = new Set<ItemType>();
        processedMap.items.forEach((row) => {
            row.forEach((item) => {
                if (item !== 'random' && item !== 'empty' && item !== 'checkpoint' && item !== 'hidden_checkpoint') {
                    existingItems.add(item as ItemType);
                }
            });
        });
        const availableItems = allItems.filter((item) => !existingItems.has(item));
        processedMap.items.forEach((row, y) => {
            row.forEach((item, x) => {
                if (item === 'random' && availableItems.length > 0) {
                    const randomIndex = Math.floor(Math.random() * availableItems.length);
                    const selectedItem = availableItems[randomIndex];
                    processedMap.items[y][x] = selectedItem;
                    availableItems.splice(randomIndex, 1);
                }
            });
        });
        return processedMap;
    }

    removePlayer(game: Game, socketId: string) {
        const turnIndex = game.playerTurns.findIndex((player) => player === socketId);
        const removedPlayer = game.players.find((player) => player.socketId === socketId);
        if (game.selectedAvatars[socketId]) {
            delete game.selectedAvatars[socketId];
        }
        game.players = game.players.filter((player) => player.socketId !== socketId);
        if (turnIndex !== -1) {
            game.playerTurns.splice(turnIndex, 1);
            if (game.playerTurns.length > 0) {
                if (turnIndex < game.currentPlayerIndex) {
                    game.currentPlayerIndex--;
                } else if (turnIndex === game.currentPlayerIndex) {
                    if (game.currentPlayerIndex >= game.playerTurns.length) {
                        game.currentPlayerIndex = 0;
                    }
                }
            } else {
                game.currentPlayerIndex = 0;
            }
        }
        if (removedPlayer) {
            game.map.items[removedPlayer.position.y][removedPlayer.position.x] = 'empty';
        }
    }

    lockRoom(game: Game, adminSocketId: string): boolean {
        const admin = game.players.find((p) => p.socketId === adminSocketId && p.isAdmin);
        if (!admin) return false;
        game.isLocked = true;
        return true;
    }

    unlockRoom(game: Game, adminSocketId: string): boolean {
        const admin = game.players.find((p) => p.socketId === adminSocketId && p.isAdmin);
        if (!admin) return false;
        if (game.players.length < game.maxPlayers) {
            game.isLocked = false;
            return true;
        }
        return false;
    }

    activateDropIn(game: Game, adminSocketId: string): boolean {
        const admin = game.players.find((p) => p.socketId === adminSocketId && p.isAdmin);
        if (!admin) return false;
        game.dropInActive = true;
        return true;
    }

    deactivateDropIn(game: Game, adminSocketId: string): boolean {
        const admin = game.players.find((p) => p.socketId === adminSocketId && p.isAdmin);
        if (!admin) return false;
        game.dropInActive = false;
        return true;
    }

    activateFastElimination(game: Game, adminSocketId: string): boolean {
        const admin = game.players.find((p) => p.socketId === adminSocketId && p.isAdmin);
        if (!admin) return false;
        game.fastEliminationActive = true;
        return true;
    }

    deactivateFastElimination(game: Game, adminSocketId: string): boolean {
        const admin = game.players.find((p) => p.socketId === adminSocketId && p.isAdmin);
        if (!admin) return false;
        game.fastEliminationActive = false;
        return true;
    }

    generateUniqueName(name: string, game: Game): string {
        const initialName = name;
        let uniqueName = initialName;
        const existingNames = new Set(game.players.map((player) => player.name));
        for (let i = 2; existingNames.has(uniqueName) && i < 100; i++) {
            uniqueName = `${initialName}-${i}`;
        }
        return uniqueName;
    }

    private getRandomStat(): number {
        return Math.random() < 0.5 ? 4 : 6;
    }

    private shuffleArray<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    private generateUniqueBotName(game: Game): string {
        const shuffledNames = this.shuffleArray([...this.botNames]);
        for (const botName of shuffledNames) {
            if (!game.players.some((player) => player.name === botName)) {
                return botName;
            }
        }
        return this.botNames[Math.floor(Math.random() * this.botNames.length)];
    }

    private getUniqueAvatar(game: Game): number {
        const shuffledAvatars = this.shuffleArray([...this.avatars]);
        for (const avatar of shuffledAvatars) {
            if (!Object.values(game.selectedAvatars).includes(avatar)) {
                return avatar;
            }
        }
        return this.avatars[Math.floor(Math.random() * this.avatars.length)];
    }

    generateTeams(game: Game): Team {
        if (game.map.gameMode !== 'CTF') {
            return;
        }
        if (game.players.length % 2 !== 0 && !game.started) {
            throw new Error('Impossible de démarrer. Nombre de joueurs impair');
        }
        if (!game.started) {
            const shuffledPlayers = game.players.map((player) => player.socketId).sort(() => Math.random() - 0.5);
            const half = shuffledPlayers.length / 2;
            const teamRed = shuffledPlayers.slice(0, half);
            const teamBlue = shuffledPlayers.slice(half);
            return { red: teamRed, blue: teamBlue };
        } else {
            this.rebalanceTeams(game);
        }
    }

    rebalanceTeams(game: Game) {
        const playersWithoutTeam = game.players
            .filter((player) => !game.teams.red.includes(player.socketId) && !game.teams.blue.includes(player.socketId))
            .map((player) => player.socketId);

        for (const socketId of playersWithoutTeam) {
            if (game.teams.red.length <= game.teams.blue.length) {
                game.teams.red.push(socketId);
            } else {
                game.teams.blue.push(socketId);
            }
        }
    }
}
