// CommunityCard Component - Display a single community
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Users, Lock } from 'lucide-react-native';
import { Community, COMMUNITY_CATEGORIES } from '../../../types/social';

interface CommunityCardProps {
    community: Community;
    onPress: () => void;
    onJoin: () => void;
}

const COLORS = {
    accent: '#C1A18A',
    text: '#E8EAF6',
    muted: '#768783',
    background: '#111625',
    cardBg: '#1a1f2e',
    border: 'rgba(255,255,255,0.05)',
    success: '#4CAF50',
};

export const CommunityCard: React.FC<CommunityCardProps> = ({
    community,
    onPress,
    onJoin,
}) => {
    const categoryInfo = COMMUNITY_CATEGORIES[community.category];

    return (
        <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
            {/* Cover/Avatar */}
            <View style={styles.coverContainer}>
                {community.avatarUrl ? (
                    <Image source={{ uri: community.avatarUrl }} style={styles.cover} />
                ) : (
                    <View style={[styles.cover, styles.coverPlaceholder]}>
                        <Text style={styles.coverEmoji}>{categoryInfo?.emoji || '🌿'}</Text>
                    </View>
                )}
                {community.isPrivate && (
                    <View style={styles.privateBadge}>
                        <Lock size={12} color="#fff" />
                    </View>
                )}
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Text style={styles.name} numberOfLines={1}>{community.name}</Text>

                <View style={styles.categoryTag}>
                    <Text style={styles.categoryText}>
                        {categoryInfo?.emoji} {categoryInfo?.label}
                    </Text>
                </View>

                {community.description && (
                    <Text style={styles.description} numberOfLines={2}>
                        {community.description}
                    </Text>
                )}

                <View style={styles.footer}>
                    <View style={styles.memberCount}>
                        <Users size={14} color={COLORS.muted} />
                        <Text style={styles.memberText}>
                            {community.memberCount.toLocaleString()} members
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.joinBtn, community.isJoined && styles.joinedBtn]}
                        onPress={(e) => {
                            e.stopPropagation();
                            onJoin();
                        }}
                    >
                        <Text style={[styles.joinText, community.isJoined && styles.joinedText]}>
                            {community.isJoined ? 'Joined' : 'Join'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    coverContainer: {
        position: 'relative',
    },
    cover: {
        width: '100%',
        height: 100,
    },
    coverPlaceholder: {
        backgroundColor: 'rgba(197, 160, 89, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    coverEmoji: {
        fontSize: 36,
    },
    privateBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 6,
        borderRadius: 20,
    },
    content: {
        padding: 16,
    },
    name: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    categoryTag: {
        backgroundColor: 'rgba(197, 160, 89, 0.1)',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginBottom: 10,
    },
    categoryText: {
        color: COLORS.accent,
        fontSize: 12,
        fontWeight: '500',
    },
    description: {
        color: COLORS.muted,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    memberCount: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    memberText: {
        color: COLORS.muted,
        fontSize: 13,
        marginLeft: 6,
    },
    joinBtn: {
        backgroundColor: COLORS.accent,
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
    },
    joinedBtn: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.success,
    },
    joinText: {
        color: '#000',
        fontSize: 14,
        fontWeight: '600',
    },
    joinedText: {
        color: COLORS.success,
    },
});

export default CommunityCard;
