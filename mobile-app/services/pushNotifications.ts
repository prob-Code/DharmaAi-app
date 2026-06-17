import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// ─── Safe expo-notifications import ───
// expo-notifications remote push was REMOVED from Expo Go in SDK 53+.
// We lazily import and guard every call to prevent fatal crashes.
let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.log('[Push] expo-notifications not available (Expo Go SDK 53+):', (e as any)?.message);
}

// Show notifications even while the app is in the foreground.
if (Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (e) {
    console.log('[Push] Failed to set notification handler:', e);
  }
}

export type RegisterPushResult =
  | { ok: true; expoPushToken: string }
  | { ok: false; reason: string };

export async function registerForPushNotificationsAsync(userId?: string): Promise<RegisterPushResult> {
  try {
    // If expo-notifications isn't available, skip entirely
    if (!Notifications) {
      return { ok: false, reason: 'expo-notifications not available in this environment.' };
    }

    // Push notifications are not available on web
    if (Platform.OS === 'web') {
      return { ok: false, reason: 'Push notifications are not available on web platform.' };
    }

    if (!Device.isDevice) {
      return { ok: false, reason: 'Push notifications require a physical device.' };
    }

    // Check if running in Expo Go (robust check for SDK 53)
    const isExpoGo = 
      Constants.appOwnership === 'expo' || 
      Constants.executionEnvironment === 'storeClient' ||
      Constants.executionEnvironment === Constants.ExecutionEnvironment.StoreClient ||
      !Constants.expoConfig?.extra?.eas?.projectId;

    if (isExpoGo && Platform.OS === 'android') {
      console.log('[Push] ⚠️ Android Expo Go (SDK 53+) detected — skipping remote push registration.');
      return { ok: false, reason: 'Remote push tokens are not available in Expo Go on Android SDK 53+.' };
    }

    // Set up Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D4B483',
      });
    }

    // Request permission
    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;

    if (finalStatus !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== 'granted') {
      return { ok: false, reason: 'Notification permission not granted.' };
    }

    if (isExpoGo) {
      return { ok: false, reason: 'Remote push tokens are not available in Expo Go, but local notifications work.' };
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;

    if (!projectId) {
      return { ok: false, reason: 'Missing EAS projectId (extra.eas.projectId).' };
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse.data;

    if (userId) {
      try {
        await supabase.from('push_tokens').upsert(
          {
            user_id: userId,
            token,
            platform: Platform.OS,
          },
          {
            onConflict: 'user_id,token',
            ignoreDuplicates: true,
          }
        );
      } catch {
        // ignore (still allow notifications locally)
      }
    }

    return { ok: true, expoPushToken: token };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'Failed to register for notifications.' };
  }
}

export async function scheduleLocalPostNotification(title: string) {
  // Local notifications are not available on web or when module is missing
  if (Platform.OS === 'web' || !Notifications) {
    return;
  }
  
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'DharmaAI',
        body: title,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 250, 250, 250],
      },
      trigger: null,
    });
    console.log('[Push] Notification scheduled successfully:', title);
  } catch (err: any) {
    console.warn('[Push] Failed to schedule local notification:', err?.message || err);
  }
}
