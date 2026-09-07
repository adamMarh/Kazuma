import { UserStatus } from '@common/interfaces/friend.interface';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class StatusService {
    private readonly logger = new Logger(StatusService.name);

    // uid → status
    private userStatuses = new Map<string, UserStatus>();

    // uid → socketId
    private userSocketMap = new Map<string, string>();

    // uid → username
    private userNames = new Map<string, string>();

    // uid → Set<friendUid>
    private userFriends = new Map<string, Set<string>>();

    // uid → busy flag (persists across status changes)
    private busyUsers = new Set<string>();

    registerUser(uid: string, socketId: string, username: string): void {
        this.userSocketMap.set(uid, socketId);
        this.userNames.set(uid, username);
        if (this.busyUsers.has(uid)) {
            this.userStatuses.set(uid, 'busy');
        } else {
            this.userStatuses.set(uid, 'online');
        }
        this.logger.log(`User registered: ${username} (${uid}) → status: ${this.userStatuses.get(uid)}`);
    }

    unregisterUser(socketId: string): string | undefined {
        for (const [uid, sid] of this.userSocketMap.entries()) {
            if (sid === socketId) {
                this.userSocketMap.delete(uid);
                this.userStatuses.delete(uid);
                this.userNames.delete(uid);
                this.busyUsers.delete(uid);
                this.userFriends.delete(uid);
                this.logger.log(`User unregistered: ${uid}`);
                return uid;
            }
        }
        return undefined;
    }

    getUidBySocketId(socketId: string): string | undefined {
        for (const [uid, sid] of this.userSocketMap.entries()) {
            if (sid === socketId) return uid;
        }
        return undefined;
    }

    getSocketId(uid: string): string | undefined {
        return this.userSocketMap.get(uid);
    }

    getUsername(uid: string): string | undefined {
        return this.userNames.get(uid);
    }

    getStatus(uid: string): UserStatus {
        return this.userStatuses.get(uid) || 'offline';
    }

    setStatus(uid: string, status: UserStatus): void {
        if (!this.userSocketMap.has(uid)) return;
        this.userStatuses.set(uid, status);
        this.logger.log(`Status changed: ${uid} → ${status}`);
    }

    setBusy(uid: string, busy: boolean): void {
        if (busy) {
            this.busyUsers.add(uid);
            this.userStatuses.set(uid, 'busy');
        } else {
            this.busyUsers.delete(uid);
            // Restore appropriate status
            this.userStatuses.set(uid, 'online');
        }
        this.logger.log(`Busy mode: ${uid} → ${busy}`);
    }

    isBusy(uid: string): boolean {
        return this.busyUsers.has(uid);
    }

    isOnline(uid: string): boolean {
        return this.userSocketMap.has(uid);
    }

    setFriends(uid: string, friendUids: string[]): void {
        this.userFriends.set(uid, new Set(friendUids));
    }

    getFriendUids(uid: string): string[] {
        const friends = this.userFriends.get(uid);
        return friends ? Array.from(friends) : [];
    }

    /**
     * Get the list of online friend UIDs who should be notified of a status change
     */
    getOnlineFriendSocketIds(uid: string): string[] {
        const friends = this.userFriends.get(uid);
        if (!friends) return [];
        const socketIds: string[] = [];
        for (const friendUid of friends) {
            const socketId = this.userSocketMap.get(friendUid);
            if (socketId) {
                socketIds.push(socketId);
            }
        }
        return socketIds;
    }

    /**
     * Enrich a friend list with status information
     */
    enrichFriendsWithStatus(
        friends: { uid: string; username: string; addedAt: string }[],
    ): { uid: string; username: string; addedAt: string; userStatus: UserStatus }[] {
        return friends.map((friend) => ({
            ...friend,
            userStatus: this.getStatus(friend.uid),
        }));
    }
}
