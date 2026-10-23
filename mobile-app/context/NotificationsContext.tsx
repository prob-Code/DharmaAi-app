import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { notificationsService } from '../services/supabase';
import { useAuth } from './AuthContext';
import { Notification, NotificationType } from '../types/social';
import { scheduleLocalPostNotification } from '../services/pushNotifications';
import { realtimeSocket } from '../services/realtimeSocket';

interface NotificationsContextValue {
    notifications: Notification[];
    unreadCount: number;
    refresh: () => Promise<void>;
    markRead: (notificationId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue>({
    notifications: [],
    unreadCount: 0,
    refresh: async () => { },
    markRead: async () => { },
    markAllAsRead: async () => { },
});

export const useNotifications = () => useContext(NotificationsContext);

const mapRowToNotification = (row: any, fallbackUserId?: string): Notification => {
    const title = row.content || 'Notification';

    return {
        id: row.id,
        userId: row.user_id || fallbackUserId || '',
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

    const loadNotifications = useCallback(async () => {
        if (!user) {
            setNotifications([]);
            return;
        }

        try {
            const rows = await notificationsService.getAll();
            const mapped = (rows || []).map((row: any) => mapRowToNotification(row, user.id));
            setNotifications(mapped);
        } catch (e) {
            console.log('Error loading notifications', e);
            // For guest users or auth issues, just show empty
            setNotifications([]);
        }
    }, [user]);

    useEffect(() => {
        didHydrateRef.current = false;
        setNotifications([]);

        if (!user) {
            return;
        }

        // Initial load
        loadNotifications().finally(() => {
            didHydrateRef.current = true;
        });

        // Keep the legacy Firestore listener and Socket.IO listener independent.
        let firestoreSubscription: { unsubscribe?: () => void } | undefined;
        try {
            firestoreSubscription = notificationsService.subscribe(user.id, (payload: any) => {
            const row = payload?.new || payload;
            if (!row) return;
            const mapped = mapRowToNotification(row, user.id);
            setNotifications(prev => [mapped, ...prev.filter(item => item.id !== mapped.id)]);

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
            firestoreSubscription?.unsubscribe?.();
            unsubscribeSocket?.();
        };
    }, [user, loadNotifications]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const markRead = async (notificationId: string) => {
        if (!notificationId) return;
        if (!user) {
            setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
            return;
        }
        try {
            await notificationsService.markAsRead(notificationId);
            setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
        } catch (e) {
            console.log('Error marking notification as read', e);
        }
    };

    const markAllAsRead = async () => {
        if (!user) {
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
        markRead,
        markAllAsRead,
    };

    return (
        <NotificationsContext.Provider value={value}>
            {children}
        </NotificationsContext.Provider>
    );
};
