// avatar.service.ts
import { firebaseDb } from '@app/config/firebase-admin.config';
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';

const USERS_COLLECTION = 'users';
const USERNAME_CACHE_TTL_MS = 60_000;
const AVATAR_CACHE_TTL_MS = 60_000;

export interface AvatarDoc {
    id: string;
    name: string;
    imageBase64: string;
    owner: string;
}

@Injectable()
export class AvatarService {
    private usernameUidCache = new Map<string, { uid: string; expiresAt: number }>();
    private avatarByUidCache = new Map<string, { avatar: AvatarDoc | null; expiresAt: number }>();
    async getAvailableAvatars(uid: string): Promise<AvatarDoc[]> {
        const snapshot = await firebaseDb.collection('avatars').where('owner', 'in', ['global', uid]).get();

        return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<AvatarDoc, 'id'>),
        }));
    }

    async getAvatarById(avatarId: string): Promise<AvatarDoc | null> {
        const doc = await firebaseDb.collection('avatars').doc(avatarId).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...(doc.data() as Omit<AvatarDoc, 'id'>) };
    }

    async getAvatarByUid(uid: string): Promise<AvatarDoc | null> {
        const cleanUid = (uid ?? '').trim();
        if (!cleanUid) return null;

        const cached = this.avatarByUidCache.get(cleanUid);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.avatar;
        }

        const userDoc = await firebaseDb.collection(USERS_COLLECTION).doc(cleanUid).get();
        if (!userDoc.exists) return null;

        const userData = userDoc.data() as { avatar?: string | null };
        if (!userData?.avatar) {
            this.avatarByUidCache.set(cleanUid, { avatar: null, expiresAt: Date.now() + AVATAR_CACHE_TTL_MS });
            return null;
        }

        const avatar = await this.getAvatarById(userData.avatar);
        this.avatarByUidCache.set(cleanUid, { avatar, expiresAt: Date.now() + AVATAR_CACHE_TTL_MS });
        return avatar;
    }

    async getAvatarByUsername(username: string): Promise<AvatarDoc | null> {
        const cleanUsername = (username ?? '').trim();
        if (!cleanUsername) return null;

        let uid: string | null = null;
        const cached = this.usernameUidCache.get(cleanUsername);
        if (cached && cached.expiresAt > Date.now()) {
            uid = cached.uid;
        } else {
            const usersSnapshot = await firebaseDb.collection(USERS_COLLECTION).where('username', '==', cleanUsername).limit(1).get();
            if (usersSnapshot.empty) return null;
            uid = usersSnapshot.docs[0].id;
            this.usernameUidCache.set(cleanUsername, { uid, expiresAt: Date.now() + USERNAME_CACHE_TTL_MS });
        }

        return this.getAvatarByUid(uid);
    }

    invalidateUserCache(uid: string, username?: string): void {
        this.avatarByUidCache.delete(uid);
        if (username) this.usernameUidCache.delete(username);
    }

    async validateAvatarAccess(uid: string, avatarId: string): Promise<boolean> {
        // If no avatar ID provided, validation fails
        if (!avatarId || avatarId.trim().length === 0) {
            return false;
        }

        const doc = await firebaseDb.collection('avatars').doc(avatarId).get();

        if (!doc.exists) return false;

        const data = doc.data() as { owner?: string };

        // autorisé si avatar global ou appartient à l'utilisateur
        return data.owner === 'global' || data.owner === uid;
    }

    async uploadAvatar(uid: string, imageBase64: string, name?: string): Promise<AvatarDoc> {
        try {
            if (!imageBase64 || imageBase64.trim().length === 0) {
                throw new BadRequestException('Image base64 ne peut pas être vide.');
            }

            const docRef = firebaseDb.collection('avatars').doc();

            const avatarData: Omit<AvatarDoc, 'id'> = {
                name: name || `Avatar_${new Date().getTime()}`,
                imageBase64,
                owner: uid,
            };

            await docRef.set(avatarData);

            return {
                id: docRef.id,
                ...avatarData,
            };
        } catch (error: unknown) {
            const err = error as { message?: string; code?: string };
            if (err instanceof BadRequestException) {
                throw err;
            }
            throw new InternalServerErrorException(`Erreur lors de la sauvegarde de l'avatar: ${err.message || 'Erreur inconnue'}`);
        }
    }

    async deleteAvatar(uid: string, avatarId: string): Promise<{ message: string }> {
        try {
            const doc = await firebaseDb.collection('avatars').doc(avatarId).get();

            if (!doc.exists) {
                throw new BadRequestException('Avatar introuvable.');
            }

            const data = doc.data() as { owner?: string };

            // Vérifier que l'avatar appartient à l'utilisateur
            if (data.owner !== uid) {
                throw new BadRequestException('Vous ne pouvez supprimer que vos propres avatars.');
            }

            await firebaseDb.collection('avatars').doc(avatarId).delete();

            return { message: 'Avatar supprimé avec succès.' };
        } catch (error: unknown) {
            const err = error as { message?: string; code?: string };
            if (err instanceof BadRequestException) {
                throw err;
            }
            throw new InternalServerErrorException(`Erreur lors de la suppression de l'avatar: ${err.message || 'Erreur inconnue'}`);
        }
    }

    async deleteAvatarsByOwner(uid: string): Promise<void> {
        try {
            const snapshot = await firebaseDb.collection('avatars').where('owner', '==', uid).get();
            if (snapshot.empty) return;

            const batch = firebaseDb.batch();
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        } catch (error) {
            // ignore
        }
    }
}
