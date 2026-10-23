
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, authService, CompatSession, CompatUser } from '../services/supabase';
import { realtimeSocket } from '../services/realtimeSocket';

type AuthContextType = {
    session: CompatSession | null;
    user: CompatUser | null;
    loading: boolean;
    signIn: typeof authService.signIn;
    signUp: typeof authService.signUp;
    signOut: typeof authService.signOut;
};

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    loading: true,
    signIn: async () => ({} as any),
    signUp: async () => ({} as any),
    signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<CompatSession | null>(null);
    const [user, setUser] = useState<CompatUser | null>(null);
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
            realtimeSocket.connect(user.id);
        } else {
            realtimeSocket.disconnect();
        }

        return () => {
            if (!user?.id) {
                realtimeSocket.disconnect();
            }
        };
    }, [user?.id]);

    const value = {
        session,
        user,
        loading,
        signIn: authService.signIn,
        signUp: authService.signUp,
        signOut: authService.signOut,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
