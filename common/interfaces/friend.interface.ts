export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

export type UserStatus = 'online' | 'inGame' | 'creatingGame' | 'busy' | 'offline';

export interface FriendRequest {
    id: string;
    fromUid: string;
    fromUsername: string;
    toUid: string;
    toUsername: string;
    status: FriendRequestStatus;
    createdAt: string;
}

export interface FriendEntry {
    uid: string;
    username: string;
    addedAt: string;
    userStatus?: UserStatus;
}

export interface UserProfile {
    uid: string;
    username: string;
}

export interface GameInvitation {
    fromUid: string;
    fromUsername: string;
    gameId: string;
    timestamp: string;
}

export const STATUS_SORT_ORDER: Record<UserStatus, number> = {
    online: 0,
    inGame: 1,
    creatingGame: 2,
    busy: 3,
    offline: 4,
};

export const STATUS_COLOR: Record<UserStatus, string> = {
    online: '#4CAF50',
    inGame: '#FFC107',
    creatingGame: '#9E9E9E',
    busy: '#F44336',
    offline: 'transparent',
};

export const STATUS_LABEL: Record<UserStatus, string> = {
    online: 'En ligne',
    inGame: 'En partie',
    creatingGame: 'En création de jeu',
    busy: 'Occupé',
    offline: 'Hors ligne',
};
