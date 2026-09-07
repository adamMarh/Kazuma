import { Player } from './player.interface';

export interface CombatState {
    currentTurn?: any;
    attacker: Player | null;
    target: Player | null;
    inCombat: boolean;
    attackResult: {
        damage: number;
        attackDiceRoll: number;
        defenseDiceRoll: number;
    };
    combatInitiator: Player | null;
    hourglassConsumed: boolean;
    potionConsumed: boolean;
    players?: Player[];
    combatAlreadyCounted?: boolean;
}