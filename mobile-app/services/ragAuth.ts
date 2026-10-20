/**
 * RagGita chat API ke liye auth helper.
 *
 * Firebase is the app auth and database provider.
 * Firebase ka kaam sirf itna hai: chat API ke liye ek ID token lana,
 * kyunki server /chat par "Authorization: Bearer <firebase id token>" maangta hai.
 *
 * User ko kuch nahi dikhta — koi login screen nahi, koi button nahi.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import type { Auth } from 'firebase/auth';

const {
    initializeAuth,
    getAuth,
    signInAnonymously,
} = FirebaseAuth;

// getReactNativePersistence sirf @firebase/auth ke RN build me hota hai.
// metro.config.js ise resolve karta hai; na mile to bina persistence ke chalega.
const getReactNativePersistence: ((s: unknown) => unknown) | undefined =
    (FirebaseAuth as any).getReactNativePersistence;
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../config';

const DEVICE_ID_KEY = 'raggita_device_id';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let signInPromise: Promise<void> | null = null;

/* ---------------- Device ID ---------------- */

let cachedDeviceId: string | null = null;

function randomId(): string {
    // Kisi extra library ki zaroorat nahi
    return 'dev-' + Date.now().toString(36) + '-' +
        Math.random().toString(36).slice(2, 10) +
        Math.random().toString(36).slice(2, 10);
}

/** Har install ka ek sthir id. Server isse X-User-Id header me pehchanta hai. */
export async function getDeviceId(): Promise<string> {
    if (cachedDeviceId) return cachedDeviceId;
    try {
        const saved = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (saved) {
            cachedDeviceId = saved;
            return saved;
        }
    } catch { /* storage fail -> naya bana lenge */ }

    const id = randomId();
    cachedDeviceId = id;
    try { await AsyncStorage.setItem(DEVICE_ID_KEY, id); } catch { }
    return id;
}

/* ---------------- Firebase init ---------------- */

function ensureFirebase(): Auth | null {
    if (auth) return auth;

    const cfg = Config.FIREBASE_CONFIG;
    if (!cfg?.apiKey || !cfg?.projectId) {
        console.warn("⚠️ Firebase config missing — chat sirf device-id se try karegi");
        return null;
    }

    try {
        app = getApps().length ? getApp() : initializeApp(cfg);

        if (!getReactNativePersistence) {
            // metro.config.js ka firebase/auth redirect nahi laga — session persist nahi hogi
            console.warn(
                "⚠️ getReactNativePersistence unavailable — firebase/auth browser build par resolve hua hai.\n" +
                "   Chat auth memory persistence ke saath initialize hoga."
            );
            auth = initializeAuth(app);
            return auth;
        }

        try {
            // RN par session AsyncStorage me persist hoti hai, warna har restart par dobara sign-in
            auth = initializeAuth(app, {
                persistence: getReactNativePersistence(AsyncStorage) as any,
            });
        } catch {
            // initializeAuth do baar call ho gaya (fast refresh) -> existing instance lo
            auth = getAuth(app);
        }
        return auth;
    } catch (e) {
        console.error("❌ Firebase init failed:", e);
        return null;
    }
}

/* ---------------- Silent sign-in ---------------- */

/**
 * Background sign-in. Do tareeke, is order me:
 *  1. Supabase session me Google ka provider_token ho to usi se Firebase me sign-in
 *     (same Google account, isliye server par identity match karegi)
 *  2. Warna anonymous sign-in
 *
 * Dono me user ko kuch dikhta nahi.
 */
async function ensureSignedIn(): Promise<void> {
    const a = ensureFirebase();
    if (!a) return;
    if (a.currentUser) return;

    // Ek hi waqt me ek hi sign-in chale
    if (signInPromise) return signInPromise;

    signInPromise = (async () => {
        // Chat uses a separate anonymous Firebase identity when no app user exists.
        try {
            await signInAnonymously(a);
            console.log("🔐 Firebase signed in anonymously");
        } catch (e: any) {
            console.error("❌ Firebase anonymous sign-in failed:", e?.code || e?.message);
            console.error("   Firebase console → Authentication → Sign-in method → 'Anonymous' enable karo");
        }
    })();

    try { await signInPromise; } finally { signInPromise = null; }
}

/* ---------------- Public API ---------------- */

/** Chat API ke liye headers. Token na mile to bhi device-id ke saath bhejte hain. */
export async function getChatHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-User-Id': await getDeviceId(),
    };

    try {
        await ensureSignedIn();
        const a = auth;
        if (a?.currentUser) {
            const token = await a.currentUser.getIdToken();
            if (token) headers['Authorization'] = 'Bearer ' + token;
        }
    } catch (e) {
        console.warn("⚠️ Could not attach Firebase token:", e);
    }

    return headers;
}

/** 401 ke baad token refresh karke ek retry ke liye. */
export async function refreshChatToken(): Promise<string | null> {
    try {
        await ensureSignedIn();
        if (!auth?.currentUser) return null;
        return await auth.currentUser.getIdToken(true); // force refresh
    } catch (e) {
        console.warn("⚠️ Token refresh failed:", e);
        return null;
    }
}

/** App start par sign-in shuru kar do, taaki pehla message fast ho. */
export function primeChatAuth(): void {
    ensureSignedIn().catch(() => { });
}
