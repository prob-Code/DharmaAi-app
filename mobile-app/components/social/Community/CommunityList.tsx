// CommunityList Component - Browse and discover communities
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ScrollView,
    RefreshControl
} from 'react-native';
import { Plus, Sparkles } from 'lucide-react-native';
import { CommunityCard } from './CommunityCard';
import { Community, CommunityCategory, COMMUNITY_CATEGORIES } from '../../../types/social';

interface CommunityListProps {
    communities: Community[];
    onSelectCommunity: (communityId: string) => void;
    onJoinCommunity: (communityId: string) => void;
    onCreateCommunity: () => void;
    onRefresh: () => Promise<void>;
    selectedCategory?: CommunityCategory;
    onCategoryChange: (category?: CommunityCategory) => void;
}

const COLORS = {
    accent: '#C1A18A',
    text: '#E8EAF6',
    muted: '#768783',
    background: '#111625',
    cardBg: '#1a1f2e',
    border: 'rgba(255,255,255,0.05)',
};

const CATEGORIES = Object.entries(COMMUNITY_CATEGORIES) as [CommunityCategory, { label: string; emoji: string }][];

export const CommunityList: React.FC<CommunityListProps> = ({
    communities,
    onSelectCommunity,
    onJoinCommunity,
    onCreateCommunity,
    onRefresh,
    selectedCategory,
    onCategoryChange,
}) => {
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = async () => {
        setRefreshing(true);
        await onRefresh();
        setRefreshing(false);
    };

    const renderHeader = () => (
        <View style={styles.header}>
            {/* Title */}
            <View style={styles.titleRow}>
                <View>
                    <Text style={styles.title}>Support Groups</Text>
                    <Text style={styles.subtitle}>Find your community</Text>
                </View>
                <TouchableOpacity style={styles.createBtn} onPress={onCreateCommunity}>
                    <Plus size={20} color={COLORS.accent} />
                </TouchableOpacity>
            </View>

            {/* Featured Section */}
            <View style={styles.featured}>
                <Sparkles size={18} color={COLORS.accent} />
                <Text style={styles.featuredText}>
                    Join a group that resonates with your journey
                </Text>
            </View>

            {/* Category Filters */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
                contentContainerStyle={styles.categoryContainer}
            >
                <TouchableOpacity
                    style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
                    onPress={() => onCategoryChange(undefined)}
                >
                    <Text style={[
                        styles.categoryChipText,
                        !selectedCategory && styles.categoryChipTextActive
                    ]}>
                        All
                    </Text>
                </TouchableOpacity>

                {CATEGORIES.map(([key, value]) => (
                    <TouchableOpacity
                        key={key}
                        style={[
                            styles.categoryChip,
                            selectedCategory === key && styles.categoryChipActive
                        ]}
                        onPress={() => onCategoryChange(key)}
                    >
                        <Text style={[
                            styles.categoryChipText,
                            selectedCategory === key && styles.categoryChipTextActive
                        ]}>
                            {value.emoji} {value.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>No communities found</Text>
            <Text style={styles.emptySubtext}>
                {selectedCategory
                    ? 'Try a different category or create a new one'
                    : 'Be the first to create a supportive community'
                }
            </Text>
            <TouchableOpacity style={styles.createFirstBtn} onPress={onCreateCommunity}>
                <Plus size={18} color="#000" />
                <Text style={styles.createFirstText}>Create Community</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={communities}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <CommunityCard
                        community={item}
                        onPress={() => onSelectCommunity(item.id)}
                        onJoin={() => onJoinCommunity(item.id)}
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
        padding: 16,
        paddingBottom: 100,
    },
    header: {
        marginBottom: 20,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
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
    createBtn: {
        backgroundColor: 'rgba(197, 160, 89, 0.15)',
        padding: 12,
        borderRadius: 24,
    },
    featured: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(197, 160, 89, 0.1)',
        padding: 14,
        borderRadius: 12,
        marginBottom: 16,
    },
    featuredText: {
        color: COLORS.text,
        fontSize: 14,
        marginLeft: 10,
        flex: 1,
    },
    categoryScroll: {
        marginHorizontal: -16,
    },
    categoryContainer: {
        paddingHorizontal: 16,
        gap: 8,
    },
    categoryChip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: COLORS.cardBg,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginRight: 8,
    },
    categoryChipActive: {
        backgroundColor: 'rgba(197, 160, 89, 0.2)',
        borderColor: COLORS.accent,
    },
    categoryChipText: {
        color: COLORS.muted,
        fontSize: 13,
        fontWeight: '500',
    },
    categoryChipTextActive: {
        color: COLORS.accent,
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
        color: COLORS.text,
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptySubtext: {
        color: COLORS.muted,
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    createFirstBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.accent,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
    },
    createFirstText: {
        color: '#000',
        fontSize: 15,
        fontWeight: '600',
        marginLeft: 8,
    },
});

export default CommunityList;
