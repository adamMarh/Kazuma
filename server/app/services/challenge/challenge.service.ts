import { firebaseDb } from '@app/config/firebase-admin.config';
import { pickRandomChallenge } from '@app/services/challenge/challenge.catalog';
import { ChallengeRecord, PlayerChallenge } from '@common/interfaces/challenge.interface';
import { Game } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { Injectable } from '@nestjs/common';

const USERS_COLLECTION = 'users';
const USERNAME_CACHE_TTL_MS = 60_000;

/**
 * In-memory map: socketId -> PlayerChallenge
 * Assigned at game start, evaluated at game end.
 */
@Injectable()
export class ChallengeService {
    private activeChallenges = new Map<string, PlayerChallenge>();
    private usernameUidCache = new Map<string, { uid: string; expiresAt: number }>();

    /**
     * Assign a random challenge to a player based on the game mode.
     * Returns the assigned challenge.
     */
    assignChallenge(socketId: string, gameMode: string): PlayerChallenge {
        const def = pickRandomChallenge(gameMode);
        const challenge: PlayerChallenge = {
            challengeId: def.id,
            description: def.description,
            target: def.target,
            reward: def.reward,
            stat: def.stat,
            completed: false,
        };
        this.activeChallenges.set(socketId, challenge);
        return challenge;
    }

    getChallenge(socketId: string): PlayerChallenge | undefined {
        return this.activeChallenges.get(socketId);
    }

    /**
     * Evaluate the challenge for a player at end-of-game.
     * Returns the updated challenge with progress and completion.
     */
    evaluateChallenge(socketId: string, player: Player, game: Game): PlayerChallenge | null {
        const challenge = this.activeChallenges.get(socketId);
        if (!challenge) return null;

        const progress = this.getStatValue(challenge.stat, player, game);
        challenge.progress = progress;
        challenge.completed = progress >= challenge.target;

        return challenge;
    }

    /**
     * Persist a completed challenge to Firestore and give the reward.
     */
    async persistCompletedChallenge(username: string, challenge: PlayerChallenge, gameId: string): Promise<number> {
        const uid = await this.resolveUidByUsername(username);
        if (!uid) return 0;

        const ref = firebaseDb.collection(USERS_COLLECTION).doc(uid);

        const record: ChallengeRecord = {
            challengeId: challenge.challengeId,
            description: challenge.description,
            gameId,
            completedAt: new Date().toISOString(),
            reward: challenge.reward,
        };

        await ref.update({
            completedChallenges: (await import('firebase-admin')).firestore.FieldValue.arrayUnion(record),
            currencyBalance: (await import('firebase-admin')).firestore.FieldValue.increment(challenge.reward),
        });

        return challenge.reward;
    }

    /**
     * Get the challenge history for a user from Firestore.
     */
    async getChallengeHistory(username: string): Promise<ChallengeRecord[]> {
        const uid = await this.resolveUidByUsername(username);
        if (!uid) return [];

        const doc = await firebaseDb.collection(USERS_COLLECTION).doc(uid).get();
        if (!doc.exists) return [];
        const data = doc.data();
        return (data.completedChallenges as ChallengeRecord[]) ?? [];
    }

    /**
     * Clean up challenges for a game (call after distribution).
     */
    clearChallenges(socketIds: string[]): void {
        socketIds.forEach((id) => this.activeChallenges.delete(id));
    }

    private async resolveUidByUsername(username: string): Promise<string | null> {
        const cached = this.usernameUidCache.get(username);
        if (cached && Date.now() < cached.expiresAt) return cached.uid;
        const snapshot = await firebaseDb.collection(USERS_COLLECTION).where('username', '==', username).limit(1).get();
        if (snapshot.empty) return null;
        const uid = snapshot.docs[0].id;
        this.usernameUidCache.set(username, { uid, expiresAt: Date.now() + USERNAME_CACHE_TTL_MS });
        return uid;
    }

    private getStatValue(stat: string, player: Player, game: Game): number {
        switch (stat) {
            case 'battlesWon':
                return player.battlesWon ?? 0;
            case 'totalDamageDone':
                return player.totalDamageDone ?? 0;
            case 'tilesVisitedPercentage': {
                const totalTiles = parseInt(game.map.size, 10) ** 2;
                const visited = player.visitedTiles?.length ?? 0;
                return totalTiles > 0 ? Math.round((visited / totalTiles) * 100) : 0;
            }
            case 'itemsPicked':
                return player.collectedUniqueItems?.length ?? 0;
            case 'successfulFleeAttempts':
                return player.successfulFleeAttempts ?? 0;
            case 'heldFlag':
                return player.hasHeldFlag ? 1 : 0;
            case 'survived':
                return player.hasLeft ? 0 : 1;
            case 'turnsPlayed':
                return player.turnsPlayed ?? 0;
            case 'battlesLost':
                return player.battlesLost ?? 0;
            case 'combatsParticipated':
                return player.combatsParticipated ?? 0;
            default:
                return 0;
        }
    }
}
