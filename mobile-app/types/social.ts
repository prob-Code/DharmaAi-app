// Social Network Types for DharmaAI Wellness Community

export interface User {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    bio?: string;
    isAnonymous: boolean;
    moodStatus?: MoodStatus;
    followersCount: number;
    followingCount: number;
    postsCount: number;
    createdAt: string;
}

export type MoodStatus =
    | 'hopeful'
    | 'peaceful'
    | 'struggling'
    | 'grateful'
    | 'anxious'
    | 'healing'
    | 'growing'
    | 'neutral';

export interface Post {
    id: string;
    userId: string;
    user?: User;
    content: string;
    moodTag?: MoodStatus;
    isAnonymous: boolean;
    imageUrl?: string;
    likesCount: number;
    commentsCount: number;
    isLiked?: boolean;
    hasTriggerWarning?: boolean;
    triggerWarningLabel?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Comment {
    id: string;
    postId: string;
    userId: string;
    user?: User;
    content: string;
    isAnonymous: boolean;
    createdAt: string;
}

export interface Like {
    id: string;
    postId: string;
    userId: string;
    createdAt: string;
}

// Support reactions beyond simple likes
export type SupportReaction =
    | 'sending_love'
    | 'not_alone'
    | 'virtual_hug'
    | 'proud'
    | 'here_for_you';

export interface Message {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    isRead: boolean;
    createdAt: string;
    sender?: User;
    receiver?: User;
}

export interface Conversation {
    id: string;
    otherUser: User;
    lastMessage: Message;
    unreadCount: number;
}

export interface Community {
    id: string;
    name: string;
    description?: string;
    avatarUrl?: string;
    creatorId: string;
    memberCount: number;
    isPrivate: boolean;
    category: CommunityCategory;
    isJoined?: boolean;
    createdAt: string;
}

export type CommunityCategory =
    | 'anxiety'
    | 'depression'
    | 'mindfulness'
    | 'grief'
    | 'relationships'
    | 'self_care'
    | 'gratitude'
    | 'recovery'
    | 'support'
    | 'general';

export interface CommunityMember {
    id: string;
    communityId: string;
    userId: string;
    user?: User;
    role: 'admin' | 'moderator' | 'member';
    joinedAt: string;
}

export interface Notification {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
    isRead: boolean;
    createdAt: string;
}

export type NotificationType =
    | 'like'
    | 'comment'
    | 'follow'
    | 'message'
    | 'community_invite'
    | 'community_post'
    | 'mention'
    | 'support_reaction'
    | 'video_call';

// Feed types
export interface FeedOptions {
    type: 'following' | 'explore' | 'community';
    communityId?: string;
    limit?: number;
    cursor?: string;
}

// Anonymous identity for private posts
export const ANONYMOUS_USER: Partial<User> = {
    displayName: 'Anonymous Soul',
    avatarUrl: undefined,
    username: 'anonymous',
};

// Mood tag colors for UI
export const MOOD_COLORS: Record<MoodStatus, string> = {
    hopeful: '#4CAF50',
    peaceful: '#2196F3',
    struggling: '#9E9E9E',
    grateful: '#FF9800',
    anxious: '#9C27B0',
    healing: '#00BCD4',
    growing: '#8BC34A',
    neutral: '#607D8B',
};

// Support reaction labels
export const SUPPORT_REACTIONS: Record<SupportReaction, { label: string; emoji: string }> = {
    sending_love: { label: 'Sending Love', emoji: '💕' },
    not_alone: { label: "You're Not Alone", emoji: '🤝' },
    virtual_hug: { label: 'Virtual Hug', emoji: '🤗' },
    proud: { label: 'Proud of You', emoji: '⭐' },
    here_for_you: { label: 'Here for You', emoji: '💪' },
};

// Community category labels
export const COMMUNITY_CATEGORIES: Record<CommunityCategory, { label: string; emoji: string }> = {
    anxiety: { label: 'Anxiety Support', emoji: '🌊' },
    depression: { label: 'Depression Support', emoji: '🌧️' },
    mindfulness: { label: 'Mindfulness', emoji: '🧘' },
    grief: { label: 'Grief & Loss', emoji: '💙' },
    relationships: { label: 'Relationships', emoji: '💑' },
    self_care: { label: 'Self Care', emoji: '🛁' },
    gratitude: { label: 'Gratitude', emoji: '🙏' },
    recovery: { label: 'Recovery', emoji: '🌱' },
    support: { label: 'General Support', emoji: '🤝' },
    general: { label: 'General', emoji: '💬' },
};
