// CreatePost Component - For creating new posts with mood tags
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Modal,
    ScrollView,
    Switch,
    Alert,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { X, Send, AlertTriangle, Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '../../../context/ThemeContext';
import { Avatar } from '../Common/Avatar';
import { MoodTag } from '../Common/MoodTag';
import { MoodStatus, User } from '../../../types/social';

interface CreatePostProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (content: string, moodTag?: MoodStatus, isAnonymous?: boolean) => Promise<void>;
    currentUser?: User;
}

// REMOVED: const COLORS = { ... };

const MOODS: MoodStatus[] = [
    'hopeful', 'peaceful', 'grateful', 'healing', 'growing', 'struggling', 'anxious', 'neutral'
];

export const CreatePost: React.FC<CreatePostProps> = ({
    visible,
    onClose,
    onSubmit,
    currentUser,
}) => {
    const { theme } = useTheme();
    const [content, setContent] = useState('');
    const [selectedMood, setSelectedMood] = useState<MoodStatus | undefined>();
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!content.trim()) {
            Alert.alert('Empty Post', 'Please write something to share.');
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit(content.trim(), selectedMood, isAnonymous);
            setContent('');
            setSelectedMood(undefined);
            setIsAnonymous(false);
            onClose();
        } catch (error) {
            Alert.alert('Error', 'Failed to create post. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const charCount = content.length;
    const maxChars = 500;
    const isOverLimit = charCount > maxChars;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: theme.colors.surfaceHighlight }]}>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color={theme.colors.muted} />
                        </TouchableOpacity>
                        <Text style={[styles.title, { color: theme.colors.text }]}>Share Your Thoughts</Text>
                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={isSubmitting || !content.trim() || isOverLimit}
                            style={[
                                styles.submitBtn,
                                { backgroundColor: theme.colors.accent + '15' },
                                (!content.trim() || isOverLimit) && styles.submitBtnDisabled
                            ]}
                        >
                            <Send size={20} color={content.trim() && !isOverLimit ? theme.colors.accent : theme.colors.muted} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* User Preview */}
                        <View style={styles.userPreview}>
                            <Avatar
                                uri={isAnonymous ? undefined : currentUser?.avatarUrl}
                                name={isAnonymous ? 'Anonymous' : currentUser?.displayName}
                                size="medium"
                                isAnonymous={isAnonymous}
                            />
                            <View style={styles.userInfo}>
                                <Text style={[styles.userName, { color: theme.colors.text }]}>
                                    {isAnonymous ? 'Anonymous Soul' : currentUser?.displayName || 'You'}
                                </Text>
                                <Text style={[styles.postingAs, { color: theme.colors.muted }]}>
                                    {isAnonymous ? 'Posting anonymously' : 'Sharing with the community'}
                                </Text>
                            </View>
                        </View>

                        {/* Text Input */}
                        <TextInput
                            style={[styles.textInput, { color: theme.colors.text }]}
                            placeholder="What's on your mind? Share your journey, thoughts, or feelings..."
                            placeholderTextColor={theme.colors.muted}
                            multiline
                            value={content}
                            onChangeText={setContent}
                            maxLength={maxChars + 50}
                        />

                        {/* Character Count */}
                        <Text style={[styles.charCount, { color: theme.colors.muted }, isOverLimit && styles.charCountOver]}>
                            {charCount}/{maxChars}
                        </Text>

                        {/* Mood Selection */}
                        <View style={[styles.section, { borderTopColor: theme.colors.surfaceHighlight }]}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>How are you feeling?</Text>
                            <View style={styles.moodGrid}>
                                {MOODS.map(mood => (
                                    <MoodTag
                                        key={mood}
                                        mood={mood}
                                        selected={selectedMood === mood}
                                        onPress={() => setSelectedMood(
                                            selectedMood === mood ? undefined : mood
                                        )}
                                    />
                                ))}
                            </View>
                        </View>

                        {/* Anonymous Toggle */}
                        <View style={[styles.toggleContainer, { borderTopColor: theme.colors.surfaceHighlight }]}>
                            <View style={styles.toggleInfo}>
                                {isAnonymous ? (
                                    <EyeOff size={20} color={theme.colors.accent} />
                                ) : (
                                    <Eye size={20} color={theme.colors.muted} />
                                )}
                                <View style={styles.toggleText}>
                                    <Text style={[styles.toggleTitle, { color: theme.colors.text }]}>Post Anonymously</Text>
                                    <Text style={[styles.toggleDesc, { color: theme.colors.muted }]}>
                                        Your identity will be hidden from others
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={isAnonymous}
                                onValueChange={setIsAnonymous}
                                trackColor={{ false: theme.colors.surfaceHighlight, true: theme.colors.accent }}
                                thumbColor="#fff"
                            />
                        </View>

                        {/* Encouragement */}
                        <View style={[styles.encouragement, { backgroundColor: theme.colors.accent + '10' }]}>
                            <AlertTriangle size={16} color={theme.colors.accent} />
                            <Text style={[styles.encouragementText, { color: theme.colors.muted }]}>
                                This is a safe space. Be kind to yourself and others. 💛
                            </Text>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    container: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
    },
    closeBtn: {
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
    },
    submitBtn: {
        padding: 8,
        borderRadius: 20,
    },
    submitBtnDisabled: {
        opacity: 0.5,
    },
    userPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    userInfo: {
        marginLeft: 12,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
    },
    postingAs: {
        fontSize: 12,
        marginTop: 2,
    },
    textInput: {
        fontSize: 16,
        lineHeight: 24,
        padding: 16,
        minHeight: 120,
        textAlignVertical: 'top',
    },
    charCount: {
        fontSize: 12,
        textAlign: 'right',
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    charCountOver: {
        color: '#FF6B6B',
    },
    section: {
        padding: 16,
        borderTopWidth: 1,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
    },
    moodGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    toggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderTopWidth: 1,
    },
    toggleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    toggleText: {
        marginLeft: 12,
    },
    toggleTitle: {
        fontSize: 14,
        fontWeight: '500',
    },
    toggleDesc: {
        fontSize: 12,
        marginTop: 2,
    },
    encouragement: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginHorizontal: 16,
        borderRadius: 12,
        marginTop: 8,
    },
    encouragementText: {
        fontSize: 12,
        marginLeft: 8,
        flex: 1,
    },
});

export default CreatePost;
