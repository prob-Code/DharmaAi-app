import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';

// Supabase Configuration
const SUPABASE_URL = 'https://mtiltptnumjoaibgpvzb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10aWx0cHRudW1qb2FpYmdwdnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMzU1MTAsImV4cCI6MjA4NjcxMTUxMH0.vfzZ-I306Xb0RIGYLYGSoa-96FtjAOqQlnTgoDTkyVY';

const executionEnvironment = (Constants as any)?.executionEnvironment;
const isExpoGo = executionEnvironment === 'storeClient';
// Expo Go frequently lacks stable WebCrypto support for PKCE in Android custom-tab OAuth flows.
// Use implicit flow there; keep PKCE for development/standalone builds.
const authFlowType: 'pkce' | 'implicit' = isExpoGo ? 'implicit' : 'pkce';

// Create Supabase client with React Native AsyncStorage
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: authFlowType,
    },
    realtime: {
        params: {
            eventsPerSecond: 2
        },
        timeout: 15000,
        heartbeatIntervalMs: 30000,
    }
});

// ─── Helper: Parse URL params without URLSearchParams (RN-safe) ───
function parseUrlParams(url: string): Record<string, string> {
    const params: Record<string, string> = {};
    try {
        // Extract query string (after ?)
        const queryIdx = url.indexOf('?');
        const hashIdx = url.indexOf('#');

        let queryString = '';
        if (queryIdx !== -1) {
            const endIdx = hashIdx > queryIdx ? hashIdx : url.length;
            queryString = url.substring(queryIdx + 1, endIdx);
        }

        // Extract hash fragment (after #)
        let hashString = '';
        if (hashIdx !== -1) {
            hashString = url.substring(hashIdx + 1);
        }

        // Combine both
        const combined = [queryString, hashString].filter(Boolean).join('&');

        // Parse key=value pairs
        combined.split('&').forEach(pair => {
            const [key, ...valueParts] = pair.split('=');
            if (key) {
                params[decodeURIComponent(key)] = decodeURIComponent(valueParts.join('=') || '');
            }
        });
    } catch (e) {
        console.error('[Auth] Error parsing URL params:', e);
    }
    return params;
}

// ─── Helper: Timeout wrapper ───
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(errorMsg));
        }, ms);

        promise
            .then(result => {
                clearTimeout(timer);
                resolve(result);
            })
            .catch(err => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

// ─── Auth Helper Functions ───
let finalizePromise: Promise<any> | null = null;

export const authService = {
    // Sign up with email
    signUp: async (email: string, password: string, username: string) => {
        try {
            console.log('[Auth] Starting sign up for:', email, 'username:', username);
            
            // Validate inputs
            if (!email || !password || !username) {
                throw new Error('Email, password, and username are required');
            }

            if (password.length < 6) {
                throw new Error('Password must be at least 6 characters');
            }

            if (username.length < 3) {
                throw new Error('Username must be at least 3 characters');
            }

            console.log('[Auth] Calling supabase.auth.signUp...');
            
            const { data: authData, error: authError } = await withTimeout(
                supabase.auth.signUp({
                    email: email.toLowerCase().trim(),
                    password,
                    options: {
                        data: {
                            username: username.toLowerCase().trim(),
                            display_name: username,
                        },
                        emailRedirectTo: undefined, // Don't try to redirect on web
                    },
                }),
                15000,
                'Sign up timed out. Please check your internet connection and try again.'
            );

            console.log('[Auth] signUp response - error:', authError, 'data:', authData);

            if (authError) {
                console.error('[Auth] Auth signup error full:', JSON.stringify(authError));
                // Handle common errors
                if (authError.message?.includes('already registered')) {
                    throw new Error('This email is already registered. Please sign in instead.');
                }
                if (authError.message?.includes('invalid')) {
                    throw new Error('Invalid email format. Please try again.');
                }
                throw new Error(getAuthErrorMessage(authError.message, 'signup'));
            }

            console.log('[Auth] Auth signup successful, user ID:', authData?.user?.id);
            console.log('[Auth] User needs confirmation:', authData?.user?.user_metadata?.email_confirmed === false);

            // Manually create profile to ensure it exists (trigger might not fire during signup)
            if (authData?.user?.id) {
                try {
                    console.log('[Auth] Creating profile for user:', authData.user.id);
                    
                    const { error: profileError, data: profileData } = await supabase
                        .from('profiles')
                        .insert({
                            id: authData.user.id,
                            username: username.toLowerCase().trim(),
                            display_name: username,
                            updated_at: new Date().toISOString(),
                        })
                        .select();
                    
                    console.log('[Auth] Profile response - error:', profileError, 'data:', profileData);

                    if (profileError) {
                        console.warn('[Auth] Profile error:', profileError);
                        if (!profileError.message?.includes('duplicate') && !profileError.message?.includes('violates')) {
                            console.warn('[Auth] Unexpected profile error:', profileError.message);
                        }
                    } else {
                        console.log('[Auth] Profile created successfully');
                    }
                } catch (profileErr: any) {
                    console.warn('[Auth] Exception creating profile:', profileErr?.message);
                }
            }

            console.log('[Auth] Sign up complete');
            return authData;
        } catch (error: any) {
            console.error('[Auth] Sign up error:', error.message);
            console.error('[Auth] Full error:', error);
            if (error.message?.includes('timed out')) throw error;
            throw new Error(getAuthErrorMessage(error.message, 'signup'));
        }
    },

    signInWithGoogle: async (redirectUrl?: string) => {
        // On web, this function is not needed since we handle OAuth directly in AuthScreen
        if (typeof window !== 'undefined' && window.location) {
            throw new Error('Use web OAuth flow directly - signInWithGoogle not needed on web');
        }

        const actualRedirectUrl = redirectUrl || Linking.createURL('auth-callback');

        console.log('[Auth] Google Sign-In starting...');
        console.log('[Auth] Redirect URL:', actualRedirectUrl);

        try {
            const { data, error } = await withTimeout(
                supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: actualRedirectUrl,
                        skipBrowserRedirect: true,
                        queryParams: {
                            access_type: 'offline',
                            prompt: 'select_account', // Faster than 'consent'
                        },
                    },
                }),
                15000,
                'Google Sign-In request timed out. Please check your internet connection.'
            );

            if (error) {
                throw new Error(getAuthErrorMessage(error.message, 'google'));
            }

            if (!data?.url) {
                throw new Error('Could not get Google Sign-In URL. Please try again.');
            }

            console.log('[Auth] Got OAuth URL, opening browser...');
            return data;
        } catch (error: any) {
            if (error.message?.includes('timed out')) throw error;
            throw new Error(getAuthErrorMessage(error.message, 'google'));
        }
    },

    // Finalize OAuth callback from deep link/browser URL
    finalizeOAuthCallback: async (callbackUrl: string) => {
        if (finalizePromise) {
            console.log('[Auth] OAuth finalization already in progress, waiting for it to complete...');
            return finalizePromise;
        }

        finalizePromise = (async () => {
            console.log('[Auth] Finalizing OAuth callback...');
            console.log('[Auth] Callback URL (truncated):', callbackUrl.substring(0, 120) + '...');

            try {
                // Quick check: if we already have a session, skip finalization
                const { data: existingSession } = await supabase.auth.getSession();
                if (existingSession?.session) {
                    console.log('[Auth] Session already exists, skipping finalization.');
                    return existingSession;
                }

                const params = parseUrlParams(callbackUrl);

                const accessToken = params['access_token'];
                const refreshToken = params['refresh_token'];
                const code = params['code'];
                const errorParam = params['error'];
                const errorDescription = params['error_description'];

                // Check for OAuth error in URL
                if (errorParam) {
                    const errorMsg = errorDescription || errorParam;
                    console.error('[Auth] OAuth error in callback:', errorMsg);
                    throw new Error(`Authentication failed: ${errorMsg}`);
                }

                // Token-based flow (implicit grant)
                if (accessToken && refreshToken) {
                    console.log('[Auth] Found tokens in callback URL, setting session...');
                    const { data, error } = await withTimeout(
                        supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        }),
                        10000,
                        'Setting session timed out. Please try signing in again.'
                    );
                    if (error) {
                        console.error('[Auth] setSession error:', error.message);
                        throw new Error(getAuthErrorMessage(error.message, 'session'));
                    }
                    console.log('[Auth] Session set successfully!');
                    return data;
                }

                // Code-based flow (PKCE)
                if (code) {
                    console.log('[Auth] Found auth code, exchanging for session...');
                    
                    // Re-check if session appeared while we were parsing
                    const { data: currentSession } = await supabase.auth.getSession();
                    if (currentSession?.session) {
                        console.log('[Auth] Session already active. Skipping duplicate code exchange.');
                        return currentSession;
                    }

                    const { data, error } = await withTimeout(
                        supabase.auth.exchangeCodeForSession(code),
                        10000,
                        'Code exchange timed out. Please try signing in again.'
                    );
                    
                    if (error) {
                        // Common on Android: code was already consumed by a parallel handler
                        const errMsg = error.message?.toLowerCase() || '';
                        const isCodeConsumed = errMsg.includes('already') || 
                                              errMsg.includes('invalid') || 
                                              errMsg.includes('expired') ||
                                              errMsg.includes('used');
                        
                        // Check if a concurrent request already succeeded in setting the session
                        const { data: latestSession } = await supabase.auth.getSession();
                        if (latestSession?.session) {
                            console.log('[Auth] Code exchange error handled gracefully (session already exists).');
                            return latestSession;
                        }

                        if (isCodeConsumed) {
                            console.warn('[Auth] Auth code appears to have been consumed already. No session found.');
                            throw new Error('The sign-in verification code was already used. Please try signing in again.');
                        }

                        console.error('[Auth] exchangeCodeForSession error:', error.message);
                        throw new Error(getAuthErrorMessage(error.message, 'session'));
                    }
                    console.log('[Auth] Code exchanged successfully!');
                    return data;
                }

                // No tokens or code — check if session exists anyway (set by listener)
                const { data: fallbackSession } = await supabase.auth.getSession();
                if (fallbackSession?.session) {
                    console.log('[Auth] No tokens/code in URL but session exists.');
                    return fallbackSession;
                }

                console.error('[Auth] No tokens or code found in callback URL');
                console.error('[Auth] Parsed params keys:', Object.keys(params).join(', '));
                throw new Error('Authentication failed. The sign-in response was invalid. Please try again.');
            } catch (error: any) {
                console.error('[Auth] finalizeOAuthCallback error:', error.message);
                throw error;
            } finally {
                finalizePromise = null;
            }
        })();

        return finalizePromise;
    },

    // Sign in with email
    signIn: async (email: string, password: string) => {
        try {
            const { data, error } = await withTimeout(
                supabase.auth.signInWithPassword({
                    email,
                    password,
                }),
                15000,
                'Sign in timed out. Please check your internet connection and try again.'
            );

            if (error) {
                throw new Error(getAuthErrorMessage(error.message, 'signin'));
            }

            return data;
        } catch (error: any) {
            if (error.message?.includes('timed out')) throw error;
            throw new Error(getAuthErrorMessage(error.message, 'signin'));
        }
    },

    // Sign out
    signOut: async () => {
        try {
            const { error } = await withTimeout(
                supabase.auth.signOut(),
                10000,
                'Sign out timed out. Your local session has been cleared.'
            );
            if (error) {
                console.error('[Auth] Sign out error:', error.message);
                // Clear local session even if server sign-out fails
                await AsyncStorage.removeItem('sb-mtiltptnumjoaibgpvzb-auth-token');
            }
        } catch (error: any) {
            console.error('[Auth] Sign out error:', error.message);
            // Clear local session as fallback
            await AsyncStorage.removeItem('sb-mtiltptnumjoaibgpvzb-auth-token');
        }
    },

    // Get current user
    getCurrentUser: async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            return user;
        } catch {
            return null;
        }
    },

    // Get user profile
    getProfile: async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return data;
    },

    // Update profile
    updateProfile: async (userId: string, updates: any) => {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
};

// ─── User-friendly error messages ───
function getAuthErrorMessage(rawMessage: string, context: 'signin' | 'signup' | 'google' | 'session'): string {
    const msg = (rawMessage || '').toLowerCase();

    // Network errors
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection') || msg.includes('econnrefused')) {
        return 'No internet connection. Please check your network and try again.';
    }

    // Rate limiting
    if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('429')) {
        return 'Too many attempts. Please wait a moment and try again.';
    }

    // Sign-in specific
    if (context === 'signin') {
        if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
            return 'Incorrect email or password. Please check and try again.';
        }
        if (msg.includes('email not confirmed')) {
            return 'Please verify your email before signing in. Check your inbox for the verification link.';
        }
    }

    // Sign-up specific
    if (context === 'signup') {
        if (msg.includes('already registered') || msg.includes('user already exists') || msg.includes('duplicate')) {
            return 'An account with this email already exists. Please sign in instead.';
        }
        if (msg.includes('password') && (msg.includes('short') || msg.includes('weak') || msg.includes('at least'))) {
            return 'Password is too weak. Please use at least 6 characters with a mix of letters and numbers.';
        }
        if (msg.includes('valid email') || msg.includes('invalid email')) {
            return 'Please enter a valid email address.';
        }
        if (msg.includes('row-level security')) {
            // RLS error on profile creation - account was actually created
            return 'Account created successfully! Please sign in.';
        }
    }

    // Google specific
    if (context === 'google') {
        if (msg.includes('popup') || msg.includes('cancelled') || msg.includes('canceled')) {
            return 'Sign-in was cancelled. Please try again.';
        }
    }

    // Session errors
    if (context === 'session') {
        if (msg.includes('expired') || msg.includes('invalid refresh')) {
            return 'Your session has expired. Please sign in again.';
        }
    }

    // Generic fallback
    return rawMessage || 'Something went wrong. Please try again.';
}

// Posts Service
export const postsService = {
    // Create a new post
    create: async (content: string, moodTag?: string, isAnonymous = false, imageUrl?: string) => {
        const user = await authService.getCurrentUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('posts')
            .insert({
                user_id: user.id,
                content,
                mood_tag: moodTag,
                is_anonymous: isAnonymous,
                image_url: imageUrl,
            })
            .select(`
                *,
                user:profiles(*)
            `)
            .single();

        if (error) throw error;
        return data;
    },

    // Get feed posts (from followed users)
    getFeed: async (limit = 20, cursor?: string) => {
        const user = await authService.getCurrentUser();
        if (!user) throw new Error('Not authenticated');

        let query = supabase
            .from('posts')
            .select(`
                *,
                user:profiles(*),
                is_liked:likes(user_id)
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (cursor) {
            query = query.lt('created_at', cursor);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Transform to check if current user liked
        return data.map(post => ({
            ...post,
            isLiked: post.is_liked?.some((like: any) => like.user_id === user.id) || false,
        }));
    },

    // Get explore posts (public posts from anyone)
    getExplore: async (limit = 20, cursor?: string) => {
        const user = await authService.getCurrentUser();

        let query = supabase
            .from('posts')
            .select(`
                *,
                user:profiles(*),
                is_liked:likes(user_id)
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (cursor) {
            query = query.lt('created_at', cursor);
        }

        const { data, error } = await query;
        if (error) throw error;

        return data.map(post => ({
            ...post,
            isLiked: user ? post.is_liked?.some((like: any) => like.user_id === user.id) : false,
        }));
    },

    // Get posts by user
    getByUser: async (userId: string, limit = 20) => {
        const { data, error } = await supabase
            .from('posts')
            .select(`
                *,
                user:profiles(*)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    },

    // Get single post with comments
    getById: async (postId: string) => {
        const { data, error } = await supabase
            .from('posts')
            .select(`
                *,
                user:profiles(*),
                comments(
                    *,
                    user:profiles(*)
                )
            `)
            .eq('id', postId)
            .single();

        if (error) throw error;
        return data;
    },

    // Delete a post
    delete: async (postId: string) => {
        const { error } = await supabase
            .from('posts')
            .delete()
            .eq('id', postId);

        if (error) throw error;
    },
};

// Likes Service
export const likesService = {
    // Toggle like on a post
    toggle: async (postId: string) => {
        const user = await authService.getCurrentUser();
        if (!user) throw new Error('Not authenticated');

        // Check if already liked
        const { data: existing } = await supabase
            .from('likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', user.id)
            .single();

        if (existing) {
            // Unlike
            await supabase.from('likes').delete().eq('id', existing.id);
            await supabase.rpc('decrement_likes', { post_id: postId });
            return false;
        } else {
            // Like
            await supabase.from('likes').insert({ post_id: postId, user_id: user.id });
            await supabase.rpc('increment_likes', { post_id: postId });
            return true;
        }
    },
};

// Comments Service
export const commentsService = {
    // Create a comment
    create: async (postId: string, content: string, isAnonymous = false) => {
        const user = await authService.getCurrentUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('comments')
            .insert({
                post_id: postId,
                user_id: user.id,
                content,
                is_anonymous: isAnonymous,
            })
            .select(`
                *,
                user:profiles(*)
            `)
            .single();

        if (error) throw error;

        // Increment comment count
        await supabase.rpc('increment_comments', { post_id: postId });

        return data;
    },

    // Get comments for a post
    getByPost: async (postId: string) => {
        const { data, error } = await supabase
            .from('comments')
            .select(`
                *,
                user:profiles(*)
            `)
            .eq('post_id', postId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data;
    },

    // Delete a comment
    delete: async (commentId: string, postId: string) => {
        const { error } = await supabase
            .from('comments')
            .delete()
            .eq('id', commentId);

        if (error) throw error;

        // Decrement comment count
        await supabase.rpc('decrement_comments', { post_id: postId });
    },
};

// Follows Service
export const followsService = {
    // Follow a user
    follow: async (userId: string) => {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('follows')
            .insert({
                follower_id: currentUser.id,
                following_id: userId,
            });

        if (error) throw error;
    },

    // Unfollow a user
    unfollow: async (userId: string) => {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('follows')
            .delete()
            .eq('follower_id', currentUser.id)
            .eq('following_id', userId);

        if (error) throw error;
    },

    // Check if following
    isFollowing: async (userId: string) => {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser) return false;

        const { data } = await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', currentUser.id)
            .eq('following_id', userId)
            .single();

        return !!data;
    },

    // Get followers
    getFollowers: async (userId: string) => {
        const { data, error } = await supabase
            .from('follows')
            .select(`
                follower:profiles!follower_id(*)
            `)
            .eq('following_id', userId);

        if (error) throw error;
        return data.map(f => f.follower);
    },

    // Get following
    getFollowing: async (userId: string) => {
        const { data, error } = await supabase
            .from('follows')
            .select(`
                following:profiles!following_id(*)
            `)
            .eq('follower_id', userId);

        if (error) throw error;
        return data.map(f => f.following);
    },
};

// Messages Service
export const messagesService = {
    // Send a message
    send: async (receiverId: string, content: string) => {
        const user = await authService.getCurrentUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('messages')
            .insert({
                sender_id: user.id,
                receiver_id: receiverId,
                content,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Get conversations list
    getConversations: async () => {
        const user = await authService.getCurrentUser();
        if (!user) throw new Error('Not authenticated');

        // Get unique conversation partners
        const { data, error } = await supabase
            .from('messages')
            .select(`
                *,
                sender:profiles!sender_id(*),
                receiver:profiles!receiver_id(*)
            `)
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Group by conversation partner
        const conversations = new Map();
        data.forEach(msg => {
            const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
            const otherUser = msg.sender_id === user.id ? msg.receiver : msg.sender;

            if (!conversations.has(otherId)) {
                conversations.set(otherId, {
                    otherUser,
                    lastMessage: msg,
                    unreadCount: msg.receiver_id === user.id && !msg.is_read ? 1 : 0,
                });
            } else if (msg.receiver_id === user.id && !msg.is_read) {
                conversations.get(otherId).unreadCount++;
            }
        });

        return Array.from(conversations.values());
    },

    // Get messages with a user
    getWithUser: async (userId: string) => {
        const user = await authService.getCurrentUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Mark as read
        await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('receiver_id', user.id)
            .eq('sender_id', userId);

        return data;
    },

    // Subscribe to new messages
    subscribeToMessages: (userId: string, callback: (msg: any) => void) => {
        return supabase
            .channel('messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `receiver_id=eq.${userId}`,
                },
                callback
            )
            .subscribe();
    },
};

// Communities Service
export const communitiesService = {
    // Create a community
    create: async (name: string, description: string, category: string, isPrivate = false) => {
        const user = await authService.getCurrentUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('communities')
            .insert({
                name,
                description,
                category,
                is_private: isPrivate,
                creator_id: user.id,
            })
            .select()
            .single();

        if (error) throw error;

        // Add creator as admin
        await supabase.from('community_members').insert({
            community_id: data.id,
            user_id: user.id,
            role: 'admin',
        });

        return data;
    },

    // Get all communities
    getAll: async (category?: string) => {
        let query = supabase
            .from('communities')
            .select('*')
            .order('member_count', { ascending: false });

        if (category) {
            query = query.eq('category', category);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    // Join a community
    join: async (communityId: string) => {
        const user = await authService.getCurrentUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('community_members')
            .insert({
                community_id: communityId,
                user_id: user.id,
                role: 'member',
            });

        if (error) throw error;

        // Increment member count
        await supabase.rpc('increment_community_members', { community_id: communityId });
    },

    // Leave a community
    leave: async (communityId: string) => {
        const user = await authService.getCurrentUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('community_members')
            .delete()
            .eq('community_id', communityId)
            .eq('user_id', user.id);

        if (error) throw error;

        // Decrement member count
        await supabase.rpc('decrement_community_members', { community_id: communityId });
    },

    // Get community posts
    getPosts: async (communityId: string, limit = 20) => {
        const { data, error } = await supabase
            .from('posts')
            .select(`
                *,
                user:profiles(*)
            `)
            .eq('community_id', communityId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    },
};

// Notifications Service
export const notificationsService = {
    // Create a notification for a user
    create: async (targetUserId: string, type: string, content: string, data?: Record<string, any>) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .insert({
                    user_id: targetUserId,
                    type,
                    content,
                    data: data || {},
                    is_read: false,
                });
            if (error) {
                console.log('[Notifications] Insert error (may not have table/RLS):', error.message);
            }
        } catch (e) {
            // Don't crash the app if notifications table doesn't exist yet
            console.log('[Notifications] Create failed gracefully:', e);
        }
    },

    // Get notifications for current user
    getAll: async () => {
        const user = await authService.getCurrentUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        return data;
    },

    // Mark as read
    markAsRead: async (notificationId: string) => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        if (error) throw error;
    },

    // Mark all as read
    markAllAsRead: async () => {
        const user = await authService.getCurrentUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id);

        if (error) throw error;
    },

    // Subscribe to new notifications
    subscribe: (userId: string, callback: (notification: any) => void) => {
        return supabase
            .channel('notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                callback
            )
            .subscribe();
    },
};

export default supabase;
