import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, notificationsService } from '../services/supabase';
import { useAuth } from './AuthContext';
import { Notification, NotificationType } from '../types/social';
import { scheduleLocalPostNotification } from '../services/pushNotifications';
import { realtimeSocket } from '../services/realtimeSocket';

interface NotificationsContextValue {
    notifications: Notification[];
    unreadCount: number;
    refresh: () => Promise<void>;
    markAllAsRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue>({
    notifications: [],
    unreadCount: 0,
    refresh: async () => { },
    markAllAsRead: async () => { },
});

export const useNotifications = () => useContext(NotificationsContext);

const mapRowToNotification = (row: any): Notification => {
    const title = row.content || 'Notification';

    return {
        id: row.id,
        userId: row.user_id,
        type: row.type as NotificationType,
        title,
        body: '',
        data: row.data || undefined,
        isRead: row.is_read,
        createdAt: row.created_at,
    };
};

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const didHydrateRef = React.useRef(false);

    const isGuestUser = user?.id === 'guest-user';

    const loadNotifications = useCallback(async () => {
        if (!user || isGuestUser) {
            setNotifications([]);
            return;
        }

        try {
            const rows = await notificationsService.getAll();
            const mapped = (rows || []).map(mapRowToNotification);
            setNotifications(mapped);
        } catch (e) {
            console.log('Error loading notifications', e);
            // For guest users or auth issues, just show empty
            setNotifications([]);
        }
    }, [user, isGuestUser]);

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            return;
        }

        // Guest users: just mark as hydrated and skip network calls
        if (isGuestUser) {
            setNotifications([]);
            didHydrateRef.current = true;
            return;
        }

        // Initial load
        loadNotifications().finally(() => {
            didHydrateRef.current = true;
        });

        // Subscribe to realtime notifications (wrapped in try/catch for Realtime not enabled)
        let channel: any = null;
        try {
          channel = notificationsService.subscribe(user.id, (payload: any) => {
            const row = payload?.new || payload;
            if (!row) return;
            const mapped = mapRowToNotification(row);
            setNotifications(prev => [mapped, ...prev]);

            // OS-level local notification for all types (works in Expo Go)
            if (didHydrateRef.current) {
              scheduleLocalPostNotification(mapped.title || 'New notification');
            }
          });
        } catch (e) {
          console.log('[Notifications] Realtime subscription failed (may not be enabled):', e);
        }

        const unsubscribeSocket = realtimeSocket.onNotification((payload) => {
            if (!payload || payload.userId !== user.id) return;

            const mapped: Notification = {
                id: payload.id,
                userId: payload.userId,
                type: payload.type as NotificationType,
                title: payload.title || 'Notification',
                body: payload.body || '',
                data: (payload.data as Record<string, any>) || undefined,
                isRead: payload.isRead ?? false,
                createdAt: payload.createdAt || new Date().toISOString(),
            };

            setNotifications(prev => [mapped, ...prev]);

            // Also trigger OS-level local notification
            if (didHydrateRef.current) {
                scheduleLocalPostNotification(mapped.title || 'New notification');
            }
        });

        return () => {
            try {
                if (channel) supabase.removeChannel(channel);
            } catch (e) {
                // ignore
            }
            unsubscribeSocket?.();
        };
    }, [user, isGuestUser, loadNotifications]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const markAllAsRead = async () => {
        if (!user || isGuestUser) {
            // For guest users, just clear locally
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            return;
        }
        try {
            await notificationsService.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (e) {
            console.log('Error marking notifications as read', e);
        }
    };

    const value: NotificationsContextValue = {
        notifications,
        unreadCount,
        refresh: loadNotifications,
        markAllAsRead,
    };

    return (
        <NotificationsContext.Provider value={value}>
            {children}
        </NotificationsContext.Provider>
    );
};
