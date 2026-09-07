import { firebaseAuth, firebaseDb } from '@app/config/firebase-admin.config';
import { FriendGateway } from '@app/gateways/friend/friend.gateway';
import { FriendService } from '@app/services/friend/friend.service';
import { AvatarService } from '@app/services/avatar/avatar.service';
import { ChatService } from '@app/services/chatroom/chatroom.service';
import { MapsService } from '@app/services/maps/maps.service';
import { forwardRef, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

const USERS_COLLECTION = 'users';
const MIN_USERNAME_LENGTH = 3;
const FIREBASE_AUTH_REST_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';
const SESSION_ID_RADIX = 36;
const SESSION_ID_SUBSTRING_START = 2;
const SESSION_ID_SUBSTRING_END = 15;

/* eslint-disable @typescript-eslint/naming-convention */
const REST_API_ERROR_MAP: Record<string, string> = {
    EMAIL_NOT_FOUND: 'auth/user-not-found',
    INVALID_PASSWORD: 'auth/wrong-password',
    USER_DISABLED: 'auth/user-disabled',
    EMAIL_EXISTS: 'auth/email-already-in-use',
    WEAK_PASSWORD: 'auth/weak-password',
    INVALID_EMAIL: 'auth/invalid-email',
    INVALID_LOGIN_CREDENTIALS: 'auth/invalid-credential',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'auth/too-many-requests',
};

const ADMIN_ERROR_MAP: Record<string, string> = {
    'auth/email-already-exists': 'auth/email-already-in-use',
    'auth/invalid-email': 'auth/invalid-email',
    'auth/invalid-password': 'auth/weak-password',
};
/* eslint-enable @typescript-eslint/naming-convention */

export interface AuthResponse {
    uid: string;
    email: string;
    username: string;
    idToken: string;
    avatar: string | null;
    theme?: string;
    language?: string;
}

interface RestApiSignInResponse {
    idToken: string;
    email: string;
    refreshToken: string;
    expiresIn: string;
    localId: string;
    registered?: boolean;
    displayName?: string;
}

@Injectable()
export class AuthService {
    private firebaseApiKey: string;

    constructor(
        private configService: ConfigService,
        private readonly chatCleanup: ChatService,
        private readonly avatarService: AvatarService,
        private readonly mapsService: MapsService,
        @Inject(forwardRef(() => FriendGateway)) private readonly friendGateway: FriendGateway,
        @Inject(forwardRef(() => FriendService)) private readonly friendService: FriendService,
    ) {
        this.firebaseApiKey = this.configService.get<string>('FIREBASE_API_KEY') || '';
        if (!this.firebaseApiKey) {
            throw new Error('FIREBASE_API_KEY is not set in .env');
        }
    }

    async signUp(email: string, password: string, username: string, avatar: string): Promise<AuthResponse> {
        const rawUsername = (username ?? '').trim();
        if (!rawUsername || rawUsername.length < MIN_USERNAME_LENGTH) {
            this.throwAuthError('auth/invalid-username', "Nom d'utilisateur invalide.", HttpStatus.BAD_REQUEST);
        }

        const usernameQuery = await firebaseDb.collection(USERS_COLLECTION).where('username', '==', rawUsername).limit(1).get();
        if (!usernameQuery.empty) {
            this.throwAuthError('auth/username-already-in-use', "Ce nom d'utilisateur est déj\u00e0 utilisé.", HttpStatus.CONFLICT);
        }

        let userRecord: admin.auth.UserRecord;
        try {
            userRecord = await firebaseAuth.createUser({
                email,
                password,
                displayName: rawUsername,
            });
        } catch (error: unknown) {
            const firebaseError = error as { code?: string; message?: string };
            const code = ADMIN_ERROR_MAP[firebaseError.code] || firebaseError.code || 'auth/unknown';
            this.throwAuthError(code, firebaseError.message, HttpStatus.BAD_REQUEST);
        }
        const isValidAvatar = await this.avatarService.validateAvatarAccess(userRecord.uid, avatar);
        if (!isValidAvatar) {
            this.throwAuthError('avatar/not-allowed', 'Avatar non autorisé.', HttpStatus.BAD_REQUEST);
        }

        await firebaseDb

            .collection(USERS_COLLECTION)

            .doc(userRecord.uid)

            .set({
                uid: userRecord.uid,
                email: userRecord.email,
                username: rawUsername,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                activeSession: null,
                avatar: avatar || null,
                theme: 'normal',
                language: 'fr',
                stats: {
                    gamesPlayedClassic: 0,
                    gamesPlayedCTF: 0,
                    gamesWon: 0,
                    totalGameTimeMs: 0,
                },
                currencyBalance: 10,
                ownedCosmetics: {
                    characters: [],
                    visuals: [],
                    sounds: [],
                },
            });

        const signInResult = await this.signInWithRestApi(email, password);
        const sessionId = this.generateSessionId();
        await firebaseDb.collection(USERS_COLLECTION).doc(userRecord.uid).update({ activeSession: sessionId });

        return {
            uid: userRecord.uid,
            email,
            username: rawUsername,
            idToken: signInResult.idToken,
            avatar: avatar || null,
            theme: 'normal',
            language: 'fr',
        };
    }

    async signIn(identifier: string, password: string): Promise<AuthResponse> {
        const rawIdentifier = (identifier ?? '').trim();
        if (!rawIdentifier) {
            this.throwAuthError('auth/invalid-credential', 'Identifiants invalides.', HttpStatus.BAD_REQUEST);
        }

        let email: string;
        let uid: string;

        if (this.isProbablyEmail(rawIdentifier)) {
            const restResult = await this.signInWithRestApi(rawIdentifier, password);
            email = rawIdentifier;
            uid = restResult.localId;
        } else {
            const resolved = await this.resolveUsername(rawIdentifier, password);
            email = resolved.email;
            uid = resolved.uid;
        }

        const userDocRef = firebaseDb.collection(USERS_COLLECTION).doc(uid);
        const userDoc = await userDocRef.get();

        if (userDoc.exists) {
            const sessionData = userDoc.data() as { activeSession?: string | null };
            if (sessionData?.activeSession) {
                this.throwAuthError('auth/session-already-active', 'Ce compte est déjà connecté sur un autre appareil.', HttpStatus.CONFLICT);
            }
        }

        const signInResult = await this.signInWithRestApi(email, password);
        const sessionId = this.generateSessionId();
        await userDocRef.update({ activeSession: sessionId });

        const docData = userDoc.exists ? (userDoc.data() as { username?: string; avatar?: string; theme?: string; language?: string }) : {};

        return {
            uid,
            email,
            username: docData?.username || '',
            avatar: docData?.avatar || null,
            idToken: signInResult.idToken,
            theme: docData?.theme || 'normal',
            language: docData?.language || 'fr',
        };
    }

    async signOut(idToken: string): Promise<void> {
        const decodedToken = await this.verifyToken(idToken);
        const userDocRef = firebaseDb.collection(USERS_COLLECTION).doc(decodedToken.uid);
        await userDocRef.update({ activeSession: null });
        this.friendGateway.updateUserStatus(decodedToken.uid, 'offline');
    }

    async clearSession(idToken: string): Promise<void> {
        try {
            const decodedToken = await this.verifyToken(idToken);
            const userDocRef = firebaseDb.collection(USERS_COLLECTION).doc(decodedToken.uid);
            await userDocRef.update({ activeSession: null });
        } catch {
            // Silently fail - this is called on window close
        }
    }

    async clearSessionByUid(uid: string): Promise<void> {
        try {
            await firebaseDb.collection(USERS_COLLECTION).doc(uid).update({ activeSession: null });
        } catch {
            // Silently fail
        }
    }

    async deleteAccount(idToken: string): Promise<void> {
        const decodedToken = await this.verifyToken(idToken);

        await firebaseAuth.getUser(decodedToken.uid).catch(() => null);

        const uid = decodedToken.uid;

        let username = '';
        try {
            const authUser = await firebaseAuth.getUser(uid);
            username = (authUser.displayName ?? '').trim();
        } catch {
            // ignore
        }

        if (!username) {
            try {
                const userDoc = await firebaseDb.collection(USERS_COLLECTION).doc(uid).get();
                username = ((userDoc.data() as { username?: string })?.username ?? '').trim();
            } catch {
                // ignore
            }
        }
        const userDocRef = firebaseDb.collection(USERS_COLLECTION).doc(uid);
        try {
            await userDocRef.update({ activeSession: null });
        } catch {
            // ignore
        }
        if (username) {
            try {
                const result = await this.chatCleanup.purgeMessagesByUsername(username);
                if (!result) {
                    this.throwAuthError('auth/delete-chat-failed', 'Suppression du chat échouée.', HttpStatus.INTERNAL_SERVER_ERROR);
                }
            } catch (e) {
                this.throwAuthError('auth/delete-chat-failed', 'Suppression du chat échouée.', HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }
        // Delete all maps owned by this user
        if (username) {
            try {
                await this.mapsService.deleteMapsByOwner(username);
            } catch {
                // Non-blocking: don't fail account deletion if map cleanup fails
            }
        }
        // Delete all custom avatars uploaded by this user
        try {
            await this.avatarService.deleteAvatarsByOwner(uid);
        } catch {
            // Non-blocking
        }
        // Delete all friendships, friend requests, and block relationships
        try {
            await this.friendService.deleteUserData(uid);
        } catch {
            // Non-blocking
        }
        try {
            await userDocRef.delete();
        } catch {
            // ignore
        }
        try {
            await firebaseAuth.deleteUser(uid);
            await firebaseAuth.getUser(uid).catch(() => null);
        } catch (error: unknown) {
            const firebaseError = error as { code?: string; message?: string };
            this.throwAuthError(firebaseError.code || 'auth/delete-failed', firebaseError.message || 'Suppression échouée.', HttpStatus.BAD_REQUEST);
        }
    }

    async getMe(idToken: string): Promise<{ uid: string; email: string; username: string; avatarId?: string; theme?: string; language?: string }> {
        const decodedToken = await this.verifyToken(idToken);
        const userDoc = await firebaseDb.collection(USERS_COLLECTION).doc(decodedToken.uid).get();

        if (!userDoc.exists) {
            throw new UnauthorizedException({ code: 'auth/user-not-found', message: 'Utilisateur introuvable.' });
        }

        const data = userDoc.data() as { email?: string; username?: string; avatar?: string; theme?: string; language?: string };
        return {
            uid: decodedToken.uid,
            email: data?.email || decodedToken.email || '',
            username: data?.username || '',
            avatarId: data?.avatar || undefined,
            theme: data?.theme || 'normal',
            language: data?.language || 'fr',
        };
    }

    async getStats(idToken: string): Promise<{ gamesPlayedClassic: number; gamesPlayedCTF: number; gamesWon: number; totalGameTimeMs: number }> {
        const decodedToken = await this.verifyToken(idToken);
        const userDoc = await firebaseDb.collection(USERS_COLLECTION).doc(decodedToken.uid).get();

        if (!userDoc.exists) {
            return { gamesPlayedClassic: 0, gamesPlayedCTF: 0, gamesWon: 0, totalGameTimeMs: 0 };
        }

        const data = userDoc.data() as {
            stats?: { gamesPlayedClassic?: number; gamesPlayedCTF?: number; gamesWon?: number; totalGameTimeMs?: number };
        };
        return {
            gamesPlayedClassic: data.stats?.gamesPlayedClassic ?? 0,
            gamesPlayedCTF: data.stats?.gamesPlayedCTF ?? 0,
            gamesWon: data.stats?.gamesWon ?? 0,
            totalGameTimeMs: data.stats?.totalGameTimeMs ?? 0,
        };
    }

    async verifyToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
        try {
            return await firebaseAuth.verifyIdToken(idToken);
        } catch {
            throw new UnauthorizedException({
                code: 'auth/invalid-token',
                message: 'Token invalide ou expiré.',
            });
        }
    }

    async updateProfile(idToken: string, email: string, username: string, avatar: string, theme?: string, language?: string): Promise<AuthResponse> {
        const decodedToken = await this.verifyToken(idToken);
        const uid = decodedToken.uid;

        const userDocRef = firebaseDb.collection(USERS_COLLECTION).doc(uid);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists) {
            throw new UnauthorizedException({ code: 'auth/user-not-found', message: 'Utilisateur introuvable.' });
        }
        const isValidAvatar = await this.avatarService.validateAvatarAccess(uid, avatar);
        if (!isValidAvatar) {
            this.throwAuthError('avatar/not-allowed', 'Avatar non autorisé.', HttpStatus.BAD_REQUEST);
        }

        const docData = userDoc.data() as { username?: string; avatar?: string; theme?: string; language?: string };
        const oldUsername = docData.username || '';

        const updateData: { email?: string; username?: string; avatar?: string; theme?: string; language?: string } = {};
        if (email) updateData.email = email;
        if (username) updateData.username = username;
        if (avatar !== undefined) updateData.avatar = avatar;
        if (theme !== undefined) updateData.theme = theme;
        if (language !== undefined) updateData.language = language;

        try {
            await userDocRef.update(updateData);
            await firebaseAuth.updateUser(uid, { email, displayName: username });
        } catch (error: unknown) {
            const firebaseError = error as { code?: string; message?: string };
            const code = ADMIN_ERROR_MAP[firebaseError.code] || firebaseError.code || 'auth/update-failed';
            this.throwAuthError(code, firebaseError.message, HttpStatus.BAD_REQUEST);
        }

        // Update author field in MongoDB messages if username changed
        if (oldUsername && oldUsername !== username) {
            await this.chatCleanup.updateMessageUsername(oldUsername, username);
        }

        this.avatarService.invalidateUserCache(uid, oldUsername);

        return { uid, email, username, idToken, avatar: avatar || null, theme: docData?.theme || 'normal', language: docData?.language || 'fr' };
    }

    private async signInWithRestApi(email: string, password: string): Promise<RestApiSignInResponse> {
        const url = `${FIREBASE_AUTH_REST_URL}:signInWithPassword?key=${this.firebaseApiKey}`;
        const body = JSON.stringify({ email, password, returnSecureToken: true });
        const headers = new Headers();
        headers.set('Content-Type', 'application/json');

        const response = await fetch(url, { method: 'POST', headers, body });

        if (!response.ok) {
            const error = await response.json();
            const errorMessage = error?.error?.message || '';
            const errorCode = REST_API_ERROR_MAP[errorMessage] || 'auth/invalid-credential';
            this.throwAuthError(errorCode, errorMessage, HttpStatus.UNAUTHORIZED);
        }

        return response.json() as Promise<RestApiSignInResponse>;
    }

    private async resolveUsername(username: string, password: string): Promise<{ email: string; uid: string }> {
        const snaps = await firebaseDb.collection(USERS_COLLECTION).where('username', '==', username).limit(1).get();

        if (snaps.empty) {
            this.throwAuthError('auth/username-not-found', "Aucun compte trouvé avec ce nom d'utilisateur.", HttpStatus.UNAUTHORIZED);
        }

        const data = snaps.docs[0].data() as { email?: string; uid?: string };
        if (!data.email || !data.uid) {
            this.throwAuthError('auth/username-not-found', "Aucun compte trouvé avec ce nom d'utilisateur.", HttpStatus.UNAUTHORIZED);
        }

        await this.signInWithRestApi(data.email, password);
        return { email: data.email, uid: data.uid };
    }

    private throwAuthError(code: string, message: string, status: HttpStatus): never {
        throw new HttpException({ code, message }, status);
    }

    private isProbablyEmail(value: string): boolean {
        return value.includes('@');
    }

    private generateSessionId(): string {
        const randomPart = Math.random().toString(SESSION_ID_RADIX).substring(SESSION_ID_SUBSTRING_START, SESSION_ID_SUBSTRING_END);
        return `${Date.now()}-${randomPart}`;
    }
}
