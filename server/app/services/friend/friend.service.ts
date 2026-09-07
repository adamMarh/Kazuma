import { firebaseDb } from '@app/config/firebase-admin.config';
import { FriendEntry, FriendRequest, UserProfile } from '@common/interfaces/friend.interface';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'events';

const USERS_COLLECTION = 'users';
const FRIEND_REQUESTS_COLLECTION = 'friend_requests';
const FRIENDS_COLLECTION = 'friends';
const USERNAME_CACHE_TTL_MS = 60_000;
const SEARCH_CACHE_TTL_MS = 30_000;
const SEARCH_RESULTS_LIMIT = 20;

@Injectable()
export class FriendService extends EventEmitter implements OnModuleInit {
    private readonly logger = new Logger(FriendService.name);
    private usernameUidCache = new Map<string, { uid: string; expiresAt: number }>();
    private searchCache = new Map<string, { results: UserProfile[]; expiresAt: number }>();
    private friendIdsCache = new Map<string, { uids: Set<string>; expiresAt: number }>();
    private userDocCache = new Map<string, { data: { username: string }; expiresAt: number }>();

    onModuleInit() {
        this.listenForNewUsers();
    }

    async sendFriendRequest(fromUid: string, toUid: string): Promise<FriendRequest> {
        const fromData = await this.getUserDoc(fromUid);
        const toData = await this.getUserDoc(toUid);

        if (!fromData || !toData) {
            throw new Error('Utilisateur introuvable.');
        }

        const existing = await firebaseDb
            .collection(FRIEND_REQUESTS_COLLECTION)
            .where('fromUid', '==', fromUid)
            .where('toUid', '==', toUid)
            .where('status', '==', 'pending')
            .get();

        if (!existing.empty) {
            throw new Error('Une demande est déjà en attente.');
        }

        const reverse = await firebaseDb
            .collection(FRIEND_REQUESTS_COLLECTION)
            .where('fromUid', '==', toUid)
            .where('toUid', '==', fromUid)
            .where('status', '==', 'pending')
            .get();

        if (!reverse.empty) {
            throw new Error('Cet utilisateur vous a déjà envoyé une demande.');
        }

        const alreadyFriends = await this.areFriends(fromUid, toUid);
        if (alreadyFriends) {
            throw new Error('Vous êtes déjà amis.');
        }

        const requestRef = firebaseDb.collection(FRIEND_REQUESTS_COLLECTION).doc();
        const request: FriendRequest = {
            id: requestRef.id,
            fromUid,
            fromUsername: fromData.username,
            toUid,
            toUsername: toData.username,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };

        await requestRef.set(request);
        this.logger.log(`Friend request sent: ${fromData.username} -> ${toData.username}`);
        return request;
    }

    async acceptFriendRequest(requestId: string, userUid: string): Promise<FriendRequest> {
        const requestRef = firebaseDb.collection(FRIEND_REQUESTS_COLLECTION).doc(requestId);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
            throw new Error('Demande introuvable.');
        }

        const request = requestDoc.data() as FriendRequest;

        if (request.toUid !== userUid) {
            throw new Error("Vous n'êtes pas autorisé Ã  accepter cette demande.");
        }

        if (request.status !== 'pending') {
            throw new Error('Cette demande a déjà  été traitée.');
        }

        await requestRef.update({ status: 'accepted' });

        const now = new Date().toISOString();

        const friendEntry1: FriendEntry = {
            uid: request.toUid,
            username: request.toUsername,
            addedAt: now,
        };

        const friendEntry2: FriendEntry = {
            uid: request.fromUid,
            username: request.fromUsername,
            addedAt: now,
        };

        await firebaseDb.collection(FRIENDS_COLLECTION).doc(request.fromUid).collection('list').doc(request.toUid).set(friendEntry1);

        await firebaseDb.collection(FRIENDS_COLLECTION).doc(request.toUid).collection('list').doc(request.fromUid).set(friendEntry2);

        this.logger.log(`Friend request accepted: ${request.fromUsername} <-> ${request.toUsername}`);
        return { ...request, status: 'accepted' };
    }

    async declineFriendRequest(requestId: string, userUid: string): Promise<FriendRequest> {
        const requestRef = firebaseDb.collection(FRIEND_REQUESTS_COLLECTION).doc(requestId);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
            throw new Error('Demande introuvable.');
        }

        const request = requestDoc.data() as FriendRequest;

        if (request.toUid !== userUid) {
            throw new Error("Vous n'Ãªtes pas autorisé à refuser cette demande.");
        }

        if (request.status !== 'pending') {
            throw new Error('Cette demande a déjà  été traitée.');
        }

        await requestRef.update({ status: 'declined' });
        this.logger.log(`Friend request declined: ${request.fromUsername} -> ${request.toUsername}`);
        return { ...request, status: 'declined' };
    }

    async removeFriend(userUid: string, friendUid: string): Promise<void> {
        await firebaseDb.collection(FRIENDS_COLLECTION).doc(userUid).collection('list').doc(friendUid).delete();
        await firebaseDb.collection(FRIENDS_COLLECTION).doc(friendUid).collection('list').doc(userUid).delete();

        this.logger.log(`Friend removed: ${userUid} <-> ${friendUid}`);
    }

    async getFriends(userUid: string): Promise<FriendEntry[]> {
        const snapshot = await firebaseDb.collection(FRIENDS_COLLECTION).doc(userUid).collection('list').orderBy('addedAt', 'desc').get();

        return snapshot.docs.map((doc) => doc.data() as FriendEntry);
    }

    async getPendingRequests(userUid: string): Promise<FriendRequest[]> {
        const snapshot = await firebaseDb
            .collection(FRIEND_REQUESTS_COLLECTION)
            .where('toUid', '==', userUid)
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map((doc) => doc.data() as FriendRequest);
    }

    async searchUsers(query: string, currentUid: string): Promise<UserProfile[]> {
        if (!query || query.trim().length < 2) {
            return [];
        }

        const cacheKey = query.trim();

        const friendUids = await this.getFriendUids(currentUid);
        const blockedByMe = await this.getBlockedUsers(currentUid);
        const blockedMe = await this.getUsersWhoBlocked(currentUid);

        const cached = this.searchCache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
            return cached.results.filter((u) => !friendUids.has(u.uid) && !blockedByMe.has(u.uid) && !blockedMe.has(u.uid));
        }

        // Prefix range query: matches usernames starting with the query string
        const end = cacheKey + '\uf8ff';
        const snapshot = await firebaseDb
            .collection(USERS_COLLECTION)
            .where('username', '>=', cacheKey)
            .where('username', '<=', end)
            .limit(SEARCH_RESULTS_LIMIT)
            .get();

        const allMatches: UserProfile[] = snapshot.docs.map((doc) => {
            const data = doc.data() as { username?: string };
            return { uid: doc.id, username: data.username ?? '' };
        });

        this.searchCache.set(cacheKey, { results: allMatches, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
        return allMatches.filter((u) => !friendUids.has(u.uid) && !blockedByMe.has(u.uid) && !blockedMe.has(u.uid));
    }

    async areFriends(uid1: string, uid2: string): Promise<boolean> {
        const doc = await firebaseDb.collection(FRIENDS_COLLECTION).doc(uid1).collection('list').doc(uid2).get();

        return doc.exists;
    }

    async getUidByUsername(username: string): Promise<string | null> {
        const cached = this.usernameUidCache.get(username);
        if (cached && Date.now() < cached.expiresAt) return cached.uid;
        const snapshot = await firebaseDb.collection(USERS_COLLECTION).where('username', '==', username).limit(1).get();
        if (snapshot.empty) return null;
        const uid = snapshot.docs[0].id;
        this.usernameUidCache.set(username, { uid, expiresAt: Date.now() + USERNAME_CACHE_TTL_MS });
        return uid;
    }

    async blockUser(blockerUid: string, blockedUid: string): Promise<void> {
        if (blockerUid === blockedUid) {
            throw new Error('Vous ne pouvez pas vous bloquer vous-même.');
        }

        const batch = firebaseDb.batch();

        const blockRef = firebaseDb.collection(USERS_COLLECTION).doc(blockerUid).collection('blockedUsers').doc(blockedUid);
        batch.set(blockRef, { blockedAt: new Date().toISOString() });

        const friendRef1 = firebaseDb.collection(FRIENDS_COLLECTION).doc(blockerUid).collection('list').doc(blockedUid);
        const friendRef2 = firebaseDb.collection(FRIENDS_COLLECTION).doc(blockedUid).collection('list').doc(blockerUid);
        batch.delete(friendRef1);
        batch.delete(friendRef2);

        await batch.commit();

        this.friendIdsCache.delete(blockerUid);
        this.friendIdsCache.delete(blockedUid);

        this.logger.log(`User blocked: ${blockerUid} blocked ${blockedUid}`);
    }

    async unblockUser(blockerUid: string, blockedUid: string): Promise<void> {
        await firebaseDb.collection(USERS_COLLECTION).doc(blockerUid).collection('blockedUsers').doc(blockedUid).delete();
        this.logger.log(`User unblocked: ${blockerUid} unblocked ${blockedUid}`);
    }

    async getBlockedUsers(uid: string): Promise<Set<string>> {
        const snapshot = await firebaseDb.collection(USERS_COLLECTION).doc(uid).collection('blockedUsers').get();
        return new Set(snapshot.docs.map((doc) => doc.id));
    }

    async getBlockedUsersList(uid: string): Promise<UserProfile[]> {
        const snapshot = await firebaseDb.collection(USERS_COLLECTION).doc(uid).collection('blockedUsers').get();
        const profiles: UserProfile[] = [];
        for (const doc of snapshot.docs) {
            const userData = await this.getUserDoc(doc.id);
            if (userData) {
                profiles.push({ uid: doc.id, username: userData.username });
            }
        }
        return profiles;
    }

    async getUsersWhoBlocked(uid: string): Promise<Set<string>> {
        const snapshot = await firebaseDb.collectionGroup('blockedUsers').get();
        const blockers = new Set<string>();
        for (const doc of snapshot.docs) {
            if (doc.id === uid) {
                const parentRef = doc.ref.parent.parent;
                if (parentRef) {
                    blockers.add(parentRef.id);
                }
            }
        }
        return blockers;
    }

    async isBlocked(blockerUid: string, blockedUid: string): Promise<boolean> {
        const doc = await firebaseDb.collection(USERS_COLLECTION).doc(blockerUid).collection('blockedUsers').doc(blockedUid).get();
        return doc.exists;
    }

    async hasBlockRelationship(uid1: string, uid2: string): Promise<boolean> {
        const [blocked1, blocked2] = await Promise.all([this.isBlocked(uid1, uid2), this.isBlocked(uid2, uid1)]);
        return blocked1 || blocked2;
    }

    async deleteUserData(uid: string): Promise<void> {
        // Remove uid from each friend's list and delete the user's own friend list
        const friendsSnapshot = await firebaseDb.collection(FRIENDS_COLLECTION).doc(uid).collection('list').get();
        await Promise.all([
            ...friendsSnapshot.docs.map(async (doc) => firebaseDb.collection(FRIENDS_COLLECTION).doc(doc.id).collection('list').doc(uid).delete()),
            ...friendsSnapshot.docs.map(async (doc) => doc.ref.delete()),
        ]);

        // Delete all friend requests involving this user
        const [sentRequests, receivedRequests] = await Promise.all([
            firebaseDb.collection(FRIEND_REQUESTS_COLLECTION).where('fromUid', '==', uid).get(),
            firebaseDb.collection(FRIEND_REQUESTS_COLLECTION).where('toUid', '==', uid).get(),
        ]);
        await Promise.all([...sentRequests.docs, ...receivedRequests.docs].map(async (doc) => doc.ref.delete()));

        // Delete the user's own blocked list
        const blockedSnapshot = await firebaseDb.collection(USERS_COLLECTION).doc(uid).collection('blockedUsers').get();
        await Promise.all(blockedSnapshot.docs.map(async (doc) => doc.ref.delete()));

        // Remove uid from anyone who blocked them
        const blockedBySnapshot = await firebaseDb.collectionGroup('blockedUsers').get();
        await Promise.all(blockedBySnapshot.docs.filter((doc) => doc.id === uid).map(async (doc) => doc.ref.delete()));

        this.friendIdsCache.delete(uid);
        this.logger.log(`Deleted all friend data for user: ${uid}`);
    }

    private listenForNewUsers(): void {
        firebaseDb.collection(USERS_COLLECTION).onSnapshot(
            (snapshot) => {
                for (const change of snapshot.docChanges()) {
                    if (change.type === 'added') {
                        const data = change.doc.data() as { username?: string };
                        this.emit('newUser', { uid: change.doc.id, username: data.username ?? '' });
                    }
                }
            },
            (error) => {
                this.logger.error('Users onSnapshot error', error);
            },
        );
    }

    private async getFriendUids(currentUid: string): Promise<Set<string>> {
        const cached = this.friendIdsCache.get(currentUid);
        if (cached && Date.now() < cached.expiresAt) return cached.uids;
        const friendsSnapshot = await firebaseDb.collection(FRIENDS_COLLECTION).doc(currentUid).collection('list').get();
        const uids = new Set(friendsSnapshot.docs.map((doc) => doc.id));
        uids.add(currentUid);
        this.friendIdsCache.set(currentUid, { uids, expiresAt: Date.now() + USERNAME_CACHE_TTL_MS });
        return uids;
    }

    private async getUserDoc(uid: string): Promise<{ username: string } | null> {
        const cached = this.userDocCache.get(uid);
        if (cached && Date.now() < cached.expiresAt) return cached.data;
        const doc = await firebaseDb.collection(USERS_COLLECTION).doc(uid).get();
        if (!doc.exists) return null;
        const data = doc.data() as { username: string };
        this.userDocCache.set(uid, { data, expiresAt: Date.now() + USERNAME_CACHE_TTL_MS });
        return data;
    }
}
