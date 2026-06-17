
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
    ScrollView,
    ImageBackground
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { authService, supabase } from '../../services/supabase';
import { COLORS } from '../../constants';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Constants from 'expo-constants';

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';

// Ensure WebBrowser sessions are handled
WebBrowser.maybeCompleteAuthSession();

// Auth timeout in milliseconds (30 seconds)
const AUTH_TIMEOUT_MS = 30000;

export const AuthScreen = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const { signIn, signUp, skipAuth } = useAuth();
    const { signInWithGoogle } = authService;
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const oauthLinkSubRef = useRef<{ remove: () => void } | null>(null);
    const oauthFinalizeInProgressRef = useRef(false);

    // Warm up the browser for better performance (native only)
    useEffect(() => {
        // WebBrowser warmUp is only available on native platforms (iOS/Android)
        if (Platform.OS !== 'web') {
            WebBrowser.warmUpAsync();
            return () => {
                WebBrowser.coolDownAsync();
                // Clear any pending timeout on unmount
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
            };
        } else {
            // On web, just clear timeout on unmount
            return () => {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
            };
        }
    }, []);

    // Safety timeout: reset loading state if it's stuck
    const startLoadingWithTimeout = (message: string) => {
        setLoading(true);
        setLoadingMessage(message);

        // Clear any existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set a safety timeout to prevent infinite loading
        timeoutRef.current = setTimeout(() => {
            setLoading(false);
            setLoadingMessage('');
            const isGoogleFlow = message.toLowerCase().includes('google');
            Alert.alert(
                'Taking too long',
                isGoogleFlow
                    ? 'Google sign-in did not return to the app in time. If you are using Expo Go, the custom scheme redirect may not work. Please run an Android dev build (e.g. `expo run:android`) and ensure `dharmaai://auth-callback` is registered in Google + Supabase.'
                    : 'The authentication is taking longer than expected. Please check your internet connection and try again.',
                [{ text: 'OK' }]
            );
        }, AUTH_TIMEOUT_MS);
    };

    const stopLoading = () => {
        setLoading(false);
        setLoadingMessage('');
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const clearOAuthDeepLinkListener = () => {
        if (oauthLinkSubRef.current) {
            oauthLinkSubRef.current.remove();
            oauthLinkSubRef.current = null;
        }
        oauthFinalizeInProgressRef.current = false;
    };

    const startOAuthDeepLinkListener = () => {
        clearOAuthDeepLinkListener();

        oauthLinkSubRef.current = Linking.addEventListener('url', async ({ url }) => {
            const hasAuthParams = !!url && (
                url.includes('auth-callback') ||
                url.includes('code=') ||
                url.includes('access_token=') ||
                url.includes('refresh_token=')
            );

            if (!hasAuthParams || oauthFinalizeInProgressRef.current) {
                return;
            }

            try {
                oauthFinalizeInProgressRef.current = true;
                setLoadingMessage('Finishing sign-in...');
                console.log('[AuthScreen] Deep link callback received:', url);
                await authService.finalizeOAuthCallback(url);
                console.log('[AuthScreen] OAuth finalized from deep link listener.');
            } catch (err: any) {
                console.log('[AuthScreen] Deep link finalize failed:', err?.message);
            } finally {
                oauthFinalizeInProgressRef.current = false;
            }
        });
    };

    const waitForSession = async (timeoutMs = 10000, intervalMs = 400): Promise<boolean> => {
        const start = Date.now();

        while (Date.now() - start < timeoutMs) {
            const { data } = await supabase.auth.getSession();
            if (data?.session) {
                return true;
            }
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }

        return false;
    };

    const getNativeRedirectUrl = () => {
        return makeRedirectUri({
            preferLocalhost: true,
            scheme: 'dharmaai',
            path: 'auth-callback',
        });
    };

    const handleGoogleSignIn = async () => {
        try {
            startLoadingWithTimeout('Connecting to Google...');

            // For web, use a simple HTTP redirect URL.
            // For native/Expo Go, use runtime deep link URL so the current host/port is always correct.
            let redirectUrl = '';
            
            if (Platform.OS === 'web') {
                // On web, use the current origin
                if (typeof window !== 'undefined') {
                    redirectUrl = `${window.location.origin}/auth-callback`;
                } else {
                    redirectUrl = 'http://localhost:8081/auth-callback';
                }
            } else {
                redirectUrl = getNativeRedirectUrl();
            }
            
            console.log('[AuthScreen] Starting Google Sign-In');
            console.log('[AuthScreen] Platform:', Platform.OS);
            console.log('[AuthScreen] Redirect URL:', redirectUrl);

            setLoadingMessage('Opening Google Sign-In...');
            
            if (Platform.OS === 'web') {
                // On web, use standard OAuth flow without skipBrowserRedirect
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: redirectUrl,
                        skipBrowserRedirect: false, // Let Supabase handle browser redirect
                        queryParams: {
                            access_type: 'offline',
                            prompt: 'select_account',
                        },
                    },
                });

                if (error) {
                    throw new Error(error.message || 'Could not start Google Sign-In');
                }

                console.log('[AuthScreen] OAuth flow initiated on web');
                // On web, Supabase will handle the redirect automatically
                // The component will unmount when the session is detected by AuthContext
            } else {
                // ─── Native: use custom OAuth flow with browser session ───

                // 1) Register deep-link listener BEFORE opening the browser
                startOAuthDeepLinkListener();

                // 2) Get OAuth URL from Supabase
                const result = await signInWithGoogle(redirectUrl);

                if (!result?.url) {
                    stopLoading();
                    Alert.alert('Error', 'Could not start Google Sign-In. Please try again.');
                    return;
                }

                console.log('[AuthScreen] OAuth provider URL obtained, opening browser...');
                setLoadingMessage('Waiting for sign-in...');

                // 3) Open the browser
                const browserResult = await WebBrowser.openAuthSessionAsync(
                    result.url,
                    redirectUrl
                );

                console.log('[AuthScreen] Browser result type:', browserResult.type);

                // 4) Handle browser result
                if (browserResult.type === 'success' && browserResult.url) {
                    // Best case: browser detected the redirect
                    setLoadingMessage('Finishing sign-in...');
                    console.log('[AuthScreen] Browser success URL:', browserResult.url);
                    try {
                        await authService.finalizeOAuthCallback(browserResult.url);
                        console.log('[AuthScreen] OAuth finalized from browser success!');
                        return;
                    } catch (finalizeErr: any) {
                        console.log('[AuthScreen] Browser success finalize error:', finalizeErr?.message);
                        // May have been handled by deep link listener already — check session
                        const { data: currentSession } = await supabase.auth.getSession();
                        if (currentSession?.session) {
                            console.log('[AuthScreen] Session already active after browser success.');
                            return;
                        }
                    }
                }

                // 5) Fallback: browser returned dismiss/cancel (common on Android)
                //    The deep link listener or App.tsx might have already handled it.
                console.log('[AuthScreen] Browser did not return success. Checking fallbacks...');
                setLoadingMessage('Finishing sign-in...');

                // Check if session is already active (deep link listener may have set it)
                const { data: immediateSession } = await supabase.auth.getSession();
                if (immediateSession?.session) {
                    console.log('[AuthScreen] Session already active after browser return.');
                    stopLoading();
                    return;
                }

                // Check initial URL (app may have been relaunched with the deep link)
                try {
                    const maybeInitialUrl = await Linking.getInitialURL();
                    const hasAuthParams = !!maybeInitialUrl && (
                        maybeInitialUrl.includes('auth-callback') ||
                        maybeInitialUrl.includes('code=') ||
                        maybeInitialUrl.includes('access_token=') ||
                        maybeInitialUrl.includes('refresh_token=')
                    );

                    if (hasAuthParams && maybeInitialUrl) {
                        console.log('[AuthScreen] Fallback finalize from initial URL:', maybeInitialUrl);
                        setLoadingMessage('Finishing sign-in...');
                        await authService.finalizeOAuthCallback(maybeInitialUrl);
                        console.log('[AuthScreen] Fallback finalize succeeded!');
                        return;
                    }
                } catch (fallbackError: any) {
                    console.log('[AuthScreen] Fallback initial URL finalize failed:', fallbackError?.message);
                }

                // Final fallback: poll for session (deep link listener may set it asynchronously)
                console.log('[AuthScreen] Polling for session...');
                const sessionBecameActive = await waitForSession(15000, 500);
                if (sessionBecameActive) {
                    console.log('[AuthScreen] Session became active during fallback polling.');
                    stopLoading();
                    return;
                }

                // Nothing worked — show helpful error
                stopLoading();
                const executionEnvironment = (Constants as any)?.executionEnvironment;
                const isExpoGo = executionEnvironment === 'storeClient';
                Alert.alert(
                    'Sign-In Issue',
                    isExpoGo
                        ? `The app did not receive the callback redirect in Expo Go. Please add this exact URL in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:\n\n${redirectUrl}\n\nFor stable Google OAuth on Android, use a development build (expo run:android) so the app uses:\n\ndharmaai://auth-callback`
                        : `The app did not receive the callback redirect. Please make sure this URL is listed in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:\n\n${redirectUrl}`
                );
            }
        } catch (error: any) {
            console.error('[AuthScreen] Google Sign-In error:', error.message);
            stopLoading();
            Alert.alert('Google Sign-In Error', error.message || 'Something went wrong. Please try again.');
        } finally {
            clearOAuthDeepLinkListener();
        }
    };

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleSubmit = async () => {
        // Validate inputs
        if (!email.trim() || !password) {
            Alert.alert('Missing Fields', 'Please fill in both email and password.');
            return;
        }

        if (!validateEmail(email.trim())) {
            Alert.alert('Invalid Email', 'Please enter a valid email address.');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
            return;
        }

        if (!isLogin && !username.trim()) {
            Alert.alert('Missing Username', 'Username is required for signup.');
            return;
        }

        startLoadingWithTimeout(isLogin ? 'Signing in...' : 'Creating account...');

        try {
            if (isLogin) {
                await signIn(email.trim(), password);
                // Success - AuthContext will handle UI change
            } else {
                try {
                    await signUp(email.trim(), password, username.trim());
                    stopLoading();
                    Alert.alert(
                        'Account Created! 🎉',
                        'Your account has been created. Please check your email for verification (if required), then sign in.',
                        [{ text: 'OK', onPress: () => setIsLogin(true) }]
                    );
                } catch (signUpError: any) {
                    const msg = signUpError.message || '';
                    // Handle RLS/trigger edge cases - account may have been created
                    if (msg.includes('row-level security') || msg.includes('duplicate key') || msg.includes('already exists')) {
                        stopLoading();
                        Alert.alert(
                            'Account Created',
                            'Your account has been created. You can now sign in.',
                            [{ text: 'OK', onPress: () => setIsLogin(true) }]
                        );
                    } else {
                        throw signUpError;
                    }
                }
            }
        } catch (error: any) {
            stopLoading();
            console.error('[AuthScreen] handleSubmit error:', error);
            Alert.alert('Authentication Error', error.message || 'Something went wrong. Please try again.');
        }
    };

    return (
        <ImageBackground
            source={{ uri: 'https://mtiltptnumjoaibgpvzb.supabase.co/storage/v1/object/public/assets/lotusReflection.jpeg' }}
            style={styles.container}
            resizeMode="cover"
        >
            <View style={styles.overlay} />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <Text style={styles.title}>DharmaAI</Text>
                        <Text style={styles.subtitle}>
                            {isLogin ? 'Sign in to continue your journey' : 'Begin your journey to inner peace'}
                        </Text>
                    </View>

                    <BlurView intensity={30} tint="dark" style={styles.formContainer}>
                        {!isLogin && (
                            <View style={styles.inputGroup}>
                                <Feather name="user" size={20} color={COLORS.muted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Username"
                                    placeholderTextColor={COLORS.muted}
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="none"
                                    editable={!loading}
                                />
                            </View>
                        )}

                        <View style={styles.inputGroup}>
                            <Feather name="mail" size={20} color={COLORS.muted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email"
                                placeholderTextColor={COLORS.muted}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                editable={!loading}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Feather name="lock" size={20} color={COLORS.muted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor={COLORS.muted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                editable={!loading}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading && loadingMessage && !loadingMessage.includes('Google') ? (
                                <View style={styles.loadingRow}>
                                    <ActivityIndicator color="#000" size="small" />
                                    <Text style={[styles.buttonText, { marginLeft: 8 }]}>
                                        {loadingMessage}
                                    </Text>
                                </View>
                            ) : (
                                <Text style={styles.buttonText}>
                                    {isLogin ? 'Sign In' : 'Create Account'}
                                </Text>
                            )}
                        </TouchableOpacity>

                        {/* Google Sign In Button */}
                        <View style={styles.dividerContainer}>
                            <View style={styles.divider} />
                            <Text style={styles.dividerText}>OR</Text>
                            <View style={styles.divider} />
                        </View>

                        <TouchableOpacity
                            style={[styles.googleButton, loading && styles.buttonDisabled]}
                            onPress={handleGoogleSignIn}
                            disabled={loading}
                        >
                            {loading && loadingMessage?.includes('Google') ? (
                                <View style={styles.loadingRow}>
                                    <ActivityIndicator color="#fff" size="small" />
                                    <Text style={[styles.googleButtonText, { marginLeft: 8 }]}>
                                        {loadingMessage}
                                    </Text>
                                </View>
                            ) : (
                                <>
                                    <Feather name="globe" size={20} color="#fff" style={{ marginRight: 10 }} />
                                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                                </>
                            )}
                        </TouchableOpacity>

                    </BlurView>

                    <TouchableOpacity
                        style={styles.switchButton}
                        onPress={() => {
                            setIsLogin(!isLogin);
                            setEmail('');
                            setPassword('');
                            setUsername('');
                        }}
                        disabled={loading}
                    >
                        <Text style={[styles.switchText, loading && { opacity: 0.5 }]}>
                            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.switchButton, { marginTop: 16 }]}
                        onPress={skipAuth}
                        disabled={loading}
                    >
                        <Text style={[styles.switchText, { color: COLORS.muted, fontSize: 12, textDecorationLine: 'underline' }]}>
                            Bypass Authentication (Development Mode)
                        </Text>
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 36,
        color: COLORS.accent,
        fontWeight: 'bold',
        marginBottom: 10,
        letterSpacing: 1,
    },
    subtitle: {
        color: COLORS.muted,
        fontSize: 14,
        textAlign: 'center',
    },
    formContainer: {
        borderRadius: 24,
        padding: 24,
        overflow: 'hidden',
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 12,
        marginBottom: 16,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: COLORS.text,
        height: 50,
        fontSize: 16,
    },
    button: {
        backgroundColor: COLORS.accent,
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    dividerText: {
        color: COLORS.muted,
        paddingHorizontal: 10,
        fontSize: 12,
    },
    googleButton: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.1)',
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    googleButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    switchButton: {
        marginTop: 24,
        alignItems: 'center',
    },
    switchText: {
        color: COLORS.text,
        fontSize: 14,
    },
});
