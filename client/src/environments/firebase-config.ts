// Import the functions you need from the SDKs you need
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
export const firebaseConfig = {
    apiKey: 'AIzaSyDUhhLRcKpykXVjY9gGWFE4-F9d7DdhWFU',
    authDomain: 'kazuma-691eb.firebaseapp.com',
    projectId: 'kazuma-691eb',
    storageBucket: 'kazuma-691eb.firebasestorage.app',
    messagingSenderId: '314257484947',
    appId: '1:314257484947:web:5a962def251a726f997166',
};

// Initialize Firebase
export const app: FirebaseApp = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);

// Initialize Firestore
export const db: Firestore = getFirestore(app);
