// NotificationList Component - Display all notifications
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl
} from 'react-native';
import { Bell, Heart, MessageCircle, UserPlus, Users, AtSign, Sparkles, ArrowLeft, Video } from 'lucide-react-native';
import { Avatar } from '../Common/Avatar';
import { Notification, NotificationType } from '../../../types/social';
import { formatDistanceToNow } from 'date-fns';

interface NotificationListProps {
    notifications: Notification[];
    onNotificationPress: (notification: Notification) => void;
    onRefresh: () => Promise<void>;
    onMarkAllRead: () => void;
    onBack?: () => void;
}

const COLORS = {
    accent: '#C1A18A',
    text: '#E8EAF6',
    muted: '#768783',
    background: '#111625',
    cardBg: '#1a1f2e',
    border: 'rgba(255,255,255,0.05)',
    unread: 'rgba(197, 160, 89, 0.1)',
};

const NOTIFICATION_ICONS: Record<NotificationType, React.ReactNode> = {
    like: <Heart size={16} color="#FF6B6B" fill="#FF6B6B" />,
    comment: <MessageCircle size={16} color="#4CAF50" />,
    follow: <UserPlus size={16} color="#2196F3" />,
    message: <MessageCircle size={16} color="#9C27B0" />,
    community_invite: <Users size={16} color="#FF9800" />,
    community_post: <Users size={16} color="#00BCD4" />,
    mention: <AtSign size={16} color="#E91E63" />,
    support_reaction: <Sparkles size={16} color={COLORS.accent} />,
    video_call: <Video size={16} color="#60a5fa" />,
};

interface NotificationItemProps {
    notification: Notification;
    onPress: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onPress }) => {
    const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });
    const isVideoCall = notification.type === 'video_call';

    return (
        <TouchableOpacity
            style={[styles.notificationItem, !notification.isRead && styles.unread, isVideoCall && styles.videoCallItem]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[styles.iconContainer, isVideoCall && styles.videoCallIconContainer]}>
                {NOTIFICATION_ICONS[notification.type]}
            </View>

            <View style={styles.contentContainer}>
                <Text style={styles.notificationTitle} numberOfLines={2}>
                    {notification.title}
                </Text>
                {notification.body && (
                    <Text style={styles.notificationBody} numberOfLines={1}>
                        {notification.body}
                    </Text>
                )}
                <Text style={styles.timeAgo}>{timeAgo}</Text>
            </View>

            {isVideoCall && notification.data?.roomName ? (
                <View style={styles.joinCallBadge}>
                    <Video size={12} color="#fff" />
                    <Text style={styles.joinCallText}>Join</Text>
                </View>
            ) : (
                !notification.isRead && <View style={styles.unreadDot} />
            )}
        </TouchableOpacity>
    );
};

export const NotificationList: React.FC<NotificationListProps> = ({
    notifications,
    onNotificationPress,
    onRefresh,
    onMarkAllRead,
    onBack,
}) => {
    const [refreshing, setRefreshing] = React.useState(false);

    const handleRefresh = async () => {
        setRefreshing(true);
        await onRefresh();
        setRefreshing(false);
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.headerLeft}>
                {onBack && (
                    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                        <ArrowLeft size={20} color={COLORS.accent} />
                    </TouchableOpacity>
                )}
                <View>
                    <Text style={styles.title}>Notifications</Text>
                    {unreadCount > 0 && (
                        <Text style={styles.subtitle}>{unreadCount} unread</Text>
                    )}
                </View>
            </View>
            {unreadCount > 0 && (
                <TouchableOpacity style={styles.markReadBtn} onPress={onMarkAllRead}>
                    <Text style={styles.markReadText}>Mark all as read</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
                <Bell size={48} color={COLORS.muted} />
            </View>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>
                When someone interacts with you, you'll see it here
            </Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <NotificationItem
                        notification={item}
                        onPress={() => onNotificationPress(item)}
                    />
                )}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmpty}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={COLORS.accent}
                    />
                }
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    listContent: {
        paddingBottom: 100,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 20,
        paddingBottom: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    backBtn: {
        marginRight: 8,
        padding: 4,
    },
    title: {
        color: COLORS.accent,
        fontSize: 28,
        fontWeight: 'bold',
    },
    subtitle: {
        color: COLORS.muted,
        fontSize: 14,
        marginTop: 4,
    },
    markReadBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    markReadText: {
        color: COLORS.accent,
        fontSize: 13,
        fontWeight: '500',
    },
    notificationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    unread: {
        backgroundColor: COLORS.unread,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.cardBg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentContainer: {
        flex: 1,
        marginLeft: 12,
        marginRight: 12,
    },
    notificationTitle: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 20,
    },
    notificationBody: {
        color: COLORS.muted,
        fontSize: 13,
        marginTop: 2,
    },
    timeAgo: {
        color: COLORS.muted,
        fontSize: 12,
        marginTop: 4,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.accent,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 80,
        paddingHorizontal: 40,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.cardBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptySubtext: {
        color: COLORS.muted,
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    videoCallItem: {
        borderLeftWidth: 3,
        borderLeftColor: '#60a5fa',
        backgroundColor: 'rgba(96, 165, 250, 0.06)',
    },
    videoCallIconContainer: {
        backgroundColor: 'rgba(96, 165, 250, 0.15)',
    },
    joinCallBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#60a5fa',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 14,
    },
    joinCallText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
});

export default NotificationList;
