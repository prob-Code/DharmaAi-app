import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Heart, MoreHorizontal } from 'lucide-react-native';
import { Avatar } from '../Common/Avatar';
import { Comment, ANONYMOUS_USER } from '../../../types/social';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from '../../../context/ThemeContext';

interface CommentItemProps {
    comment: Comment;
    onUserPress?: (userId: string) => void;
    onLike?: (commentId: string) => void;
    onReply?: (commentId: string) => void;
}

export const CommentItem: React.FC<CommentItemProps> = ({
    comment,
    onUserPress,
    onLike,
    onReply,
}) => {
    const { theme } = useTheme();
    const displayUser = comment.isAnonymous ? ANONYMOUS_USER : comment.user;
    const displayName = comment.isAnonymous ? 'Anonymous Soul' : (comment.user?.displayName || 'User');
    const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });

    return (
        <View style={styles.container}>
            <TouchableOpacity
                onPress={() => !comment.isAnonymous && onUserPress?.(comment.userId)}
                disabled={comment.isAnonymous}
            >
                <Avatar
                    uri={displayUser?.avatarUrl}
                    name={displayName}
                    size="small"
                    isAnonymous={comment.isAnonymous}
                />
            </TouchableOpacity>

            <View style={styles.content}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => !comment.isAnonymous && onUserPress?.(comment.userId)}
                        disabled={comment.isAnonymous}
                    >
                        <Text style={[styles.userName, { color: theme.colors.text }]}>{displayName}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.timeAgo, { color: theme.colors.muted }]}>{timeAgo}</Text>
                </View>

                <Text style={[styles.commentText, { color: theme.colors.text }]}>{comment.content}</Text>

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => onLike?.(comment.id)}
                    >
                        <Heart size={14} color={theme.colors.muted} />
                        <Text style={[styles.actionText, { color: theme.colors.muted }]}>Like</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => onReply?.(comment.id)}
                    >
                        <Text style={[styles.actionText, { color: theme.colors.muted }]}>Reply</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.03)',
    },
    content: {
        flex: 1,
        marginLeft: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    userName: {
        fontSize: 14,
        fontWeight: '600',
    },
    timeAgo: {
        fontSize: 12,
        marginLeft: 8,
    },
    commentText: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 8,
    },
    actions: {
        flexDirection: 'row',
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    actionText: {
        fontSize: 12,
        marginLeft: 4,
    },
});

export default CommentItem;
