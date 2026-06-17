// ChatList Component - List of conversations
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl
} from 'react-native';
import { MessageCircle, Search } from 'lucide-react-native';
import { Avatar } from '../Common/Avatar';
import { Conversation } from '../../../types/social';
import { formatDistanceToNow } from 'date-fns';

interface ChatListProps {
    conversations: Conversation[];
    onSelectChat: (userId: string) => void;
    onRefresh: () => Promise<void>;
    isLoading?: boolean;
}

const COLORS = {
    accent: '#C1A18A',
    text: '#E8EAF6',
    muted: '#768783',
    background: '#111625',
    cardBg: '#1a1f2e',
    border: 'rgba(255,255,255,0.05)',
};

interface ChatItemProps {
    conversation: Conversation;
    onPress: () => void;
}

const ChatItem: React.FC<ChatItemProps> = ({ conversation, onPress }) => {
    const timeAgo = formatDistanceToNow(new Date(conversation.lastMessage.createdAt), {
        addSuffix: false
    });

    return (
        <TouchableOpacity style={styles.chatItem} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.avatarContainer}>
                <Avatar
                    uri={conversation.otherUser.avatarUrl}
                    name={conversation.otherUser.displayName}
                    size="medium"
                />
                {conversation.unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>
                            {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                        </Text>
                    </View>
                )}
            </View>

            <View style={styles.chatContent}>
                <View style={styles.chatHeader}>
                    <Text style={[
                        styles.chatName,
                        conversation.unreadCount > 0 && styles.chatNameUnread
                    ]}>
                        {conversation.otherUser.displayName}
                    </Text>
                    <Text style={styles.chatTime}>{timeAgo}</Text>
                </View>
                <Text
                    style={[
                        styles.lastMessage,
                        conversation.unreadCount > 0 && styles.lastMessageUnread
                    ]}
                    numberOfLines={1}
                >
                    {conversation.lastMessage.content}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

export const ChatList: React.FC<ChatListProps> = ({
    conversations,
    onSelectChat,
    onRefresh,
    isLoading = false,
}) => {
    const [refreshing, setRefreshing] = React.useState(false);

    const handleRefresh = async () => {
        setRefreshing(true);
        await onRefresh();
        setRefreshing(false);
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <Text style={styles.title}>Messages</Text>
            <TouchableOpacity style={styles.searchBtn}>
                <Search size={20} color={COLORS.muted} />
            </TouchableOpacity>
        </View>
    );

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
                <MessageCircle size={48} color={COLORS.muted} />
            </View>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtext}>
                Connect with others to start a supportive conversation
            </Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={conversations}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <ChatItem
                        conversation={item}
                        onPress={() => onSelectChat(item.otherUser.id)}
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
        alignItems: 'center',
        padding: 20,
        paddingBottom: 16,
    },
    title: {
        color: COLORS.accent,
        fontSize: 28,
        fontWeight: 'bold',
    },
    searchBtn: {
        padding: 8,
        backgroundColor: COLORS.cardBg,
        borderRadius: 20,
    },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    avatarContainer: {
        position: 'relative',
    },
    unreadBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: COLORS.accent,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    unreadText: {
        color: '#000',
        fontSize: 11,
        fontWeight: 'bold',
    },
    chatContent: {
        flex: 1,
        marginLeft: 14,
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    chatName: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: '500',
    },
    chatNameUnread: {
        fontWeight: '700',
    },
    chatTime: {
        color: COLORS.muted,
        fontSize: 12,
    },
    lastMessage: {
        color: COLORS.muted,
        fontSize: 14,
    },
    lastMessageUnread: {
        color: COLORS.text,
        fontWeight: '500',
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
});

export default ChatList;
