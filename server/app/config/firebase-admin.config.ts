import * as admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const SERVICE_ACCOUNT_FILENAME = 'firebase-service-account.json';

function initializeAdmin(): void {
    if (admin.apps.length) return;

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || resolve(process.cwd(), SERVICE_ACCOUNT_FILENAME);

    if (existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    } else {
        throw new Error(
            'Firebase service account not configured. ' +
                'Place a firebase-service-account.json file in server/, ' +
                'or set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_KEY (base64) in .env.',
        );
    }
}

initializeAdmin();

export const firebaseAuth = admin.auth();
export const firebaseDb = admin.firestore();
