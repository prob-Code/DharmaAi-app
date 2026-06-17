// UserProfile Component - Display user profile with posts
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    FlatList,
    Dimensions
} from 'react-native';
import { ArrowLeft, Settings, MessageCircle, Edit3, Grid, Heart, Bookmark } from 'lucide-react-native';
import { Avatar } from '../Common/Avatar';
import { MoodTag } from '../Common/MoodTag';
import { PostCard } from '../Feed/PostCard';
import { User, Post, MoodStatus } from '../../../types/social';

interface UserProfileProps {
    user: User;
    posts: Post[];
    isOwnProfile: boolean;
    isFollowing: boolean;
    onBack: () => void;
    onFollow: () => void;
    onMessage: () => void;
    onEditProfile: () => void;
    onSettings: () => void;
    onPostPress: (postId: string) => void;
    onLike: (postId: string) => void;
}

const COLORS = {
    accent: '#C1A18A',
    text: '#E8EAF6',
    muted: '#768783',
    background: '#111625',
    cardBg: '#1a1f2e',
    border: 'rgba(255,255,255,0.05)',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const UserProfile: React.FC<UserProfileProps> = ({
    user,
    posts,
    isOwnProfile,
    isFollowing,
    onBack,
    onFollow,
    onMessage,
    onEditProfile,
    onSettings,
    onPostPress,
    onLike,
}) => {
    const [activeTab, setActiveTab] = useState<'posts' | 'likes' | 'saved'>('posts');

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            {/* Nav Bar */}
            <View style={styles.navBar}>
                <TouchableOpacity onPress={onBack} style={styles.navBtn}>
                    <ArrowLeft size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.username}>@{user.username}</Text>
                {isOwnProfile && (
                    <TouchableOpacity onPress={onSettings} style={styles.navBtn}>
                        <Settings size={22} color={COLORS.text} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Profile Info */}
            <View style={styles.profileInfo}>
                <Avatar
                    uri={user.avatarUrl}
                    name={user.displayName}
                    size="large"
                />

                <View style={styles.stats}>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{user.postsCount}</Text>
                        <Text style={styles.statLabel}>Posts</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{user.followersCount}</Text>
                        <Text style={styles.statLabel}>Followers</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{user.followingCount}</Text>
                        <Text style={styles.statLabel}>Following</Text>
                    </View>
                </View>
            </View>

            {/* Name & Bio */}
            <View style={styles.bioSection}>
                <Text style={styles.displayName}>{user.displayName}</Text>

                {user.moodStatus && (
                    <View style={styles.moodRow}>
                        <MoodTag mood={user.moodStatus} size="small" />
                    </View>
                )}

                {user.bio && (
                    <Text style={styles.bio}>{user.bio}</Text>
                )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
                {isOwnProfile ? (
                    <TouchableOpacity style={styles.editBtn} onPress={onEditProfile}>
                        <Edit3 size={18} color={COLORS.accent} />
                        <Text style={styles.editBtnText}>Edit Profile</Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        <TouchableOpacity
                            style={[styles.followBtn, isFollowing && styles.followingBtn]}
                            onPress={onFollow}
                        >
                            <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                                {isFollowing ? 'Following' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.messageBtn} onPress={onMessage}>
                            <MessageCircle size={20} color={COLORS.text} />
                        </TouchableOpacity>
                    </>
                )}
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
                    onPress={() => setActiveTab('posts')}
                >
                    <Grid size={20} color={activeTab === 'posts' ? COLORS.accent : COLORS.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'likes' && styles.tabActive]}
                    onPress={() => setActiveTab('likes')}
                >
                    <Heart size={20} color={activeTab === 'likes' ? COLORS.accent : COLORS.muted} />
                </TouchableOpacity>
                {isOwnProfile && (
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'saved' && styles.tabActive]}
                        onPress={() => setActiveTab('saved')}
                    >
                        <Bookmark size={20} color={activeTab === 'saved' ? COLORS.accent : COLORS.muted} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>
                {activeTab === 'posts' ? '✍️' : activeTab === 'likes' ? '💛' : '📚'}
            </Text>
            <Text style={styles.emptyTitle}>
                {activeTab === 'posts'
                    ? 'No posts yet'
                    : activeTab === 'likes'
                        ? 'No liked posts'
                        : 'No saved posts'
                }
            </Text>
            {isOwnProfile && activeTab === 'posts' && (
                <Text style={styles.emptySubtext}>
                    Share your thoughts with the community
                </Text>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={posts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={styles.postContainer}>
                        <PostCard
                            post={item}
                            onLike={onLike}
                            onComment={() => onPostPress(item.id)}
                            onShare={() => { }}
                            onUserPress={() => { }}
                            onPostPress={onPostPress}
                        />
                    </View>
                )}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmpty}
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
    headerContainer: {
        backgroundColor: COLORS.background,
    },
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    navBtn: {
        padding: 4,
    },
    username: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: '600',
    },
    profileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    stats: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginLeft: 20,
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: 'bold',
    },
    statLabel: {
        color: COLORS.muted,
        fontSize: 12,
        marginTop: 2,
    },
    bioSection: {
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    displayName: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    moodRow: {
        marginBottom: 8,
    },
    bio: {
        color: COLORS.text,
        fontSize: 14,
        lineHeight: 20,
    },
    actionButtons: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    editBtn: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(197, 160, 89, 0.15)',
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    editBtnText: {
        color: COLORS.accent,
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
    followBtn: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.accent,
        paddingVertical: 10,
        borderRadius: 8,
    },
    followingBtn: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.muted,
    },
    followBtnText: {
        color: '#000',
        fontSize: 14,
        fontWeight: '600',
    },
    followingBtnText: {
        color: COLORS.text,
    },
    messageBtn: {
        marginLeft: 10,
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.cardBg,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    tabs: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: COLORS.border,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: COLORS.accent,
    },
    postContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
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
        fontSize: 18,
        fontWeight: '600',
    },
    emptySubtext: {
        color: COLORS.muted,
        fontSize: 14,
        marginTop: 8,
    },
});

export default UserProfile;
