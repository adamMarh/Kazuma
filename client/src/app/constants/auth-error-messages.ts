export const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
    ['auth/invalid-username']: 'authErrors.invalidUsername',
    ['auth/username-already-in-use']: 'authErrors.usernameAlreadyInUse',
    ['auth/username-not-found']: 'authErrors.usernameNotFound',
    ['auth/email-already-in-use']: 'authErrors.emailAlreadyInUse',
    ['auth/invalid-email']: 'authErrors.invalidEmail',
    ['auth/operation-not-allowed']: 'authErrors.operationNotAllowed',
    ['auth/weak-password']: 'authErrors.weakPassword',
    ['auth/user-disabled']: 'authErrors.userDisabled',
    ['auth/user-not-found']: 'authErrors.userNotFound',
    ['auth/wrong-password']: 'authErrors.wrongPassword',
    ['auth/invalid-credential']: 'authErrors.invalidCredential',
    ['auth/too-many-requests']: 'authErrors.tooManyRequests',
    ['auth/session-already-active']: 'authErrors.sessionAlreadyActive',
};
export const MIN_PASSWORD_LENGTH = 6;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 12;
export const USERS_BY_USERNAME_COLLECTION = 'users';

export const DEFAULT_FIREBASE_ERROR_MESSAGE = 'authErrors.default';
