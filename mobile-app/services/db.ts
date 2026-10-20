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
import {
    db, auth, currentUser, waitForAuthReady,
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signInWithCredential, firebaseSignOut, updateFirebaseProfile,
    sendPasswordResetEmail, deleteUser, GoogleAuthProvider,
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
        const user = await requireUserAsync();
        const cleanContent = content.trim();
        if (!cleanContent) throw new Error('Reflection cannot be empty.');
        if (cleanContent.length > 300) throw new Error('Reflection must be 300 characters or fewer.');
        const author = await profileSnapshot(user.uid);

        const ref = await addDoc(collection(db, 'posts'), {
            user_id: user.uid,
            content: cleanContent,
            mood_tag: moodTag ?? null,
            is_anonymous: isAnonymous,
            image_url: imageUrl ?? null,
            community_id: null,
            likes_count: 0,
            comments_count: 0,
            created_at: serverTimestamp(),
            user: author,
        });

        const snap = await getDoc(ref);
        return { ...row(snap), isLiked: false };
    },

    getFeed: async (limit = 20, cursor?: string) => {
        const user = requireUser();

        let q = query(collection(db, 'posts'), orderBy('created_at', 'desc'), fsLimit(limit));
        if (cursor) q = query(collection(db, 'posts'), orderBy('created_at', 'desc'), startAfter(new Date(cursor)), fsLimit(limit));

        const snaps = await getDocs(q);
        const posts = snaps.docs.map(row);
        const liked = await likedPostIds(user.uid, posts.map(p => p.id));
        return posts.map(p => ({ ...p, isLiked: liked.has(p.id) }));
    },

    getExplore: async (limit = 20, cursor?: string) => {
        const user = currentUser();

        let q = query(collection(db, 'posts'), orderBy('created_at', 'desc'), fsLimit(limit));
        if (cursor) q = query(collection(db, 'posts'), orderBy('created_at', 'desc'), startAfter(new Date(cursor)), fsLimit(limit));

        const snaps = await getDocs(q);
        const posts = snaps.docs.map(row);
        if (!user) return posts.map(p => ({ ...p, isLiked: false }));

        const liked = await likedPostIds(user.uid, posts.map(p => p.id));
        return posts.map(p => ({ ...p, isLiked: liked.has(p.id) }));
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
        const batch = writeBatch(db);
        const cs = await getDocs(collection(db, 'posts', postId, 'comments'));
        cs.forEach(c => batch.delete(c.ref));
        const ls = await getDocs(collection(db, 'posts', postId, 'likes'));
        ls.forEach(l => batch.delete(l.ref));
        batch.delete(doc(db, 'posts', postId));
        await batch.commit();
    },
};

/* ================================================================== */
/*  LIKES                                                              */
/* ================================================================== */

export const likesService = {
    /** true = ab like hai, false = unlike ho gaya */
    toggle: async (postId: string) => {
        const user = requireUser();
        const likeRef = doc(db, 'posts', postId, 'likes', user.uid);
        const postRef = doc(db, 'posts', postId);

        const existing = await getDoc(likeRef);

        if (existing.exists()) {
            await deleteDoc(likeRef);
            await updateDoc(postRef, { likes_count: increment(-1) });
            return false;
        }
        await setDoc(likeRef, { created_at: serverTimestamp() });
        await updateDoc(postRef, { likes_count: increment(1) });
        return true;
    },
};

/* ================================================================== */
/*  COMMENTS                                                           */
/* ================================================================== */

export const commentsService = {

    create: async (postId: string, content: string, isAnonymous = false) => {
        const user = requireUser();
        const cleanContent = content.trim();
        if (!cleanContent) throw new Error('Reply cannot be empty.');
        if (cleanContent.length > 500) throw new Error('Reply must be 500 characters or fewer.');
        const author = await profileSnapshot(user.uid);

        const ref = await addDoc(collection(db, 'posts', postId, 'comments'), {
            user_id: user.uid,
            post_id: postId,
            content: cleanContent,
            is_anonymous: isAnonymous,
            created_at: serverTimestamp(),
            user: author,
        });

        await updateDoc(doc(db, 'posts', postId), { comments_count: increment(1) });
        return row(await getDoc(ref));
    },

    getByPost: async (postId: string) => {
        const q = query(collection(db, 'posts', postId, 'comments'), orderBy('created_at', 'asc'));
        const snaps = await getDocs(q);
        return snaps.docs.map(row);
    },

    delete: async (commentId: string, postId: string) => {
        await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
        await updateDoc(doc(db, 'posts', postId), { comments_count: increment(-1) });
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
        const cid = convId(me.uid, receiverId);

        // conversation doc pehli baar me bana do
        await setDoc(doc(db, 'conversations', cid), {
            participants: [me.uid, receiverId].sort(),
            last_message: cleanContent,
            updated_at: serverTimestamp(),
        }, { merge: true });

        const ref = await addDoc(collection(db, 'conversations', cid, 'messages'), {
            sender_id: me.uid,
            receiver_id: receiverId,
            content: cleanContent,
            is_read: false,
            created_at: serverTimestamp(),
        });

        return row(await getDoc(ref));
    },

    getConversations: async () => {
        const me = requireUser();

        const convs = await getDocs(query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', me.uid),
        ));

        const out = await Promise.all(convs.docs.map(async (c) => {
            const participants: string[] = (c.data() as any).participants || [];
            const otherId = participants.find(p => p !== me.uid);
            if (!otherId) return null;

            const otherSnap = await getDoc(doc(db, 'profiles', otherId));
            const otherUser = otherSnap.exists() ? row(otherSnap) : { id: otherId };

            const lastSnaps = await getDocs(query(
                collection(db, 'conversations', c.id, 'messages'),
                orderBy('created_at', 'desc'),
                fsLimit(1),
            ));
            const lastMessage = lastSnaps.docs[0] ? row(lastSnaps.docs[0]) : null;

            const unreadSnaps = await getDocs(query(
                collection(db, 'conversations', c.id, 'messages'),
                where('receiver_id', '==', me.uid),
                where('is_read', '==', false),
            ));

            return { otherUser, lastMessage, unreadCount: unreadSnaps.size };
        }));

        return out
            .filter(Boolean)
            .sort((a: any, b: any) =>
                String(b?.lastMessage?.created_at ?? '').localeCompare(String(a?.lastMessage?.created_at ?? '')));
    },

    getWithUser: async (userId: string) => {
        const me = requireUser();
        const cid = convId(me.uid, userId);

        const snaps = await getDocs(query(
            collection(db, 'conversations', cid, 'messages'),
            orderBy('created_at', 'asc'),
        ));
        const messages = snaps.docs.map(row);

        // jo mere liye aaye aur unread the, unhe read mark karo
        const batch = writeBatch(db);
        let n = 0;
        snaps.docs.forEach(s => {
            const d: any = s.data();
            if (d.receiver_id === me.uid && !d.is_read) { batch.update(s.ref, { is_read: true }); n++; }
        });
        if (n) await batch.commit();

        return messages;
    },

    markRead: async (messageId: string, userId: string) => {
        const me = requireUser();
        const cid = convId(me.uid, userId);
        await updateDoc(doc(db, 'conversations', cid, 'messages', messageId), { is_read: true });
    },

    /** Naye messages par live callback. Return value me .unsubscribe() milta hai. */
    subscribeToMessages: (userId: string, callback: (msg: any) => void) => {
        const me = currentUser();
        if (!me) return { unsubscribe: () => { } };

        const cid = convId(me.uid, userId);
        const unsub = onSnapshot(
            query(collection(db, 'conversations', cid, 'messages'), orderBy('created_at', 'desc'), fsLimit(1)),
            (snap) => {
                snap.docChanges().forEach(ch => {
                    if (ch.type === 'added') callback({ new: row(ch.doc), ...row(ch.doc) });
                });
            },
            (err) => console.warn('[DM] subscribe error:', err?.message),
        );
        return { unsubscribe: unsub };
    },
};

/* ================================================================== */
/*  COMMUNITIES                                                        */
/* ================================================================== */

export const communitiesService = {

    create: async (name: string, description: string, category: string, isPrivate = false) => {
        const me = requireUser();

        const ref = await addDoc(collection(db, 'communities'), {
            name,
            description,
            category,
            is_private: isPrivate,
            creator_id: me.uid,
            member_count: 1,
            created_at: serverTimestamp(),
        });

        await setDoc(doc(db, 'communities', ref.id, 'members', me.uid), {
            role: 'admin',
            joined_at: serverTimestamp(),
        });

        return row(await getDoc(ref));
    },

    getAll: async (category?: string) => {
        const base = collection(db, 'communities');
        const q = category
            ? query(base, where('category', '==', category), orderBy('member_count', 'desc'))
            : query(base, orderBy('member_count', 'desc'));
        const snaps = await getDocs(q);
        return snaps.docs.map(row);
    },

    join: async (communityId: string) => {
        const me = requireUser();
        const memberRef = doc(db, 'communities', communityId, 'members', me.uid);
        const existing = await getDoc(memberRef);
        if (existing.exists()) return false;

        await setDoc(memberRef, {
            role: 'member',
            joined_at: serverTimestamp(),
        });
        await updateDoc(doc(db, 'communities', communityId), { member_count: increment(1) });
        return true;
    },

    leave: async (communityId: string) => {
        const me = requireUser();
        const memberRef = doc(db, 'communities', communityId, 'members', me.uid);
        const existing = await getDoc(memberRef);
        if (!existing.exists()) return false;

        await deleteDoc(memberRef);
        await updateDoc(doc(db, 'communities', communityId), { member_count: increment(-1) });
        return true;
    },

    getPosts: async (communityId: string, limit = 20) => {
        const q = query(
            collection(db, 'posts'),
            where('community_id', '==', communityId),
            orderBy('created_at', 'desc'),
            fsLimit(limit),
        );
        const snaps = await getDocs(q);
        return snaps.docs.map(row);
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
