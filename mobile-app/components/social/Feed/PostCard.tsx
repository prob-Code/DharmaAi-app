// PostCard Component - Displays a single post in the feed
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Heart, MessageCircle, Share2, MoreHorizontal, Flag } from 'lucide-react-native';
import { Avatar } from '../Common/Avatar';
import { MoodTag } from '../Common/MoodTag';
import { Post, ANONYMOUS_USER } from '../../../types/social';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from '../../../context/ThemeContext';

interface PostCardProps {
    post: Post;
    onLike: (postId: string) => void;
    onComment: (postId: string) => void;
    onShare: (postId: string) => void;
    onUserPress: (userId: string) => void;
    onPostPress: (postId: string) => void;
}


export const PostCard: React.FC<PostCardProps> = ({
    post,
    onLike,
    onComment,
    onShare,
    onUserPress,
    onPostPress,
}) => {
    const { theme } = useTheme();
    const [isLiked, setIsLiked] = useState(post.isLiked || false);
    const [likesCount, setLikesCount] = useState(post.likesCount);

    const displayUser = post.isAnonymous ? ANONYMOUS_USER : post.user;
    const displayName = post.isAnonymous ? 'Anonymous Soul' : (post.user?.displayName || 'User');
    const username = post.isAnonymous ? '' : `@${post.user?.username}`;

    const handleLike = () => {
        setIsLiked(!isLiked);
        setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
        onLike(post.id);
    };

    const handleMoreOptions = () => {
        Alert.alert(
            'Post Options',
            '',
            [
                { text: 'Report Post', onPress: () => console.log('Report'), style: 'destructive' },
                { text: 'Block User', onPress: () => console.log('Block'), style: 'destructive' },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });

    return (
        <TouchableOpacity
            style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => onPostPress(post.id)}
            activeOpacity={0.9}
        >
            {/* Post Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.userInfo}
                    onPress={() => !post.isAnonymous && onUserPress(post.userId)}
                    disabled={post.isAnonymous}
                >
                    <Avatar
                        uri={displayUser?.avatarUrl}
                        name={displayName}
                        size="medium"
                        isAnonymous={post.isAnonymous}
                    />
                    <View style={styles.userText}>
                        <Text style={[styles.displayName, { color: theme.colors.text }]}>{displayName}</Text>
                        {username && <Text style={[styles.username, { color: theme.colors.muted }]}>{username}</Text>}
                    </View>
                </TouchableOpacity>

                <View style={styles.headerRight}>
                    <Text style={[styles.timeAgo, { color: theme.colors.muted }]}>{timeAgo}</Text>
                    <TouchableOpacity onPress={handleMoreOptions} style={styles.moreBtn}>
                        <MoreHorizontal size={18} color={theme.colors.muted} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Mood Tag */}
            {post.moodTag && (
                <View style={styles.moodContainer}>
                    <MoodTag mood={post.moodTag} size="small" />
                </View>
            )}

            {/* Trigger Warning */}
            {post.hasTriggerWarning && (
                <View style={[styles.triggerWarning, { backgroundColor: theme.colors.surfaceHighlight }]}>
                    <Flag size={14} color={theme.colors.danger} />
                    <Text style={[styles.triggerText, { color: theme.colors.danger }]}>
                        TW: {post.triggerWarningLabel || 'Sensitive content'}
                    </Text>
                </View>
            )}

            {/* Post Content */}
            <Text style={[styles.content, { color: theme.colors.text }]}>{post.content}</Text>

            {/* Post Actions */}
            <View style={[styles.actions, { borderTopColor: theme.colors.border }]}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
                    <Heart
                        size={20}
                        color={isLiked ? theme.colors.danger : theme.colors.muted}
                        fill={isLiked ? theme.colors.danger : 'transparent'}
                    />
                    <Text style={[styles.actionText, { color: isLiked ? theme.colors.danger : theme.colors.muted }]}>
                        {likesCount > 0 ? likesCount : ''}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => onComment(post.id)}>
                    <MessageCircle size={20} color={theme.colors.muted} />
                    <Text style={[styles.actionText, { color: theme.colors.muted }]}>
                        {post.commentsCount > 0 ? post.commentsCount : ''}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => onShare(post.id)}>
                    <Share2 size={20} color={theme.colors.muted} />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    userText: {
        marginLeft: 12,
    },
    displayName: {
        fontSize: 15,
        fontWeight: '600',
    },
    username: {
        fontSize: 13,
        marginTop: 2,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeAgo: {
        fontSize: 12,
        marginRight: 8,
    },
    moreBtn: {
        padding: 4,
    },
    moodContainer: {
        marginBottom: 10,
    },
    triggerWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        marginBottom: 10,
    },
    triggerText: {
        fontSize: 12,
        marginLeft: 6,
        fontWeight: '500',
    },
    content: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 16,
    },
    actions: {
        flexDirection: 'row',
        borderTopWidth: 1,
        paddingTop: 12,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 24,
    },
    actionText: {
        fontSize: 14,
        marginLeft: 6,
    },
});

export default PostCard;
