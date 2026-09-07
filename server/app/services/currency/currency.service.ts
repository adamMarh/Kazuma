import { firebaseDb } from '@app/config/firebase-admin.config';
import { CosmeticType, getItem } from '@app/services/currency/shop.catalog';
import { Game } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Server } from 'socket.io';

const USERS_COLLECTION = 'users';
const VICTORY_REWARD = 8;
const CONSOLATION_REWARD = 3;
const USERNAME_CACHE_TTL_MS = 60_000;
const WALLET_CACHE_TTL_MS = 15_000;

type OwnedCosmetics = { characters?: string[]; visuals?: string[]; sounds?: string[] };

type Wallet = {
    balance: number;
    owned: { characters: string[]; visuals: string[]; sounds: string[] };
};

// Shape Firestore (ce que tu stockes dans users/{uid})
type UserDoc = {
    currencyBalance?: number;
    ownedCosmetics?: OwnedCosmetics;
};

@Injectable()
export class CurrencyService {
    defaultBalance = 10;
    private readonly logger = new Logger(CurrencyService.name);
    private usernameUidCache = new Map<string, { uid: string; expiresAt: number }>();
    private walletCache = new Map<string, { wallet: Wallet; expiresAt: number }>();

    async getWallet(uid: string): Promise<Wallet> {
        const cached = this.walletCache.get(uid);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.wallet;
        }

        const ref = this.userRef(uid);

        const snap = await ref.get();
        if (!snap.exists) {
            throw new HttpException({ code: 'auth/user-not-found', message: 'User not found.' }, HttpStatus.NOT_FOUND);
        }

        const data = snap.data() as UserDoc;

        if (data.currencyBalance === undefined || data.currencyBalance === null) {
            await ref.update({ currencyBalance: this.defaultBalance });
            const defaultWallet: Wallet = { balance: this.defaultBalance, owned: { characters: [], visuals: [], sounds: [] } };
            this.walletCache.set(uid, { wallet: defaultWallet, expiresAt: Date.now() + WALLET_CACHE_TTL_MS });
            return defaultWallet;
        }

        const wallet = this.toWallet(data);
        this.walletCache.set(uid, { wallet, expiresAt: Date.now() + WALLET_CACHE_TTL_MS });
        return wallet;
    }

    async addBalance(uid: string, delta: number): Promise<Wallet> {
        if (!Number.isFinite(delta)) {
            throw new HttpException({ code: 'currency/invalid-delta', message: 'Invalid amount.' }, HttpStatus.BAD_REQUEST);
        }

        const ref = this.userRef(uid);

        await firebaseDb.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) {
                throw new HttpException({ code: 'auth/user-not-found', message: 'User not found.' }, HttpStatus.NOT_FOUND);
            }

            const data = snap.data() as UserDoc;
            const current = Number(data.currencyBalance ?? 0);
            const next = current + delta;

            if (next < 0) {
                throw new HttpException({ code: 'currency/insufficient-funds', message: 'Insufficient funds.' }, HttpStatus.CONFLICT);
            }

            tx.update(ref, { currencyBalance: next });
        });

        this.walletCache.delete(uid);
        return this.getWallet(uid);
    }

    async buyCosmetic(uid: string, type: CosmeticType, itemId: string): Promise<Wallet> {
        const cleanItemId = (itemId ?? '').trim();
        const item = getItem(type, cleanItemId);

        if (!item) {
            throw new HttpException({ code: 'shop/item-not-found', message: 'Item not found.' }, HttpStatus.NOT_FOUND);
        }

        const ref = this.userRef(uid);

        await firebaseDb.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) {
                throw new HttpException({ code: 'auth/user-not-found', message: 'User not found.' }, HttpStatus.NOT_FOUND);
            }

            const data = snap.data() as UserDoc;
            const balance = Number(data.currencyBalance ?? 0);

            const list = this.getOwnedList(data.ownedCosmetics, type);
            if (list.includes(cleanItemId)) return; // déjà possédé => idempotent

            const next = balance - item.price;
            if (next < 0) {
                throw new HttpException({ code: 'currency/insufficient-funds', message: 'Insufficient funds.' }, HttpStatus.CONFLICT);
            }

            tx.update(ref, {
                currencyBalance: next,
                [`ownedCosmetics.${type}`]: admin.firestore.FieldValue.arrayUnion(cleanItemId),
            });
        });

        this.walletCache.delete(uid);
        return this.getWallet(uid);
    }

    async addBalanceByUsername(username: string, delta: number): Promise<Wallet | null> {
        const cleanUsername = (username ?? '').trim();
        if (!cleanUsername) return null;

        const uid = await this.resolveUidByUsername(cleanUsername);
        if (!uid) return null;

        return this.addBalance(uid, delta);
    }

    async getWalletByUsername(username: string): Promise<Wallet | null> {
        const cleanUsername = (username ?? '').trim();
        if (!cleanUsername) return null;

        const uid = await this.resolveUidByUsername(cleanUsername);
        if (!uid) return null;

        return this.getWallet(uid);
    }

    async hasOwnedSoundByUsername(username: string, soundItemId: string): Promise<boolean> {
        const cleanUsername = (username ?? '').trim();
        if (!cleanUsername) return false;

        const uid = await this.resolveUidByUsername(cleanUsername);
        if (!uid) return false;

        const snap = await this.userRef(uid).get();
        if (!snap.exists) return false;

        const data = snap.data() as UserDoc;
        const sounds = data.ownedCosmetics?.sounds;
        return Array.isArray(sounds) && sounds.includes(soundItemId);
    }

    async applyEndGameRewards(game: Game, server?: Server): Promise<void> {
        this.logger.debug('[CurrencyRewards] applyEndGameRewards called', {
            gameId: game?.gameId,
            ended: game?.ended,
            alreadyDistributed: game?.currencyRewardsDistributed,
            winner: game?.winner,
            playerCount: game?.players?.length,
        });

        if (!game?.ended || game.currencyRewardsDistributed) {
            this.logger.debug('[CurrencyRewards] Skipped — ended:', game?.ended, 'alreadyDistributed:', game?.currencyRewardsDistributed);
            return;
        }

        try {
            const activeHumanPlayers = game.players.filter((player) => !player.isBot && !player.hasLeft);
            this.logger.debug(
                '[CurrencyRewards] Active human players:',
                activeHumanPlayers.map((p) => p.name),
            );

            if (activeHumanPlayers.length === 0) {
                this.logger.debug('[CurrencyRewards] No active human players, skipping');
                game.currencyRewardsDistributed = true;
                return;
            }

            const winners = this.resolveWinners(game, activeHumanPlayers);
            const winnerNames = new Set(winners.map((player) => player.name));
            this.logger.debug('[CurrencyRewards] Winners:', [...winnerNames]);

            // Determine rewards: if there's a pot (entry fee game), distribute pot
            const hasPot = (game.pot ?? 0) > 0;
            const pot = game.pot ?? 0;
            const winnerCount = winners.length;

            await Promise.all(
                activeHumanPlayers.map(async (player) => {
                    let reward: number;
                    if (hasPot) {
                        if (winnerNames.has(player.name)) {
                            // Winners split the pot + base victory reward
                            reward = Math.floor(pot / winnerCount) + VICTORY_REWARD;
                        } else {
                            // Losers get a small consolation (no pot share)
                            reward = Math.floor(CONSOLATION_REWARD / 2);
                        }
                    } else {
                        reward = winnerNames.has(player.name) ? VICTORY_REWARD : CONSOLATION_REWARD;
                    }
                    this.logger.debug(`[CurrencyRewards] Giving ${reward} coins to "${player.name}" (pot=${pot}, hasPot=${hasPot})`);
                    const result = await this.addBalanceByUsername(player.name, reward);
                    if (!result) {
                        this.logger.error(`[CurrencyRewards] addBalanceByUsername returned null for "${player.name}" — user not found in Firestore!`);
                    } else {
                        this.logger.debug(`[CurrencyRewards] Success: "${player.name}" new balance = ${result.balance}`);
                    }
                }),
            );

            game.currencyRewardsDistributed = true;
            this.logger.debug('[CurrencyRewards] Rewards distributed successfully');

            if (server) {
                activeHumanPlayers.forEach((player) => {
                    server.to(player.socketId).emit(GAME_EVENTS.WALLET_UPDATED);
                });
            }
        } catch (error) {
            this.logger.error('[CurrencyRewards] Error distributing rewards:', error);
        }
    }

    private async resolveUidByUsername(username: string): Promise<string | null> {
        const cached = this.usernameUidCache.get(username);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.uid;
        }

        const snap = await firebaseDb.collection(USERS_COLLECTION).where('username', '==', username).limit(1).get();
        if (snap.empty) return null;

        const uid = snap.docs[0].id;
        this.usernameUidCache.set(username, { uid, expiresAt: Date.now() + USERNAME_CACHE_TTL_MS });
        return uid;
    }
    private userRef(uid: string) {
        return firebaseDb.collection(USERS_COLLECTION).doc(uid);
    }

    private resolveWinners(game: Game, activeHumanPlayers: Player[]): Player[] {
        if (game.map.gameMode === 'CTF' && (game.winner === 'red' || game.winner === 'blue')) {
            return activeHumanPlayers.filter((player) => game.teams[game.winner].includes(player.socketId));
        }

        const battleWinners = activeHumanPlayers.filter((player) => (player.battlesWon || 0) >= 3);
        if (battleWinners.length > 0) return battleWinners;

        const maxBattlesWon = Math.max(...activeHumanPlayers.map((player) => player.battlesWon || 0));
        const byBestScore = activeHumanPlayers.filter((player) => (player.battlesWon || 0) === maxBattlesWon);
        if (byBestScore.length > 0) return byBestScore;

        return [activeHumanPlayers[0]];
    }

    private getOwnedList(owned: OwnedCosmetics | undefined, type: CosmeticType): string[] {
        const value = owned?.[type];
        return Array.isArray(value) ? value : [];
    }

    private toWallet(data: UserDoc): Wallet {
        const owned = data.ownedCosmetics ?? {};
        return {
            balance: Number(data.currencyBalance ?? 0),
            owned: {
                characters: owned.characters ?? [],
                visuals: owned.visuals ?? [],
                sounds: owned.sounds ?? [],
            },
        };
    }
}
