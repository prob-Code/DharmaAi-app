
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, ActivityIndicator, TouchableOpacity, Text, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MessageCircle, BookOpen, PlayCircle } from 'lucide-react-native';
import * as Linking from 'expo-linking'; // Import Linking
import { Onboarding } from './components/Onboarding';
import { ChatInterface } from './components/ChatInterface';
import { Reflections } from './components/Reflections';
import { Videos } from './components/Videos';
import { SettingsModal } from './components/SettingsModal';
import { AuthScreen } from './components/auth/AuthScreen';
import { InAppNotificationPopup } from './components/InAppNotificationPopup';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { UserSettings, AppState } from './src/types';
import { authService, supabase } from './services/supabase';
import { registerForPushNotificationsAsync } from './services/pushNotifications';

const DEFAULT_SETTINGS: UserSettings = {
  // ... (same as before) ...
  name: 'Friend',
  language: 'en',
  voiceEnabled: true,
  krishnaMode: true,
  soundType: 'flute',
  voiceSpeed: 'slow',
  voiceStyle: 'soft',
  volume: 0.5,
};

const AppContent = () => {
  const { session, loading: authLoading, user, signOut, skipAuth } = useAuth();
  const { theme } = useTheme();
  const [appState, setAppState] = useState<AppState>(AppState.ONBOARDING);
  const [activeTab, setActiveTab] = useState<'companion' | 'reflections' | 'videos'>('companion');
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const lastAuthCallbackUrlRef = useRef<string | null>(null);

  // Auto-skip authentication: go straight to the app as a guest
  useEffect(() => {
    if (!authLoading && !session) {
      skipAuth();
    }
  }, [authLoading, session]);

  // Handle Deep Linking for Auth
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      console.log('--- Deep link received in App.tsx ---');
      console.log('URL:', event.url);
      
      // Some providers/OS flows may return code/token without preserving the callback path.
      // Accept either explicit auth-callback path OR OAuth params in the URL.
      const isAuthCallbackUrl =
        !!event.url &&
        (
          event.url.includes('auth-callback') ||
          event.url.includes('code=') ||
          event.url.includes('access_token=') ||
          event.url.includes('refresh_token=')
        );

      if (!isAuthCallbackUrl) {
        console.log('Ignoring non-auth deep link');
        return;
      }

      // Prevent double-handling the same callback URL
      if (event.url === lastAuthCallbackUrlRef.current) {
        console.log('Ignoring duplicate auth-callback deep link.');
        return;
      }
      lastAuthCallbackUrlRef.current = event.url;

      // If no session yet, this is the primary handler — always try to finalize
      try {
        console.log('[App.tsx] Attempting to finalize OAuth callback...');
        await authService.finalizeOAuthCallback(event.url);
        console.log('[App.tsx] Session finalized correctly from App deep link listener.');
      } catch (err) {
        // Check if a session was actually established by a competing listener
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          console.log('[App.tsx] Deep link finalize errored but session exists — OK.');
        } else {
          console.log(
            '[App.tsx] Deep link finalize failed:',
            (err as any).message
          );
        }
      }
      console.log('---------------------------');
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial URL detected:', url);
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (session) {
      loadState();
    } else {
      // If no session but not loading, stop app loading
      if (!authLoading) setIsAppLoading(false);
    }
  }, [session, authLoading]);

  useEffect(() => {
    if (!user?.id) return;
    // Push notifications are only available on native platforms (iOS/Android)
    if (Platform.OS === 'web') return;
    
    // Fire-and-forget: asks permission, gets Expo token, stores in Supabase.
    registerForPushNotificationsAsync(user.id).then((res) => {
      if (res.ok) {
        console.log('[Push] ✅ Registered successfully, token:', res.expoPushToken);
      } else {
        console.log('[Push] ⚠️ Registration result:', res.reason);
      }
    });
  }, [user?.id]);

  const loadState = async () => {
    // ... (rest of the file remains strictly the same, just keeping proper closures) ...
    try {
      // Production: Check if already onboarded
      const onboarded = await AsyncStorage.getItem('dharma_onboarded');
      const savedSettings = await AsyncStorage.getItem('dharma_settings');

      if (savedSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
      } else if (user?.user_metadata?.username) {
        // Use username from metadata as default name
        setSettings(prev => ({ ...prev, name: user.user_metadata.username }));
      }

      const activeState = onboarded === 'true' ? AppState.CHAT : AppState.ONBOARDING;
      setAppState(activeState);

    } catch (e) {
      console.log('Error loading state', e);
    } finally {
      setIsAppLoading(false);
    }
  };

  const saveSettings = async (newSettings: UserSettings) => {
    try {
      await AsyncStorage.setItem('dharma_settings', JSON.stringify(newSettings));
    } catch (e) {
      console.log('Error saving settings', e);
    }
  };

  const updateSettings = (partial: Partial<UserSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  };

  const handleOnboardingComplete = async (name: string) => {
    updateSettings({ name });
    await AsyncStorage.setItem('dharma_onboarded', 'true');
    setAppState(AppState.CHAT);
  };

  const handleReset = () => {
    setAppState(AppState.ONBOARDING);
    setSettings(DEFAULT_SETTINGS);
    // Don't clear login state, just app state
    loadState();
  };

  if (authLoading || isAppLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  // While auto-skip is processing, show loading
  if (!session) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  const renderContent = () => {
    if (activeTab === 'reflections') {
      return <Reflections settings={settings} />;
    }
    if (activeTab === 'videos') {
      return <Videos settings={settings} />;
    }
    return (
      <ChatInterface
        settings={settings}
        onUpdateSettings={updateSettings}
        onOpenSettings={() => setShowSettings(true)}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />

      {/* Global in-app popup for realtime notifications */}
      <InAppNotificationPopup />

      {appState === AppState.ONBOARDING ? (
        <Onboarding
          onComplete={handleOnboardingComplete}
          settings={settings}
          onUpdateSettings={updateSettings}
        />
      ) : (
        <View style={{ flex: 1 }}>
          {renderContent()}

          {/* Bottom Tab Bar */}
          <View
            style={[
              styles.tabBar,
              {
                backgroundColor: theme.colors.surfaceHighlight,
                borderTopColor: theme.colors.border,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('companion')}
            >
              <MessageCircle
                size={24}
                color={activeTab === 'companion' ? theme.colors.accent : theme.colors.muted}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'companion' ? theme.colors.accent : theme.colors.muted },
                  activeTab === 'companion' && styles.tabTextActive,
                ]}
              >
                Companion
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('videos')}
            >
              <PlayCircle
                size={24}
                color={activeTab === 'videos' ? theme.colors.accent : theme.colors.muted}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'videos' ? theme.colors.accent : theme.colors.muted },
                  activeTab === 'videos' && styles.tabTextActive,
                ]}
              >
                Wisdom
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => setActiveTab('reflections')}
            >
              <BookOpen
                size={24}
                color={activeTab === 'reflections' ? theme.colors.accent : theme.colors.muted}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'reflections' ? theme.colors.accent : theme.colors.muted },
                  activeTab === 'reflections' && styles.tabTextActive,
                ]}
              >
                Reflections
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        onReset={handleReset}
        onSignOut={signOut}
      />
    </View>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationsProvider>
          <AppContent />
        </NotificationsProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: 25,
    paddingTop: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  tabText: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tabTextActive: {
    fontWeight: 'bold',
  }
});
