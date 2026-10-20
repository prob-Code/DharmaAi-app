/**
 * ============================================================
 *  supabase.ts — ab sirf ek COMPATIBILITY SHIM hai
 *
 *  Asli kaam services/db.ts karta hai (Firestore + Firebase Auth).
 *  Ye file isliye bachi hui hai taaki jo components abhi
 *  `from '../services/supabase'` import karte hain — AuthContext.tsx,
 *  AuthScreen.tsx, Reflections.tsx, Inbox.tsx, DirectMessage.tsx —
 *  unme ek line bhi na badalni pade.
 *
 *  Jab sab kuch theek chal jaye, tab aaram se imports ko
 *  '../services/db' par shift kar dena aur ye file delete kar dena.
 * ============================================================
 */

import {
    authService, postsService, likesService, commentsService,
    followsService, messagesService, communitiesService,
    notificationsService, pushTokensService, profilesService,
} from './db';
import { auth, db, currentUser, onAuthStateChanged, getIdToken } from './firebase';
import type { User as FirebaseUser } from './firebase';

export {
    authService, postsService, likesService, commentsService,
    followsService, messagesService, communitiesService,
    notificationsService, pushTokensService, profilesService,
    db, auth, getIdToken,
};

/* ------------------------------------------------------------------ */
/*  Session shim                                                       */
/*  Purana code session.user.id aur session.access_token use karta      */
/*  hai — wahi shape Firebase user se bana ke de dete hain.             */
/* ------------------------------------------------------------------ */


export interface CompatUser {
    id: string;
    uid: string;
    email: string | null;
    user_metadata: { username?: string; display_name?: string; avatar_url?: string };
    aud: string;
    role: string;
    _firebase: FirebaseUser;
}

export interface CompatSession {
    access_token: string | null;
    refresh_token: string | null;
    token_type: string;
    expires_in: number;
    user: CompatUser;
}
function toCompatUser(u: FirebaseUser | null): CompatUser | null {
    if (!u) return null;
    return {
        id: u.uid,                       // purana code .id padhta hai
        uid: u.uid,
        email: u.email,
        user_metadata: {
            username: u.displayName ?? undefined,
            display_name: u.displayName ?? undefined,
            avatar_url: u.photoURL ?? undefined,
        },
        aud: 'authenticated',
        role: 'authenticated',
        _firebase: u,
    };
}

async function toCompatSession(u: FirebaseUser | null): Promise<CompatSession | null> {
    if (!u) return null;
    let token: string | null = null;
    try { token = await u.getIdToken(); } catch { /* offline */ }
    return {
        access_token: token,
        refresh_token: null,
        token_type: 'bearer',
        expires_in: 3600,
        user: toCompatUser(u)!,
    };
}

/**
 * `supabase` naam ka object — sirf utna hi surface jitna app use karta hai:
 *   supabase.auth.getSession()
 *   supabase.auth.onAuthStateChange(cb)
 *   supabase.auth.signInWithOAuth({ provider, options })
 *   supabase.auth.signOut()
 *   supabase.auth.getUser()
 */
export const supabase = {
    auth: {
        getSession: async () => {
            try {
                const session = await toCompatSession(currentUser());
                return { data: { session }, error: null };
            } catch (error: any) {
                return { data: { session: null }, error };
            }
        },

        getUser: async () => {
            return { data: { user: toCompatUser(currentUser()) }, error: null };
        },

        onAuthStateChange: (
            callback: (event: string, session: any) => void
        ) => {
            const unsub = onAuthStateChanged(auth, async (u) => {
                const session = await toCompatSession(u);
                callback(u ? 'SIGNED_IN' : 'SIGNED_OUT', session);
            });
            return { data: { subscription: { unsubscribe: unsub } } };
        },

        signInWithOAuth: async (opts: { provider: string; options?: any }) => {
            if (opts.provider !== 'google') {
                return { data: null, error: { message: `Provider ${opts.provider} is not supported` } };
            }
            try {
                const res = await authService.signInWithGoogle(opts.options?.redirectTo);

                // Web par purana code khud redirect nahi karta — Supabase karta tha.
                // Wahi behaviour dohra rahe hain.
                const skip = opts.options?.skipBrowserRedirect;
                if (!skip && typeof window !== 'undefined' && window.location && res.url) {
                    window.location.href = res.url;
                }
                return { data: res, error: null };
            } catch (error: any) {
                return { data: null, error: { message: error?.message || 'Google sign-in failed' } };
            }
        },

        signOut: async () => {
            try {
                await authService.signOut();
                return { error: null };
            } catch (error: any) {
                return { error };
            }
        },
    },
};

export default supabase;
