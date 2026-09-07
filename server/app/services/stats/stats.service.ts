import { firebaseDb } from '@app/config/firebase-admin.config';
import { Game } from '@common/interfaces/game.interface';
import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

const USERS_COLLECTION = 'users';
const USERNAME_CACHE_TTL_MS = 60_000;

export interface AccountStats {
    gamesPlayedClassic: number;
    gamesPlayedCTF: number;
    gamesWon: number;
    totalGameTimeMs: number;
}

@Injectable()
export class StatsService {
    private readonly logger = new Logger(StatsService.name);
    private savedGames = new Set<string>();
    private usernameUidCache = new Map<string, { uid: string; expiresAt: number }>();
    async persistGameStats(game: Game): Promise<void> {
        if (!game || !game.gameId || this.savedGames.has(game.gameId)) return;
        this.savedGames.add(game.gameId);

        const isClassic = game.map.gameMode !== 'CTF';
        const startMs = game.startTime ? new Date(game.startTime as unknown as string).getTime() : 0;
        const endMs = game.endTime ? new Date(game.endTime as unknown as string).getTime() : Date.now();
        const durationMs = startMs > 0 ? Math.max(endMs - startMs, 0) : 0;

        // Determine winning socket IDs
        const winnerSocketIds = new Set<string>();
        if (isClassic) {
            const winner = game.players.find((p) => p.battlesWon >= 3);
            if (winner) winnerSocketIds.add(winner.socketId);
        } else if (game.winner === 'red') {
            game.teams?.red?.forEach((id) => winnerSocketIds.add(id));
        } else if (game.winner === 'blue') {
            game.teams?.blue?.forEach((id) => winnerSocketIds.add(id));
        }

        // Collect unique human players (active + inactive)
        const allPlayers = [...game.players, ...(game.inactivePlayers || [])];
        const uniqueHumans = new Map<string, (typeof allPlayers)[0]>();
        for (const p of allPlayers) {
            if (!p.isBot && !uniqueHumans.has(p.name)) {
                uniqueHumans.set(p.name, p);
            }
        }

        for (const [playerName, player] of uniqueHumans) {
            try {
                const uid = await this.resolveUidByUsername(playerName);
                if (!uid) continue;

                const userDoc = firebaseDb.collection(USERS_COLLECTION).doc(uid);
                const isWinner = winnerSocketIds.has(player.socketId);

                const updateData: Record<string, unknown> = {};
                if (isClassic) {
                    updateData['stats.gamesPlayedClassic'] = admin.firestore.FieldValue.increment(1);
                } else {
                    updateData['stats.gamesPlayedCTF'] = admin.firestore.FieldValue.increment(1);
                }
                if (isWinner) {
                    updateData['stats.gamesWon'] = admin.firestore.FieldValue.increment(1);
                }
                updateData['stats.totalGameTimeMs'] = admin.firestore.FieldValue.increment(durationMs);

                await userDoc.update(updateData);
            } catch (e) {
                this.logger.warn(`Failed to persist stats for player ${playerName}: ${e}`);
            }
        }
    }

    async getStats(uid: string): Promise<AccountStats> {
        const doc = await firebaseDb.collection(USERS_COLLECTION).doc(uid).get();
        if (!doc.exists) {
            return { gamesPlayedClassic: 0, gamesPlayedCTF: 0, gamesWon: 0, totalGameTimeMs: 0 };
        }
        const data = doc.data() as { stats?: Partial<AccountStats> };
        return {
            gamesPlayedClassic: data.stats?.gamesPlayedClassic ?? 0,
            gamesPlayedCTF: data.stats?.gamesPlayedCTF ?? 0,
            gamesWon: data.stats?.gamesWon ?? 0,
            totalGameTimeMs: data.stats?.totalGameTimeMs ?? 0,
        };
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
}
