export interface ChallengeDefinition {
    id: string;
    description: string;
    gameMode: 'classic' | 'CTF' | 'any';
    /** Which player stat to check */
    stat: string;
    /** Minimum value needed to complete the challenge */
    target: number;
    /** Bonus currency awarded on completion */
    reward: number;
}

export interface PlayerChallenge {
    challengeId: string;
    description: string;
    target: number;
    reward: number;
    stat: string;
    completed: boolean;
    /** Current progress value (filled at end-game) */
    progress?: number;
}

export interface ChallengeRecord {
    challengeId: string;
    description: string;
    gameId: string;
    completedAt: string;
    reward: number;
}
