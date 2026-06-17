
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, authService } from '../services/supabase';
import { Session, User } from '@supabase/supabase-js';
import { realtimeSocket } from '../services/realtimeSocket';
import { Config } from '../config';

type AuthContextType = {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signIn: typeof authService.signIn;
    signUp: typeof authService.signUp;
    signOut: typeof authService.signOut;
    skipAuth: () => void;
};

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    loading: true,
    signIn: async () => ({} as any),
    signUp: async () => ({} as any),
    signOut: async () => { },
    skipAuth: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        // Get initial session
        const initSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) throw error;
                if (mounted) {
                    setSession(session);
                    setUser(session?.user ?? null);
                }
            } catch (error) {
                console.error('AuthContext: Error getting session:', error);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        initSession();

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (mounted) {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (user?.id) {
            realtimeSocket.connect(user.id, Config.BACKEND_URL);
        } else {
            realtimeSocket.disconnect();
        }

        return () => {
            if (!user?.id) {
                realtimeSocket.disconnect();
            }
        };
    }, [user?.id]);

    const skipAuth = () => {
        const dummyUser = {
            id: 'guest-user',
            email: 'guest@example.com',
            user_metadata: { username: 'Guest' },
            aud: 'authenticated',
            role: 'authenticated',
        } as any;
        const dummySession = {
            access_token: 'dummy-token',
            refresh_token: 'dummy-refresh',
            expires_in: 3600,
            token_type: 'bearer',
            user: dummyUser,
        } as Session;
        setSession(dummySession);
        setUser(dummyUser);
        setLoading(false);
    };

    const value = {
        session,
        user,
        loading,
        signIn: authService.signIn,
        signUp: authService.signUp,
        signOut: authService.signOut,
        skipAuth,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
