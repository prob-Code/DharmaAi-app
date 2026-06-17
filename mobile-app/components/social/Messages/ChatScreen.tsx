// ChatScreen Component - One-to-one messaging
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView
} from 'react-native';
import { ArrowLeft, Send, MoreVertical, Shield } from 'lucide-react-native';
import { Avatar } from '../Common/Avatar';
import { Message, User } from '../../../types/social';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';

interface ChatScreenProps {
    messages: Message[];
    otherUser: User;
    currentUserId: string;
    onSend: (content: string) => Promise<void>;
    onBack: () => void;
    onUserPress: () => void;
    onLoadMore?: () => void;
}

const COLORS = {
    accent: '#C1A18A',
    text: '#E8EAF6',
    muted: '#768783',
    background: '#111625',
    cardBg: '#1a1f2e',
    border: 'rgba(255,255,255,0.1)',
    myBubble: '#C1A18A',
    theirBubble: '#1a1f2e',
};

interface MessageBubbleProps {
    message: Message;
    isOwn: boolean;
    showTimestamp?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn, showTimestamp }) => {
    const formatTime = (date: string) => {
        const d = new Date(date);
        if (isToday(d)) {
            return format(d, 'h:mm a');
        } else if (isYesterday(d)) {
            return `Yesterday ${format(d, 'h:mm a')}`;
        }
        return format(d, 'MMM d, h:mm a');
    };

    return (
        <View style={[styles.bubbleContainer, isOwn && styles.bubbleContainerOwn]}>
            <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>
                    {message.content}
                </Text>
            </View>
            {showTimestamp && (
                <Text style={[styles.timestamp, isOwn && styles.timestampOwn]}>
                    {formatTime(message.createdAt)}
                    {isOwn && message.isRead && ' • Read'}
                </Text>
            )}
        </View>
    );
};

export const ChatScreen: React.FC<ChatScreenProps> = ({
    messages,
    otherUser,
    currentUserId,
    onSend,
    onBack,
    onUserPress,
    onLoadMore,
}) => {
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    const handleSend = async () => {
        if (!newMessage.trim()) return;

        const messageText = newMessage.trim();
        setNewMessage('');
        setIsSending(true);

        try {
            await onSend(messageText);
        } catch (error) {
            console.error('Failed to send message:', error);
            setNewMessage(messageText); // Restore on failure
        } finally {
            setIsSending(false);
        }
    };

    const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
        const isOwn = item.senderId === currentUserId;
        const nextMessage = messages[index - 1]; // FlatList is inverted
        const showTimestamp = !nextMessage ||
            new Date(item.createdAt).getTime() - new Date(nextMessage.createdAt).getTime() > 300000; // 5 min gap

        return (
            <MessageBubble
                message={item}
                isOwn={isOwn}
                showTimestamp={showTimestamp}
            />
        );
    }, [currentUserId, messages]);

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Avatar
                uri={otherUser.avatarUrl}
                name={otherUser.displayName}
                size="large"
            />
            <Text style={styles.emptyTitle}>{otherUser.displayName}</Text>
            <Text style={styles.emptySubtext}>
                Start a supportive conversation
            </Text>
            <View style={styles.safetyNote}>
                <Shield size={14} color={COLORS.accent} />
                <Text style={styles.safetyText}>
                    Be kind and supportive. This is a safe space.
                </Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <ArrowLeft size={24} color={COLORS.text} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.userInfo} onPress={onUserPress}>
                    <Avatar
                        uri={otherUser.avatarUrl}
                        name={otherUser.displayName}
                        size="small"
                    />
                    <View style={styles.userText}>
                        <Text style={styles.userName}>{otherUser.displayName}</Text>
                        <Text style={styles.userStatus}>
                            {otherUser.moodStatus ? `Feeling ${otherUser.moodStatus}` : 'Active'}
                        </Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.moreBtn}>
                    <MoreVertical size={20} color={COLORS.muted} />
                </TouchableOpacity>
            </View>

            {/* Messages */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.chatContainer}
                keyboardVerticalOffset={90}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMessage}
                    ListEmptyComponent={renderEmpty}
                    inverted
                    onEndReached={onLoadMore}
                    onEndReachedThreshold={0.5}
                    contentContainerStyle={styles.messagesList}
                    showsVerticalScrollIndicator={false}
                />

                {/* Input */}
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        placeholderTextColor={COLORS.muted}
                        value={newMessage}
                        onChangeText={setNewMessage}
                        multiline
                        maxLength={1000}
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, newMessage.trim() && styles.sendBtnActive]}
                        onPress={handleSend}
                        disabled={!newMessage.trim() || isSending}
                    >
                        <Send size={22} color={newMessage.trim() ? '#000' : COLORS.muted} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backBtn: {
        padding: 4,
        marginRight: 12,
    },
    userInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    userText: {
        marginLeft: 12,
    },
    userName: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: '600',
    },
    userStatus: {
        color: COLORS.muted,
        fontSize: 12,
        marginTop: 2,
    },
    moreBtn: {
        padding: 8,
    },
    chatContainer: {
        flex: 1,
    },
    messagesList: {
        padding: 16,
        flexGrow: 1,
    },
    bubbleContainer: {
        marginBottom: 8,
        maxWidth: '80%',
        alignSelf: 'flex-start',
    },
    bubbleContainerOwn: {
        alignSelf: 'flex-end',
    },
    bubble: {
        padding: 12,
        borderRadius: 18,
    },
    bubbleOwn: {
        backgroundColor: COLORS.myBubble,
        borderBottomRightRadius: 4,
    },
    bubbleOther: {
        backgroundColor: COLORS.theirBubble,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    bubbleText: {
        color: COLORS.text,
        fontSize: 15,
        lineHeight: 20,
    },
    bubbleTextOwn: {
        color: '#000',
    },
    timestamp: {
        color: COLORS.muted,
        fontSize: 11,
        marginTop: 4,
        marginLeft: 4,
    },
    timestampOwn: {
        textAlign: 'right',
        marginRight: 4,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: '600',
        marginTop: 16,
    },
    emptySubtext: {
        color: COLORS.muted,
        fontSize: 14,
        marginTop: 8,
    },
    safetyNote: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(197, 160, 89, 0.1)',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginTop: 20,
    },
    safetyText: {
        color: COLORS.muted,
        fontSize: 12,
        marginLeft: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        backgroundColor: COLORS.cardBg,
    },
    input: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: COLORS.text,
        fontSize: 15,
        maxHeight: 100,
        marginRight: 12,
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnActive: {
        backgroundColor: COLORS.accent,
    },
});

export default ChatScreen;
