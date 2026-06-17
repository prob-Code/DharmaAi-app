// PostFeed Component - Main feed showing posts
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity
} from 'react-native';
import { Plus, Compass, Users } from 'lucide-react-native';
import { useTheme } from '../../../context/ThemeContext';
import { MotiView } from 'moti';
import { PostCard } from './PostCard';
import { CreatePost } from './CreatePost';
import { FlashList } from '@shopify/flash-list';
import { Post, User, MoodStatus } from '../../../types/social';

interface PostFeedProps {
    posts: Post[];
    currentUser?: User;
    onLoadMore: () => void;
    onRefresh: () => Promise<void>;
    onLike: (postId: string) => void;
    onComment: (postId: string) => void;
    onShare: (postId: string) => void;
    onUserPress: (userId: string) => void;
    onPostPress: (postId: string) => void;
    onCreatePost: (content: string, moodTag?: MoodStatus, isAnonymous?: boolean) => Promise<void>;
    isLoading?: boolean;
    feedType?: 'following' | 'explore';
    onFeedTypeChange?: (type: 'following' | 'explore') => void;
}

export const PostFeed: React.FC<PostFeedProps> = ({
    posts,
    currentUser,
    onLoadMore,
    onRefresh,
    onLike,
    onComment,
    onShare,
    onUserPress,
    onPostPress,
    onCreatePost,
    isLoading = false,
    feedType = 'explore',
    onFeedTypeChange,
}) => {
    const { theme } = useTheme();
    const [refreshing, setRefreshing] = useState(false);
    const [showCreatePost, setShowCreatePost] = useState(false);

    const handleRefresh = async () => {
        setRefreshing(true);
        await onRefresh();
        setRefreshing(false);
    };

    const renderHeader = () => (
        <View style={styles.header}>
            {/* Feed Type Tabs */}
            <View style={[styles.tabs, { backgroundColor: theme.colors.surfaceHighlight }]}>
                <TouchableOpacity
                    style={[styles.tab, feedType === 'following' && { backgroundColor: theme.colors.accent + '20' }]}
                    onPress={() => onFeedTypeChange?.('following')}
                >
                    <Users size={18} color={feedType === 'following' ? theme.colors.accent : theme.colors.muted} />
                    <Text style={[styles.tabText, { color: theme.colors.muted }, feedType === 'following' && { color: theme.colors.accent }]}>
                        Following
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, feedType === 'explore' && { backgroundColor: theme.colors.accent + '20' }]}
                    onPress={() => onFeedTypeChange?.('explore')}
                >
                    <Compass size={18} color={feedType === 'explore' ? theme.colors.accent : theme.colors.muted} />
                    <Text style={[styles.tabText, { color: theme.colors.muted }, feedType === 'explore' && { color: theme.colors.accent }]}>
                        Explore
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Daily Affirmation */}
            <View style={[styles.affirmation, { backgroundColor: theme.colors.accent + '15', borderColor: theme.colors.accent + '30' }]}>
                <Text style={styles.affirmationEmoji}>🌟</Text>
                <Text style={[styles.affirmationText, { color: theme.colors.text }]}>
                    "You are worthy of love and belonging. Your presence matters."
                </Text>
            </View>
        </View>
    );

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                {feedType === 'following'
                    ? 'Follow others to see their posts'
                    : 'No posts yet'
                }
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.muted }]}>
                {feedType === 'following'
                    ? 'Explore and connect with others on their journey'
                    : 'Be the first to share your thoughts'
                }
            </Text>
            {feedType === 'following' && (
                <TouchableOpacity
                    style={[styles.exploreBtn, { backgroundColor: theme.colors.accent }]}
                    onPress={() => onFeedTypeChange?.('explore')}
                >
                    <Text style={[styles.exploreBtnText, { color: theme.isDark ? '#000' : '#fff' }]}>Explore Community</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    const renderFooter = () => {
        if (!isLoading) return null;
        return (
            <View style={styles.footer}>
                <ActivityIndicator size="small" color={theme.colors.accent} />
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <FlashList
                data={posts}
                keyExtractor={(item) => item.id}
                // @ts-ignore - TS types for flash-list are being weird
                estimatedItemSize={300}
                renderItem={({ item, index }) => (
                    <MotiView
                      from={{ opacity: 0, translateY: 15 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ type: 'timing', duration: 400, delay: index * 100 }}
                    >
                        <PostCard
                            post={item}
                            onLike={onLike}
                            onComment={onComment}
                            onShare={onShare}
                            onUserPress={onUserPress}
                            onPostPress={onPostPress}
                        />
                    </MotiView>
                )}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmpty}
                ListFooterComponent={renderFooter}
                onEndReached={onLoadMore}
                onEndReachedThreshold={0.5}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            {/* Floating Create Button */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: theme.colors.accent, shadowColor: theme.colors.accent }]}
                onPress={() => setShowCreatePost(true)}
            >
                <Plus size={28} color={theme.isDark ? '#000' : '#fff'} />
            </TouchableOpacity>

            {/* Create Post Modal */}
            <CreatePost
                visible={showCreatePost}
                onClose={() => setShowCreatePost(false)}
                onSubmit={onCreatePost}
                currentUser={currentUser}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    header: {
        marginBottom: 16,
    },
    tabs: {
        flexDirection: 'row',
        borderRadius: 16,
        padding: 4,
        marginBottom: 16,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 8,
    },
    affirmation: {
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
    },
    affirmationEmoji: {
        fontSize: 24,
        marginRight: 12,
    },
    affirmationText: {
        fontSize: 14,
        fontStyle: 'italic',
        flex: 1,
        lineHeight: 20,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
    },
    exploreBtn: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
    },
    exploreBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
    footer: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
});

export default PostFeed;
