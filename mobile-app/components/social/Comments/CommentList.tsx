// CommentList Component - List of comments with input
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Switch
} from 'react-native';
import { Send, EyeOff } from 'lucide-react-native';
import { CommentItem } from './CommentItem';
import { Avatar } from '../Common/Avatar';
import { Comment, User } from '../../../types/social';
import { useTheme } from '../../../context/ThemeContext';

interface CommentListProps {
    comments: Comment[];
    currentUser?: User;
    onSubmit: (content: string, isAnonymous: boolean) => Promise<void>;
    onUserPress?: (userId: string) => void;
    onLoadMore?: () => void;
    isLoading?: boolean;
}


export const CommentList: React.FC<CommentListProps> = ({
    comments,
    currentUser,
    onSubmit,
    onUserPress,
    onLoadMore,
    isLoading = false,
}) => {
    const { theme } = useTheme();
    const [newComment, setNewComment] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!newComment.trim()) return;

        setIsSubmitting(true);
        try {
            await onSubmit(newComment.trim(), isAnonymous);
            setNewComment('');
        } catch (error) {
            console.error('Failed to submit comment:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={[styles.emptyText, { color: theme.colors.text }]}>No comments yet</Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.muted }]}>Be the first to offer support!</Text>
        </View>
    );

    const renderHeader = () => (
        <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
            </Text>
        </View>
    );

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, { backgroundColor: theme.colors.background }]}
        >
            <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <CommentItem
                        comment={item}
                        onUserPress={onUserPress}
                    />
                )}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmpty}
                onEndReached={onLoadMore}
                onEndReachedThreshold={0.5}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            {/* Comment Input */}
            <View style={[
                styles.inputContainer,
                {
                    backgroundColor: theme.colors.surface,
                    borderTopColor: theme.colors.border
                }
            ]}>
                <View style={styles.inputRow}>
                    <Avatar
                        uri={isAnonymous ? undefined : currentUser?.avatarUrl}
                        name={isAnonymous ? 'Anonymous' : currentUser?.displayName}
                        size="small"
                        isAnonymous={isAnonymous}
                    />
                    <TextInput
                        style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.surfaceHighlight }]}
                        placeholder="Add a supportive comment..."
                        placeholderTextColor={theme.colors.muted}
                        value={newComment}
                        onChangeText={setNewComment}
                        multiline
                        maxLength={300}
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, !newComment.trim() && styles.sendBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={!newComment.trim() || isSubmitting}
                    >
                        <Send size={20} color={newComment.trim() ? theme.colors.accent : theme.colors.muted} />
                    </TouchableOpacity>
                </View>

                {/* Anonymous Toggle */}
                <TouchableOpacity
                    style={styles.anonymousToggle}
                    onPress={() => setIsAnonymous(!isAnonymous)}
                >
                    <EyeOff size={14} color={isAnonymous ? theme.colors.accent : theme.colors.muted} />
                    <Text style={[styles.anonymousText, { color: isAnonymous ? theme.colors.accent : theme.colors.muted }]}>
                        {isAnonymous ? 'Commenting anonymously' : 'Comment anonymously'}
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    listContent: {
        padding: 16,
        paddingBottom: 120,
    },
    header: {
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyEmoji: {
        fontSize: 32,
        marginBottom: 12,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '500',
    },
    emptySubtext: {
        fontSize: 14,
        marginTop: 4,
    },
    inputContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        borderTopWidth: 1,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    input: {
        flex: 1,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginHorizontal: 12,
        fontSize: 14,
        maxHeight: 80,
    },
    sendBtn: {
        padding: 8,
    },
    sendBtnDisabled: {
        opacity: 0.5,
    },
    anonymousToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        marginLeft: 44,
    },
    anonymousText: {
        fontSize: 12,
        marginLeft: 6,
    },
});

export default CommentList;
