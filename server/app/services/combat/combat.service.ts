import { CurrencyService } from '@app/services/currency/currency.service';
import { ItemService } from '@app/services/item/item.service';
import { CombatState } from '@common/interfaces/combatState.interface';
import { Game } from '@common/interfaces/game.interface';
import { ItemType } from '@common/interfaces/item.interface';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/interfaces/position.interface';
import { Injectable, Optional } from '@nestjs/common';

@Injectable()
export class CombatService {
    private combats: Map<string, CombatState> = new Map();
    private defaultHp: Map<string, number> = new Map();

    constructor(
        private readonly itemService: ItemService,
        @Optional() private readonly currencyService?: CurrencyService,
    ) {}

    getCombatState(gameId: string) {
        return this.combats.get(gameId);
    }

    initCombat(player1: Player, player2: Player, game: Game, remake = false): void {
        if (player1.hasLeft || player2.hasLeft) return;
        let combatState;
        if (remake) {
            combatState = this.combats.get(game.gameId);
            if (combatState) {
                combatState.attacker = player1;
                combatState.target = player2;
                combatState.attackResult = { damage: 0, attackDiceRoll: 0, defenseDiceRoll: 0 };
            }
            combatState.combatAlreadyCounted = false;
            this.combats.set(game.gameId, combatState);
            return;
        }
        combatState = this.combats.get(game.gameId) || {
            attacker: null,
            target: null,
            inCombat: false,
            attackResult: { damage: 0, attackDiceRoll: 0, defenseDiceRoll: 0 },
            combatInitiator: null,
            hourglassConsumed: false,
            potionConsumed: false,
        };

        combatState.combatInitiator = player1;
        if (player1.speed > player2.speed) {
            combatState.attacker = player1;
            combatState.target = player2;
        } else if (player2.speed > player1.speed) {
            combatState.attacker = player2;
            combatState.target = player1;
        } else {
            combatState.attacker = player1;
            combatState.target = player2;
        }
        combatState.inCombat = true;
        combatState.combatAlreadyCounted = false;
        player1.actionPoints--;
        game.players.forEach((player) => {
            this.defaultHp[player.socketId] = player.healthpoints;
        });
        this.combats.set(game.gameId, combatState);
    }

    iceAttributesNerf(player: Player, game: Game, attribute: number): number {
        if (game.map.tiles[player.position.x][player.position.y] === 'ice') {
            return (attribute -= 2);
        }
        return attribute;
    }

    iceAttributesReset(player: Player, game: Game, attribute: number): number {
        if (game.map.tiles[player.position.x][player.position.y] === 'ice') {
            return (attribute += 2);
        }
        return attribute;
    }

    switchTurn(combatState: CombatState) {
        let tempPlayer: Player = null;
        tempPlayer = combatState.target;
        combatState.target = combatState.attacker;
        combatState.attacker = tempPlayer;
    }

    // eslint-disable-next-line complexity
    attackOpponent(game: Game): {
        success: boolean;
        message?: string;
        isDead?: boolean;
        combatState?: CombatState;
        drankPotion?: boolean;
        flippedHourglass?: boolean;
    } {
        const combatState = this.combats.get(game.gameId);

        if (!combatState || combatState.attacker?.hasLeft || combatState.target?.hasLeft) return { success: false };
        if (!combatState.combatAlreadyCounted) {
            combatState.attacker.combatsParticipated = (combatState.attacker.combatsParticipated || 0) + 1;
            combatState.target.combatsParticipated = (combatState.target.combatsParticipated || 0) + 1;
            combatState.combatAlreadyCounted = true;
        }
        if (game.isInDebugMode) {
            combatState.attackResult.attackDiceRoll = combatState.attacker.dice.atk;
            combatState.attackResult.defenseDiceRoll = 1;
        } else {
            combatState.attackResult.attackDiceRoll = Math.floor(Math.random() * combatState.attacker.dice.atk) + 1;
            combatState.attackResult.defenseDiceRoll = Math.floor(Math.random() * combatState.target.dice.def) + 1;
        }
        let attackerDamage = combatState.attacker.attack + combatState.attackResult.attackDiceRoll;
        let targetPlayerDefense = combatState.target.defense + combatState.attackResult.defenseDiceRoll;
        targetPlayerDefense = this.iceAttributesNerf(combatState.target, game, targetPlayerDefense);
        attackerDamage = this.iceAttributesNerf(combatState.attacker, game, attackerDamage);
        combatState.attackResult.attackDiceRoll = attackerDamage;
        combatState.attackResult.defenseDiceRoll = targetPlayerDefense;
        combatState.attackResult.damage = attackerDamage - targetPlayerDefense > 0 ? attackerDamage - targetPlayerDefense : 0;
        combatState.target.healthpoints -= combatState.attackResult.damage;
        combatState.attacker.totalDamageDone = (combatState.attacker.totalDamageDone || 0) + combatState.attackResult.damage;
        combatState.target.totalDamageTaken = (combatState.target.totalDamageTaken || 0) + combatState.attackResult.damage;
        targetPlayerDefense = this.iceAttributesReset(combatState.target, game, targetPlayerDefense);
        attackerDamage = this.iceAttributesReset(combatState.attacker, game, attackerDamage);
        let drankPotion = false;
        if (this.itemService.canUsePotion(combatState.target) && !combatState.potionConsumed) {
            combatState.target.healthpoints += 3;
            combatState.potionConsumed = true;
            drankPotion = true;
        }
        let isDead = false;
        let flippedHourglass = false;
        if (combatState.target.healthpoints <= 0) {
            combatState.target.healthpoints = 0;
            isDead = true;
            if (this.itemService.canUseHourglass(combatState.target) && !combatState.hourglassConsumed) {
                const originalTargetHP = this.defaultHp[combatState.target.socketId];
                const originalAttackerHP = this.defaultHp[combatState.attacker.socketId];
                combatState.target.healthpoints = originalTargetHP;
                combatState.attacker.healthpoints = originalAttackerHP;
                isDead = false;
                combatState.hourglassConsumed = true;
                flippedHourglass = true;
            } else {
                combatState.attacker.battlesWon++;
                combatState.target.battlesLost = (combatState.target.battlesLost || 0) + 1;
                this.dropPlayerItems(combatState.target, game);
                combatState.target.position = this.placePlayerAfterCombat(game, combatState.target.startPosition);
                combatState.target.movementPoints = 0;
                combatState.target.actionPoints = 0;
            }
        }
        this.switchTurn(combatState);
        this.combats.set(game.gameId, combatState);
        return { success: true, message: 'Attaque réussie !', isDead, combatState, drankPotion, flippedHourglass };
    }

    placePlayerAfterCombat(game: Game, position: Position) {
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

    dropPlayerItems(player: Player, game: Game): void {
        if (player.inventory.length === 0) return;
        player.inventory.forEach((item) => {
            this.itemService.removeItemEffect(player, item);
        });
        const itemsToPlace = [...player.inventory];
        player.inventory = [];
        player.isInventoryFull = false;
        let radius = 1;
        while (itemsToPlace.length > 0 && radius <= 5) {
            const validPositions = this.getValidDropPositions(player.position, radius, game).sort(() => Math.random() - 0.5);
            for (const pos of validPositions) {
                if (itemsToPlace.length === 0) break;
                game.map.items[pos.y][pos.x] = itemsToPlace.shift() as ItemType;
            }
            radius++;
        }
    }

    isValidDropPosition(x: number, y: number, game: Game): boolean {
        const tile = game.map.tiles[y][x];
        const validTiles = ['grass', 'water', 'ice', 'doorOpen'];
        if (!validTiles.includes(tile)) {
            return false;
        }
        if (game.map.items[y][x] !== 'empty') {
            return false;
        }
        const hasPlayer = game.players.some((p) => !p.hasLeft && p.position.x === x && p.position.y === y);
        return !hasPlayer;
    }

    attemptFlee(game: Game, fleeingPlayer: Player): { fled: boolean; hasCrystal: boolean } {
        const combatState = this.combats.get(game.gameId);
        if (!combatState || !combatState.target) return { fled: false, hasCrystal: false };
        const opponent = combatState.target;
        if (opponent.inventory.includes('crystal') && opponent.battlesWon > 0) {
            this.switchTurn(combatState);
            this.combats.set(game.gameId, combatState);
            return { fled: false, hasCrystal: true };
        }
        if (!combatState.combatAlreadyCounted) {
            combatState.attacker.combatsParticipated = (combatState.attacker.combatsParticipated || 0) + 1;
            combatState.target.combatsParticipated = (combatState.target.combatsParticipated || 0) + 1;
            combatState.combatAlreadyCounted = true;
        }
        const fleeSuccess = Math.random() < 0.3;
        if (fleeSuccess) {
            fleeingPlayer.successfulFleeAttempts = (fleeingPlayer.successfulFleeAttempts || 0) + 1;
            return { fled: true, hasCrystal: false };
        } else {
            fleeingPlayer.fleeAttempts++;
            this.switchTurn(combatState);
            this.combats.set(game.gameId, combatState);
            return { fled: false, hasCrystal: false };
        }
    }

    endCombat(game: Game, actionPlayer: Player): { combatState?: CombatState; actionPlayer?: Player; gameEnded?: boolean } {
        const combatState = this.combats.get(game.gameId);
        let gameEnded = false;
        game.players.forEach((player) => {
            player.healthpoints = this.defaultHp[player.socketId];
            if (game.map.gameMode !== 'CTF' && player.battlesWon === 3) {
                gameEnded = true;
                game.ended = true;
                game.winner = player.name;
                return { combatState, actionPlayer, gameEnded };
            }
            if (game.map.gameMode !== 'CTF' && game.eliminatedPlayers.length === game.players.length - 1) {
                gameEnded = true;
                game.ended = true;
                return { combatState, actionPlayer, gameEnded };
            }
        });
        combatState.inCombat = false;
        combatState.attacker.fleeAttempts = 0;
        combatState.target.fleeAttempts = 0;
        combatState.attacker = null;
        combatState.target = null;
        combatState.attackResult = { damage: 0, attackDiceRoll: 0, defenseDiceRoll: 0 };
        combatState.hourglassConsumed = false;
        combatState.potionConsumed = false;
        combatState.combatAlreadyCounted = false;
        this.combats.set(game.gameId, combatState);
        game.endTime = new Date();
        return { combatState, actionPlayer, gameEnded };
    }

    validPlayersPositions(position1: Position, position2: Position): boolean {
        return (
            (Math.abs(position1.x - position2.x) === 1 && position1.y === position2.y) ||
            (Math.abs(position1.y - position2.y) === 1 && position1.x === position2.x)
        );
    }

    private getValidDropPositions(center: Position, radius: number, game: Game): Position[] {
        const validPositions: Position[] = [];
        for (let y = center.y - radius; y <= center.y + radius; y++) {
            for (let x = center.x - radius; x <= center.x + radius; x++) {
                if (Math.max(Math.abs(x - center.x), Math.abs(y - center.y)) !== radius) {
                    continue;
                }
                if (this.isValidDropPosition(x, y, game)) {
                    validPositions.push({ x, y });
                }
            }
        }
        return validPositions;
    }
}
