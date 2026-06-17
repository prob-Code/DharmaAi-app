// CreateCommunity Component - Modal for creating new communities
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
import { X, Users, Lock, Globe } from 'lucide-react-native';
import { CommunityCategory, COMMUNITY_CATEGORIES } from '../../../types/social';

interface CreateCommunityProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (data: {
        name: string;
        description: string;
        category: CommunityCategory;
        isPrivate: boolean;
    }) => Promise<void>;
}

const COLORS = {
    accent: '#C1A18A',
    text: '#E8EAF6',
    muted: '#768783',
    background: '#111625',
    cardBg: '#1a1f2e',
    border: 'rgba(255,255,255,0.1)',
};

const CATEGORIES = Object.entries(COMMUNITY_CATEGORIES) as [CommunityCategory, { label: string; emoji: string }][];

export const CreateCommunity: React.FC<CreateCommunityProps> = ({
    visible,
    onClose,
    onSubmit,
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<CommunityCategory>('support');
    const [isPrivate, setIsPrivate] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!name.trim()) {
            Alert.alert('Missing Name', 'Please enter a name for your community.');
            return;
        }

        if (!description.trim()) {
            Alert.alert('Missing Description', 'Please add a description for your community.');
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit({
                name: name.trim(),
                description: description.trim(),
                category,
                isPrivate,
            });
            // Reset form
            setName('');
            setDescription('');
            setCategory('support');
            setIsPrivate(false);
            onClose();
        } catch (error) {
            Alert.alert('Error', 'Failed to create community. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color={COLORS.muted} />
                        </TouchableOpacity>
                        <Text style={styles.title}>Create Support Group</Text>
                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={isSubmitting || !name.trim()}
                            style={[styles.submitBtn, (!name.trim()) && styles.submitBtnDisabled]}
                        >
                            <Text style={[
                                styles.submitText,
                                (!name.trim()) && styles.submitTextDisabled
                            ]}>
                                Create
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Preview */}
                        <View style={styles.preview}>
                            <View style={styles.previewIcon}>
                                <Users size={32} color={COLORS.accent} />
                            </View>
                            <Text style={styles.previewName}>
                                {name || 'Your Community Name'}
                            </Text>
                            <Text style={styles.previewEmoji}>
                                {COMMUNITY_CATEGORIES[category]?.emoji}
                            </Text>
                        </View>

                        {/* Name Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Community Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="E.g., Anxiety Warriors, Mindful Journeys"
                                placeholderTextColor={COLORS.muted}
                                value={name}
                                onChangeText={setName}
                                maxLength={50}
                            />
                            <Text style={styles.charCount}>{name.length}/50</Text>
                        </View>

                        {/* Description Input */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="What is this community about? Who is it for?"
                                placeholderTextColor={COLORS.muted}
                                value={description}
                                onChangeText={setDescription}
                                multiline
                                maxLength={200}
                            />
                            <Text style={styles.charCount}>{description.length}/200</Text>
                        </View>

                        {/* Category Selection */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Category</Text>
                            <View style={styles.categoryGrid}>
                                {CATEGORIES.map(([key, value]) => (
                                    <TouchableOpacity
                                        key={key}
                                        style={[
                                            styles.categoryOption,
                                            category === key && styles.categoryOptionActive
                                        ]}
                                        onPress={() => setCategory(key)}
                                    >
                                        <Text style={styles.categoryEmoji}>{value.emoji}</Text>
                                        <Text style={[
                                            styles.categoryLabel,
                                            category === key && styles.categoryLabelActive
                                        ]}>
                                            {value.label.split(' ')[0]}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Privacy Toggle */}
                        <View style={styles.toggleContainer}>
                            <View style={styles.toggleInfo}>
                                {isPrivate ? (
                                    <Lock size={20} color={COLORS.accent} />
                                ) : (
                                    <Globe size={20} color={COLORS.muted} />
                                )}
                                <View style={styles.toggleText}>
                                    <Text style={styles.toggleTitle}>
                                        {isPrivate ? 'Private Group' : 'Public Group'}
                                    </Text>
                                    <Text style={styles.toggleDesc}>
                                        {isPrivate
                                            ? 'Members need approval to join'
                                            : 'Anyone can find and join this group'
                                        }
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={isPrivate}
                                onValueChange={setIsPrivate}
                                trackColor={{ false: '#333', true: COLORS.accent }}
                                thumbColor="#fff"
                            />
                        </View>

                        {/* Guidelines */}
                        <View style={styles.guidelines}>
                            <Text style={styles.guidelinesTitle}>Community Guidelines</Text>
                            <Text style={styles.guidelinesText}>
                                • Be respectful and supportive to all members{'\n'}
                                • No hate speech, bullying, or harmful content{'\n'}
                                • Keep discussions relevant to the community's purpose{'\n'}
                                • Report any inappropriate behavior
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
        backgroundColor: COLORS.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '92%',
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    closeBtn: {
        padding: 4,
    },
    title: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: '600',
    },
    submitBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    submitBtnDisabled: {
        opacity: 0.5,
    },
    submitText: {
        color: COLORS.accent,
        fontSize: 16,
        fontWeight: '600',
    },
    submitTextDisabled: {
        color: COLORS.muted,
    },
    preview: {
        alignItems: 'center',
        padding: 24,
        backgroundColor: 'rgba(197, 160, 89, 0.05)',
    },
    previewIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(197, 160, 89, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    previewName: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: '600',
    },
    previewEmoji: {
        fontSize: 24,
        marginTop: 8,
    },
    inputGroup: {
        padding: 16,
    },
    label: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 10,
    },
    input: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
        padding: 14,
        color: COLORS.text,
        fontSize: 15,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    charCount: {
        color: COLORS.muted,
        fontSize: 12,
        textAlign: 'right',
        marginTop: 6,
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    categoryOption: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: COLORS.cardBg,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        minWidth: 80,
    },
    categoryOptionActive: {
        backgroundColor: 'rgba(197, 160, 89, 0.2)',
        borderColor: COLORS.accent,
    },
    categoryEmoji: {
        fontSize: 20,
        marginBottom: 4,
    },
    categoryLabel: {
        color: COLORS.muted,
        fontSize: 11,
        fontWeight: '500',
    },
    categoryLabelActive: {
        color: COLORS.accent,
    },
    toggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        margin: 16,
        marginTop: 0,
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
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
        color: COLORS.text,
        fontSize: 15,
        fontWeight: '500',
    },
    toggleDesc: {
        color: COLORS.muted,
        fontSize: 12,
        marginTop: 2,
    },
    guidelines: {
        margin: 16,
        marginTop: 0,
        padding: 16,
        backgroundColor: 'rgba(197, 160, 89, 0.05)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(197, 160, 89, 0.1)',
    },
    guidelinesTitle: {
        color: COLORS.accent,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 10,
    },
    guidelinesText: {
        color: COLORS.muted,
        fontSize: 13,
        lineHeight: 20,
    },
});

export default CreateCommunity;
