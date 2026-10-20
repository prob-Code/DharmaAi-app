/**
 * Firebase — app ka ekmaatra auth aur database.
 *
 * Ye file Supabase client ki jagah leti hai. Yahan se:
 *   - auth      : Email/Password + Google sign-in
 *   - db        : Firestore (profiles, posts, DMs, communities, notifications)
 *
 * Session AsyncStorage me persist hoti hai, isliye restart par user logged-in rehta hai.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import type { Auth, User } from 'firebase/auth';
import {
    initializeFirestore,
    getFirestore,
    Firestore,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../config';

const {
    initializeAuth,
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithCredential,
    signOut: fbSignOut,
    updateProfile: fbUpdateProfile,
    sendPasswordResetEmail,
    deleteUser,
    GoogleAuthProvider,
} = FirebaseAuth;

// RN build me hi hota hai; metro.config.js isse resolve karta hai
const getReactNativePersistence: ((s: unknown) => unknown) | undefined =
    (FirebaseAuth as any).getReactNativePersistence;

/* ------------------------------------------------------------------ */
/*  Init                                                               */
/* ------------------------------------------------------------------ */

export const app: FirebaseApp = getApps().length
    ? getApp()
    : initializeApp(Config.FIREBASE_CONFIG);

function buildAuth(): Auth {
    if (!getReactNativePersistence) {
        console.warn(
            "⚠️ getReactNativePersistence nahi mila — firebase/auth browser build par resolve hua hai.\n" +
            "   Auth memory persistence ke saath initialize hoga."
        );
        return initializeAuth(app);
    }
    try {
        return initializeAuth(app, {
            persistence: getReactNativePersistence(AsyncStorage) as any,
        });
    } catch {
        // fast refresh par dobara initializeAuth -> maujooda instance lo
        return getAuth(app);
    }
}

export const auth: Auth = buildAuth();

// RN par long-polling zyada bharosemand hai (kuch networks WebChannel block karte hain)
export const db: Firestore = (() => {
    try {
        return initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
    } catch {
        return getFirestore(app);
    }
})();

/* ------------------------------------------------------------------ */
/*  Auth helpers                                                       */
/* ------------------------------------------------------------------ */

/** Abhi ka signed-in user (ya null). */
export function currentUser(): User | null {
    return auth.currentUser;
}

/** Pehla auth state aane tak wait karta hai — app start par kaam aata hai. */
export function waitForAuthReady(): Promise<User | null> {
    return new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, (user) => {
            unsub();
            resolve(user);
        });
    });
}

/** Chat API ke liye Firebase ID token. */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
    const u = auth.currentUser;
    if (!u) return null;
    try {
        return await u.getIdToken(forceRefresh);
    } catch (e) {
        console.warn('⚠️ getIdToken failed:', e);
        return null;
    }
}

export {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithCredential,
    fbSignOut as firebaseSignOut,
    fbUpdateProfile as updateFirebaseProfile,
    sendPasswordResetEmail,
    deleteUser,
    GoogleAuthProvider,
};

export type { User };
