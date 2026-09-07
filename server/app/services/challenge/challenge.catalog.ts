import { ChallengeDefinition } from '@common/interfaces/challenge.interface';

export const CHALLENGE_CATALOG: ChallengeDefinition[] = [
    // ── Classic mode challenges ──
    {
        id: 'classic_win_2_combats',
        description: 'Gagner au moins 2 combats',
        gameMode: 'classic',
        stat: 'battlesWon',
        target: 2,
        reward: 5,
    },
    {
        id: 'classic_deal_10_damage',
        description: 'Infliger au moins 10 points de dégâts',
        gameMode: 'classic',
        stat: 'totalDamageDone',
        target: 10,
        reward: 4,
    },
    {
        id: 'classic_visit_50_tiles',
        description: 'Visiter au moins 50% des tuiles',
        gameMode: 'classic',
        stat: 'tilesVisitedPercentage',
        target: 50,
        reward: 4,
    },
    {
        id: 'classic_pick_3_items',
        description: 'Ramasser au moins 3 objets',
        gameMode: 'classic',
        stat: 'itemsPicked',
        target: 3,
        reward: 3,
    },
    {
        id: 'classic_flee_success',
        description: 'Réussir au moins 1 évasion',
        gameMode: 'classic',
        stat: 'successfulFleeAttempts',
        target: 1,
        reward: 3,
    },

    // ── CTF mode challenges ──
    {
        id: 'ctf_hold_flag',
        description: 'Avoir porté le drapeau au moins une fois',
        gameMode: 'CTF',
        stat: 'heldFlag',
        target: 1,
        reward: 5,
    },
    {
        id: 'ctf_win_1_combat',
        description: 'Gagner au moins 1 combat',
        gameMode: 'CTF',
        stat: 'battlesWon',
        target: 1,
        reward: 4,
    },
    {
        id: 'ctf_deal_5_damage',
        description: 'Infliger au moins 5 points de dégâts',
        gameMode: 'CTF',
        stat: 'totalDamageDone',
        target: 5,
        reward: 3,
    },

    // ── Any mode challenges ──
    {
        id: 'any_survive',
        description: 'Terminer la partie sans abandonner',
        gameMode: 'any',
        stat: 'survived',
        target: 1,
        reward: 2,
    },
    {
        id: 'any_play_5_turns',
        description: 'Jouer au moins 5 tours',
        gameMode: 'any',
        stat: 'turnsPlayed',
        target: 5,
        reward: 3,
    },
];

export function getChallengesForMode(gameMode: string): ChallengeDefinition[] {
    const mode = gameMode === 'CTF' ? 'CTF' : 'classic';
    return CHALLENGE_CATALOG.filter((c) => c.gameMode === mode || c.gameMode === 'any');
}

export function pickRandomChallenge(gameMode: string): ChallengeDefinition {
    const pool = getChallengesForMode(gameMode);
    return pool[Math.floor(Math.random() * pool.length)];
}
