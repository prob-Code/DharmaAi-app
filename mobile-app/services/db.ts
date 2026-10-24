/**
 * ============================================================
 *  db.ts — Firestore par poora data layer
 *
 *  Ye file purani services/supabase.ts ki exact jagah leti hai.
 *  Saare service naam, function naam, arguments aur RETURN SHAPES
 *  bilkul wahi rakhe gaye hain — isliye Reflections.tsx, Inbox.tsx,
 *  DirectMessage.tsx, Videos.tsx wagairah me ek line nahi badalti.
 *
 *  Data model FIRESTORE_MODEL.md me likha hai. Do baatein yaad rakhna:
 *    1. comments/likes post ke andar subcollection hain
 *    2. author ka profile post/comment me denormalize hota hai (`user`),
 *       kyunki Firestore me join nahi hota
 * ============================================================
 */

import {
    collection, collectionGroup, doc, getDoc, getDocs, setDoc, addDoc,
    updateDoc, deleteDoc, query, where, orderBy, limit as fsLimit,
    startAfter, increment, serverTimestamp, writeBatch, onSnapshot,
    Timestamp, DocumentSnapshot, QueryDocumentSnapshot,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import {
    db, auth, currentUser, waitForAuthReady,
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signInWithCredential, firebaseSignOut, updateFirebaseProfile,
    sendPasswordResetEmail,     deleteUser, GoogleAuthProvider, getIdToken,
} from './firebase';
import { Config } from '../config';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Firestore Timestamp ko ISO string me — purana code created_at string expect karta hai. */
function ts(v: any): string | null {
    if (!v) return null;
    if (v instanceof Timestamp) return v.toDate().toISOString();
    if (v?.toDate) return v.toDate().toISOString();
    if (typeof v === 'string') return v;
    return null;
}

/** Snapshot ko wahi row shape deta hai jo Supabase deta tha. */
function row(snap: DocumentSnapshot | QueryDocumentSnapshot): any {
    const d: any = snap.data() || {};
    return {
        ...d,
        id: snap.id,
        created_at: ts(d.created_at) ?? new Date().toISOString(),
        updated_at: ts(d.updated_at) ?? undefined,
    };
}

/** DM conversation id — dono uid sort karke jode, taaki dono taraf same id bane. */
function convId(a: string, b: string): string {
    return [a, b].sort().join('_');
}

function requireUser() {
    const u = currentUser();
    if (!u) throw new Error('Not authenticated');
    return u;
}

async function socialApi<T = any>(path: string, init: RequestInit = {}, allowTokenRefresh = true): Promise<T> {
    const token = await getIdToken();
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${Config.BACKEND_URL}/api/social${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(init.headers || {}),
        },
    });
    if (response.status === 401 && allowTokenRefresh) {
        const refreshedToken = await getIdToken(true);
        if (refreshedToken) {
            return socialApi<T>(path, {
                ...init,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${refreshedToken}`,
                    ...(init.headers || {}),
                },
            }, false);
        }
    }
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error || `Social API request failed (${response.status})`;
        const details = typeof body?.details === 'string' ? `: ${body.details}` : '';
        throw new Error(`${message}${details}`);
    }
    return response.status === 204 ? (undefined as T) : response.json();
}

async function requireUserAsync() {
    const u = currentUser() ?? await waitForAuthReady();
    if (!u) throw new Error('Not authenticated');
    return u;
}

/**
 * Callback URL se id_token nikalta hai.
 * Google implicit flow token ko FRAGMENT (#) me bhejta hai, par kuch
 * setups query (?) me bhej dete hain — dono dekh lete hain.
 */
function parseIdTokenFromUrl(url: string): string | null {
    if (!url) return null;
    const parts: string[] = [];
    const hashAt = url.indexOf('#');
    if (hashAt >= 0) parts.push(url.slice(hashAt + 1));
    const qAt = url.indexOf('?');
    if (qAt >= 0) parts.push(url.slice(qAt + 1).split('#')[0]);

    for (const part of parts) {
        if (!part) continue;
        try {
            const token = new URLSearchParams(part).get('id_token');
            if (token) return token;
        } catch {
            const m = part.match(/(?:^|&)id_token=([^&]+)/);
            if (m) return decodeURIComponent(m[1]);
        }
    }
    return null;
}

/** Post/comment me chipkane ke liye author ka chhota profile snapshot. */
async function profileSnapshot(uid: string) {
    try {
        const snap = await getDoc(doc(db, 'profiles', uid));
        const p: any = snap.data() || {};
        return {
            id: uid,
            username: p.username ?? null,
            display_name: p.display_name ?? null,
            avatar_url: p.avatar_url ?? null,
        };
    } catch {
        return { id: uid, username: null, display_name: null, avatar_url: null };
    }
}

/** Login ke baad user ne kya like kiya — feed me isLiked bharne ke liye. */
async function likedPostIds(uid: string, postIds: string[]): Promise<Set<string>> {
    const liked = new Set<string>();
    await Promise.all(postIds.map(async (pid) => {
        try {
            const s = await getDoc(doc(db, 'posts', pid, 'likes', uid));
            if (s.exists()) liked.add(pid);
        } catch { /* ignore */ }
    }));
    return liked;
}

/* ------------------------------------------------------------------ */
/*  Auth error messages (purana behaviour bana rehta hai)              */
/* ------------------------------------------------------------------ */

function getAuthErrorMessage(code: string, context: 'signin' | 'signup' | 'google' | 'session'): string {
    const c = (code || '').toLowerCase();
    if (c.includes('email-already-in-use')) return 'This email is already registered. Please sign in instead.';
    if (c.includes('invalid-email')) return 'Invalid email format. Please try again.';
    if (c.includes('weak-password')) return 'Password must be at least 6 characters.';
    if (c.includes('user-not-found') || c.includes('wrong-password') || c.includes('invalid-credential'))
        return 'Incorrect email or password. Please try again.';
    if (c.includes('too-many-requests')) return 'Too many attempts. Please wait a moment and try again.';
    if (c.includes('network')) return 'Network problem. Please check your internet and try again.';
    if (c.includes('user-disabled')) return 'This account has been disabled.';
    if (c.includes('popup') || c.includes('cancel')) return 'Sign-in was cancelled.';
    if (context === 'signup') return 'Could not create your account. Please try again.';
    if (context === 'google') return 'Google sign-in failed. Please try again.';
    return 'Something went wrong. Please try again.';
}

/* ================================================================== */
/*  AUTH SERVICE                                                       */
/* ================================================================== */

export const authService = {

    signUp: async (email: string, password: string, username: string) => {
        try {
            if (!email || !password || !username) throw new Error('Email, password, and username are required');
            if (password.length < 6) throw new Error('Password must be at least 6 characters');
            if (username.length < 3) throw new Error('Username must be at least 3 characters');

            const cred = await createUserWithEmailAndPassword(
                auth, email.toLowerCase().trim(), password
            );
            const uid = cred.user.uid;

            await updateFirebaseProfile(cred.user, { displayName: username }).catch(() => { });

            // profile doc banao (purane trigger ka kaam)
            await setDoc(doc(db, 'profiles', uid), {
                username: username.toLowerCase().trim(),
                display_name: username,
                avatar_url: null,
                bio: null,
                is_anonymous: false,
                website: null,
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
            });

            return { user: cred.user };
        } catch (error: any) {
            const code = error?.code || error?.message || '';
            console.error('[Auth] Sign up error:', code);
            if (String(error?.message || '').includes('at least')) throw error; // hamari apni validation
            throw new Error(getAuthErrorMessage(code, 'signup'));
        }
    },

    signIn: async (email: string, password: string) => {
        try {
            const cred = await signInWithEmailAndPassword(auth, email.toLowerCase().trim(), password);
            await authService.ensureProfile(cred.user.uid, {
                display_name: cred.user.displayName || email.split('@')[0],
            });
            return { user: cred.user };
        } catch (error: any) {
            console.error('[Auth] Sign in error:', error?.code);
            throw new Error(getAuthErrorMessage(error?.code || '', 'signin'));
        }
    },

    /**
     * Google sign-in, step 1 — auth URL banata hai.
     *
     * AuthScreen ka maujooda flow yahi expect karta hai: yahan se { url }
     * milta hai, wo khud WebBrowser kholta hai, aur wapas aakar
     * finalizeOAuthCallback(callbackUrl) call karta hai. Isliye AuthScreen
     * me ek line bhi badalni nahi padti.
     *
     * Config.GOOGLE_WEB_CLIENT_ID chahiye — Firebase Console →
     * Authentication → Sign-in method → Google → Web SDK configuration.
     */
    /**
     * Android sign-in through Google Play services (account picker, no browser).
     * Google blocks browser-based sign-in from some app setups with the
     * "doesn't comply with OAuth 2.0 policy" error, so Android uses this instead.
     * Returns null when the user closes the account picker.
     */
    signInWithGoogleNative: async () => {
        GoogleSignin.configure({ webClientId: Config.GOOGLE_WEB_CLIENT_ID });
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const response = await GoogleSignin.signIn();
        if (!isSuccessResponse(response)) return null;

        const idToken = response.data.idToken;
        if (!idToken) throw new Error('Google did not return a sign-in token. Please try again.');

        const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
        return { user: cred.user };
    },

    signInWithGoogle: async (redirectUrl?: string) => {
        const clientId = Config.GOOGLE_WEB_CLIENT_ID;
        if (!clientId) {
            throw new Error('Google sign-in not configured. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to your .env');
        }

        const redirectUri = redirectUrl
            || AuthSession.makeRedirectUri({ scheme: 'dharmaai', path: 'auth-callback' });

        const discovery = await AuthSession.fetchDiscoveryAsync('https://accounts.google.com');

        // Jaan-boojh kar nonce nahi bhej rahe: Firebase ke
        // GoogleAuthProvider.credential(idToken) me rawNonce dene ka koi
        // parameter nahi hai (wo sirf Apple ke liye hai), to nonce wala
        // id_token auth/invalid-credential de sakta hai.
        const request = new AuthSession.AuthRequest({
            clientId,
            redirectUri,
            scopes: ['openid', 'profile', 'email'],
            responseType: AuthSession.ResponseType.IdToken,
            // Google rejects code_challenge_method for this implicit ID-token flow.
            usePKCE: false,
            extraParams: { prompt: 'select_account' },
        });

        const url = await request.makeAuthUrlAsync(discovery);
        return { url, provider: 'google' as const };
    },

    /**
     * Google sign-in, step 2 — callback URL se id_token nikaal kar
     * Firebase me sign in karta hai.
     */
    finalizeOAuthCallback: async (callbackUrl: string) => {
        try {
            const idToken = parseIdTokenFromUrl(callbackUrl);

            if (!idToken) {
                // ho sakta hai deep-link listener pehle hi sign-in kar chuka ho
                const existing = currentUser() ?? await waitForAuthReady();
                if (existing) return { user: existing };
                throw new Error('No ID token in callback URL');
            }

            const credential = GoogleAuthProvider.credential(idToken);
            const cred = await signInWithCredential(auth, credential);

            await authService.ensureProfile(cred.user.uid, {
                display_name: cred.user.displayName || undefined,
                avatar_url: cred.user.photoURL || undefined,
            });

            return { user: cred.user };
        } catch (error: any) {
            console.error('[Auth] finalizeOAuthCallback error:', error?.code || error?.message);
            throw new Error(getAuthErrorMessage(error?.code || error?.message || '', 'google'));
        }
    },

    signOut: async () => {
        await firebaseSignOut(auth);
    },

    getCurrentUser: async () => {
        const u = currentUser() ?? await waitForAuthReady();
        if (!u) return null;
        // purana code user.id use karta tha, Firebase me uid hota hai — dono de rahe hain
        return Object.assign(Object.create(Object.getPrototypeOf(u)), u, {
            id: u.uid,
            email: u.email,
        });
    },

    getProfile: async (userId: string) => {
        const snap = await getDoc(doc(db, 'profiles', userId));
        if (!snap.exists()) throw new Error('Profile not found');
        return row(snap);
    },

    updateProfile: async (userId: string, updates: any) => {
        await updateDoc(doc(db, 'profiles', userId), {
            ...updates,
            updated_at: serverTimestamp(),
        });
        const snap = await getDoc(doc(db, 'profiles', userId));
        return row(snap);
    },

    /** Profile na ho to bana do (Google sign-in ke baad kaam aata hai). */
    ensureProfile: async (uid: string, seed: { display_name?: string; avatar_url?: string; username?: string } = {}) => {
        const ref = doc(db, 'profiles', uid);
        const snap = await getDoc(ref);
        if (snap.exists()) return row(snap);

        const fallbackName = seed.display_name || 'seeker';
        await setDoc(ref, {
            username: (seed.username || fallbackName).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || `user${uid.slice(0, 6)}`,
            display_name: fallbackName,
            avatar_url: seed.avatar_url ?? null,
            bio: null,
            is_anonymous: false,
            website: null,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
        });
        return row(await getDoc(ref));
    },

    resetPassword: async (email: string) => {
        await sendPasswordResetEmail(auth, email.toLowerCase().trim());
    },

    /** Google Play policy ke liye — account aur uska saara data mita do. */
    deleteAccount: async () => {
        try {
            const user = requireUser();
            const uid = user.uid;
            console.log('[Auth] Starting account deletion for user:', uid);

            // 1. apne posts (aur unke comments/likes) hatao
            const myPosts = await getDocs(query(collection(db, 'posts'), where('user_id', '==', uid)));
            for (const p of myPosts.docs) {
                const batch = writeBatch(db);
                const cs = await getDocs(collection(db, 'posts', p.id, 'comments'));
                cs.forEach(c => batch.delete(c.ref));
                const ls = await getDocs(collection(db, 'posts', p.id, 'likes'));
                ls.forEach(l => batch.delete(l.ref));
                batch.delete(p.ref);
                await batch.commit();
            }

            // 2. doosron ki posts par apne comments/likes
            const myComments = await getDocs(query(collectionGroup(db, 'comments'), where('user_id', '==', uid)));
            for (const c of myComments.docs) { await deleteDoc(c.ref).catch(() => { }); }

            // 3. DMs
            const convs = await getDocs(query(collection(db, 'conversations'), where('participants', 'array-contains', uid)));
            for (const cv of convs.docs) {
                const msgs = await getDocs(collection(db, 'conversations', cv.id, 'messages'));
                const batch = writeBatch(db);
                msgs.forEach(m => batch.delete(m.ref));
                batch.delete(cv.ref);
                await batch.commit();
            }

            // 4. follows (dono taraf)
            const following = await getDocs(collection(db, 'profiles', uid, 'following'));
            for (const f of following.docs) {
                await deleteDoc(doc(db, 'profiles', f.id, 'followers', uid)).catch(() => { });
                await deleteDoc(f.ref).catch(() => { });
            }
            const followers = await getDocs(collection(db, 'profiles', uid, 'followers'));
            for (const f of followers.docs) {
                await deleteDoc(doc(db, 'profiles', f.id, 'following', uid)).catch(() => { });
                await deleteDoc(f.ref).catch(() => { });
            }

            // 5. notifications + push tokens
            const notifs = await getDocs(collection(db, 'notifications', uid, 'items'));
            for (const n of notifs.docs) await deleteDoc(n.ref).catch(() => { });
            const toks = await getDocs(collection(db, 'pushTokens', uid, 'tokens'));
            for (const t of toks.docs) await deleteDoc(t.ref).catch(() => { });

            // 6. profile
            await deleteDoc(doc(db, 'profiles', uid)).catch(() => { });

            // 7. local storage
            await AsyncStorage.clear();

            // 8. Firebase user khud
            await deleteUser(user).catch(async (e: any) => {
                // recent login chahiye hota hai — kam se kam sign out to kar do
                console.warn('[Auth] deleteUser needs recent login:', e?.code);
                await firebaseSignOut(auth);
                throw new Error('Please sign in again, then delete your account.');
            });

            console.log('[Auth] Account deletion complete.');
            return true;
        } catch (error: any) {
            console.error('[Auth] Account deletion error:', error?.message);
            if (String(error?.message || '').includes('sign in again')) throw error;
            throw new Error('Failed to delete account. Please try again or contact support.');
        }
    },
};

/* ================================================================== */
/*  POSTS                                                              */
/* ================================================================== */

export const postsService = {

    create: async (content: string, moodTag?: string, isAnonymous = false, imageUrl?: string) => {
        const cleanContent = content.trim();
        if (!cleanContent) throw new Error('Reflection cannot be empty.');
        if (cleanContent.length > 300) throw new Error('Reflection must be 300 characters or fewer.');
        return socialApi('/posts', { method: 'POST', body: JSON.stringify({ content: cleanContent, moodTag, isAnonymous, imageUrl }) });
    },

    getFeed: async (limit = 20, cursor?: string) => {
        void cursor;
        return socialApi(`/posts?limit=${limit}`);
    },

    getExplore: async (limit = 20, cursor?: string) => {
        void cursor;
        return socialApi(`/posts?limit=${limit}`);
    },

    getByUser: async (userId: string, limit = 20) => {
        const q = query(
            collection(db, 'posts'),
            where('user_id', '==', userId),
            orderBy('created_at', 'desc'),
            fsLimit(limit),
        );
        const snaps = await getDocs(q);
        return snaps.docs.map(row);
    },

    getById: async (postId: string) => {
        const snap = await getDoc(doc(db, 'posts', postId));
        if (!snap.exists()) throw new Error('Post not found');

        const cs = await getDocs(query(collection(db, 'posts', postId, 'comments'), orderBy('created_at', 'asc')));
        return { ...row(snap), comments: cs.docs.map(row) };
    },

    delete: async (postId: string) => {
        await socialApi(`/posts/${postId}`, { method: 'DELETE' });
    },
};

/* ================================================================== */
/*  LIKES                                                              */
/* ================================================================== */

export const likesService = {
    /** true = ab like hai, false = unlike ho gaya */
    toggle: async (postId: string) => {
        const result = await socialApi<{ liked: boolean }>(`/posts/${postId}/likes/toggle`, { method: 'POST' });
        return result.liked;
    },
};

/* ================================================================== */
/*  COMMENTS                                                           */
/* ================================================================== */

export const commentsService = {

    create: async (postId: string, content: string, isAnonymous = false) => {
        const cleanContent = content.trim();
        if (!cleanContent) throw new Error('Reply cannot be empty.');
        if (cleanContent.length > 500) throw new Error('Reply must be 500 characters or fewer.');
        return socialApi(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ content: cleanContent, isAnonymous }) });
    },

    getByPost: async (postId: string) => {
        return socialApi(`/posts/${postId}/comments`);
    },

    delete: async (commentId: string, postId: string) => {
        await socialApi(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
    },
};

/* ================================================================== */
/*  FOLLOWS                                                            */
/* ================================================================== */

export const followsService = {

    follow: async (userId: string) => {
        const me = requireUser();
        if (me.uid === userId) throw new Error('You cannot follow yourself');

        const batch = writeBatch(db);
        batch.set(doc(db, 'profiles', me.uid, 'following', userId), { created_at: serverTimestamp() });
        batch.set(doc(db, 'profiles', userId, 'followers', me.uid), { created_at: serverTimestamp() });
        await batch.commit();
    },

    unfollow: async (userId: string) => {
        const me = requireUser();
        const batch = writeBatch(db);
        batch.delete(doc(db, 'profiles', me.uid, 'following', userId));
        batch.delete(doc(db, 'profiles', userId, 'followers', me.uid));
        await batch.commit();
    },

    isFollowing: async (userId: string) => {
        const me = currentUser();
        if (!me) return false;
        const snap = await getDoc(doc(db, 'profiles', me.uid, 'following', userId));
        return snap.exists();
    },

    getFollowers: async (userId: string) => {
        const snaps = await getDocs(collection(db, 'profiles', userId, 'followers'));
        return Promise.all(snaps.docs.map(async (s) => {
            const p = await getDoc(doc(db, 'profiles', s.id));
            return p.exists() ? row(p) : { id: s.id };
        }));
    },

    getFollowing: async (userId: string) => {
        const snaps = await getDocs(collection(db, 'profiles', userId, 'following'));
        return Promise.all(snaps.docs.map(async (s) => {
            const p = await getDoc(doc(db, 'profiles', s.id));
            return p.exists() ? row(p) : { id: s.id };
        }));
    },
};

export const profilesService = {
    getAll: async (excludeUserId?: string) => {
        const snaps = await getDocs(query(collection(db, 'profiles'), fsLimit(20)));
        return snaps.docs.map(row).filter((profile) => profile.id !== excludeUserId);
    },

    search: async (text: string, excludeUserId?: string) => {
        const snaps = await getDocs(query(collection(db, 'profiles'), fsLimit(50)));
        const normalized = text.trim().toLowerCase();
        if (!normalized) return snaps.docs.map(row).filter((profile) => profile.id !== excludeUserId);
        return snaps.docs
            .map(row)
            .filter((profile) => profile.id !== excludeUserId)
            .filter((profile) =>
                `${profile.display_name ?? ''} ${profile.username ?? ''}`.toLowerCase().includes(normalized),
            )
            .slice(0, 20);
    },
};

/* ================================================================== */
/*  MESSAGES (DMs)                                                     */
/* ================================================================== */

export const messagesService = {

    send: async (receiverId: string, content: string) => {
        const me = requireUser();
        const cleanContent = content.trim();
        if (!receiverId || receiverId === me.uid) throw new Error('You cannot message this account.');
        if (!cleanContent) throw new Error('Message cannot be empty.');
        if (cleanContent.length > 1000) throw new Error('Message must be 1000 characters or fewer.');
        return socialApi('/messages', { method: 'POST', body: JSON.stringify({ receiverId, content: cleanContent }) });
    },

    getConversations: async () => {
        return socialApi('/messages');
    },

    getWithUser: async (userId: string) => {
        return socialApi(`/messages/${userId}`);
    },

    markRead: async (messageId: string, userId: string) => {
        void userId;
        await socialApi(`/messages/${messageId}/read`, { method: 'PATCH' });
    },

    /** Naye messages par live callback. Return value me .unsubscribe() milta hai. */
    subscribeToMessages: (userId: string, callback: (msg: any) => void) => {
        let lastMessageId: string | null = null;
        let active = true;
        const poll = async () => {
            if (!active) return;
            try {
                const messages = await messagesService.getWithUser(userId);
                const latest = messages[messages.length - 1];
                if (latest?.id && latest.id !== lastMessageId) {
                    if (lastMessageId) callback({ new: latest, ...latest });
                    lastMessageId = latest.id;
                }
            } catch (error) {
                console.warn('[DM] social API subscription error:', error);
            }
        };
        void poll();
        const timer = setInterval(poll, 5000);
        return { unsubscribe: () => { active = false; clearInterval(timer); } };
    },
};

/* ================================================================== */
/*  COMMUNITIES                                                        */
/* ================================================================== */

export const communitiesService = {

    create: async (name: string, description: string, category: string, isPrivate = false) => {
        return socialApi('/communities', { method: 'POST', body: JSON.stringify({ name, description, category, isPrivate }) });
    },

    getAll: async (category?: string) => {
        return socialApi(`/communities${category ? `?category=${encodeURIComponent(category)}` : ''}`);
    },

    join: async (communityId: string) => {
        const result = await socialApi<{ joined: boolean }>(`/communities/${communityId}/join`, { method: 'POST' });
        return result.joined;
    },

    leave: async (communityId: string) => {
        await socialApi(`/communities/${communityId}/membership`, { method: 'DELETE' });
        return true;
    },

    getPosts: async (communityId: string, limit = 20) => {
        return socialApi(`/posts?communityId=${encodeURIComponent(communityId)}&limit=${limit}`);
    },
};

/* ================================================================== */
/*  NOTIFICATIONS                                                      */
/* ================================================================== */

export const notificationsService = {

    create: async (targetUserId: string, type: string, content: string, data?: Record<string, any>) => {
        try {
            await addDoc(collection(db, 'notifications', targetUserId, 'items'), {
                user_id: targetUserId,
                type,
                content,
                data: data || {},
                is_read: false,
                created_at: serverTimestamp(),
            });
        } catch (e: any) {
            // notifications fail hone par app nahi girni chahiye
            console.log('[Notifications] Create failed gracefully:', e?.message);
        }
    },

    getAll: async () => {
        const me = requireUser();
        const snaps = await getDocs(query(
            collection(db, 'notifications', me.uid, 'items'),
            orderBy('created_at', 'desc'),
            fsLimit(50),
        ));
        return snaps.docs.map(row);
    },

    markAsRead: async (notificationId: string) => {
        const me = requireUser();
        await updateDoc(doc(db, 'notifications', me.uid, 'items', notificationId), { is_read: true });
    },

    markAllAsRead: async () => {
        const me = requireUser();
        const snaps = await getDocs(query(
            collection(db, 'notifications', me.uid, 'items'),
            where('is_read', '==', false),
        ));
        if (snaps.empty) return;
        const batch = writeBatch(db);
        snaps.forEach(s => batch.update(s.ref, { is_read: true }));
        await batch.commit();
    },

    subscribe: (userId: string, callback: (notification: any) => void) => {
        const unsub = onSnapshot(
            query(collection(db, 'notifications', userId, 'items'), orderBy('created_at', 'desc'), fsLimit(25)),
            (snap) => {
                snap.docChanges().forEach(ch => {
                    if (ch.type === 'added') callback({ new: row(ch.doc), ...row(ch.doc) });
                });
            },
            (err) => console.warn('[Notifications] subscribe error:', err?.message),
        );
        return { unsubscribe: unsub };
    },
};

/* ================================================================== */
/*  PUSH TOKENS                                                        */
/* ================================================================== */

export const pushTokensService = {
    save: async (token: string, platform: string) => {
        const me = requireUser();
        const id = token.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) || 'default';
        await setDoc(doc(db, 'pushTokens', me.uid, 'tokens', id), {
            token, platform, created_at: serverTimestamp(),
        });
    },
    getMine: async () => {
        const me = requireUser();
        const snaps = await getDocs(collection(db, 'pushTokens', me.uid, 'tokens'));
        return snaps.docs.map(row);
    },
};

export { db, auth };
export default db;
