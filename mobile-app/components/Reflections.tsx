import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { scheduleLocalPostNotification } from '../services/pushNotifications';
import { BlurView } from 'expo-blur';
import {
  Plus,
  X,
  Heart,
  MessageCircle,
  ArrowRight,
  Sparkles,
  Send,
  Clock,
  Feather,
  Trash2,
  Video,
  MessageSquare,
  Bell,
  Quote,
} from 'lucide-react-native';

import { VideoRoom } from './VideoRoom';
import { Inbox } from './Inbox';
import NotificationList from './social/Notifications/NotificationList';
import { ReflectionPost, ReflectionReply, UserSettings } from '../src/types';
import { getTranslation } from '../translations';
import { COLORS } from '../constants';
import { postsService, likesService, commentsService, notificationsService } from '../services/supabase';
import { realtimeSocket } from '../services/realtimeSocket';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationsContext';

const WISDOM_QUOTES = [
  'The soul knows the way, the mind just follows.',
  'In stillness, we find our deepest truths.',
  'Every reflection is a step toward awakening.',
  'The present moment is where peace resides.',
  'Your thoughts shape the world you see.',
];

const MOOD_TAGS = [
  { label: 'Peaceful', color: '#4ade80', bgColor: 'rgba(74, 222, 128, 0.15)' },
  { label: 'Reflective', color: '#60a5fa', bgColor: 'rgba(96, 165, 250, 0.15)' },
  { label: 'Grounded', color: '#a78bfa', bgColor: 'rgba(167, 139, 250, 0.15)' },
  { label: 'Hopeful', color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.15)' },
  { label: 'Grateful', color: '#f472b6', bgColor: 'rgba(244, 114, 182, 0.15)' },
  { label: 'Curious', color: '#22d3d8', bgColor: 'rgba(34, 211, 216, 0.15)' },
  { label: 'Seeking', color: '#fb923c', bgColor: 'rgba(251, 146, 60, 0.15)' },
  { label: 'Awakening', color: '#C1A18A', bgColor: 'rgba(197, 160, 89, 0.15)' },
];

interface Props {
  settings: UserSettings;
}

const getMoodStyle = (label?: string) => {
  const mood = MOOD_TAGS.find(m => m.label === label) || MOOD_TAGS[0];
  return { color: mood.color, backgroundColor: mood.bgColor };
};

export const Reflections: React.FC<Props> = ({ settings }) => {
  const { theme } = useTheme();
  const [posts, setPosts] = useState<ReflectionPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const { user } = useAuth();
  const currentUserId = user?.id;

  const [showCompose, setShowCompose] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [selectedMood, setSelectedMood] = useState(MOOD_TAGS[0]);

  const [showVideoRoom, setShowVideoRoom] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifVideoRoomName, setNotifVideoRoomName] = useState('');
  const [notifVideoCallerName, setNotifVideoCallerName] = useState('');
  const [showNotifVideoRoom, setShowNotifVideoRoom] = useState(false);

  const [activeThread, setActiveThread] = useState<ReflectionPost | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replying, setReplying] = useState(false);

  const [wisdomQuote] = useState(
    WISDOM_QUOTES[Math.floor(Math.random() * WISDOM_QUOTES.length)],
  );

  const {
    notifications,
    unreadCount,
    refresh: refreshNotifications,
    markAllAsRead,
  } = useNotifications();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const composeScaleAnim = useRef(new Animated.Value(1)).current;

  // Memoize dynamic styles based on theme
  const dynamicStyles = useMemo(() => ({
    containerBg: { backgroundColor: theme.colors.background },
    cardBg: { backgroundColor: theme.colors.surface },
    textColor: { color: theme.colors.text },
    mutedColor: { color: theme.colors.muted },
    accentColor: { color: theme.colors.accent },
    borderColor: { borderColor: theme.colors.border },
    surfaceHighlight: { backgroundColor: theme.colors.surfaceHighlight },
    accentBg: { backgroundColor: theme.colors.accent },
    overlayBg: { backgroundColor: theme.colors.overlay },
    inputPlaceholder: theme.colors.muted,
    accentTransparent: `rgba(${theme.isDark ? '212, 180, 131' : '163, 93, 71'}, 0.1)`,
    accentLight: `rgba(${theme.isDark ? '212, 180, 131' : '163, 93, 71'}, 0.3)`,
  }), [theme]);

  const loadPosts = async () => {
    try {
      const data = await postsService.getFeed(50);
      const transformed: ReflectionPost[] = data.map((post: any) => ({
        id: post.id,
        author:
          post.user?.display_name || post.user?.username || 'Anonymous Soul',
        user_id: post.user_id,
        content: post.content,
        moodTag: post.mood_tag,
        timestamp: new Date(post.created_at).getTime(),
        replies: [],
        likes: (post.likes_count as number | undefined) ?? 0,
        isLiked: post.isLiked,
        user: {
          username: post.user?.username,
          display_name: post.user?.display_name,
          avatar_url: post.user?.avatar_url,
        },
      }));

      setPosts(transformed);
    } catch (error) {
      console.error('Error loading posts', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPosts();

    Animated.parallel([
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const offPost = realtimeSocket.onReflectionPost((incomingPost) => {
      if (!incomingPost?.id) return;

      setPosts((prev) => {
        if (prev.some((p) => p.id === incomingPost.id)) {
          return prev;
        }

        const mapped: ReflectionPost = {
          id: incomingPost.id,
          author: incomingPost.author,
          user_id: incomingPost.user_id,
          content: incomingPost.content,
          moodTag: incomingPost.moodTag,
          timestamp: incomingPost.timestamp,
          replies: [],
          likes: incomingPost.likes || 0,
          isLiked: incomingPost.isLiked || false,
          user: incomingPost.user,
        };

        return [mapped, ...prev];
      });
    });

    const offComment = realtimeSocket.onReflectionComment(({ postId, reply }) => {
      if (!postId || !reply) return;

      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          if (p.replies.some((r) => r.id === reply.id)) return p;
          return { ...p, replies: [...p.replies, reply] };
        }),
      );

      setActiveThread((prev) => {
        if (!prev || prev.id !== postId) return prev;
        if (prev.replies.some((r) => r.id === reply.id)) return prev;
        return { ...prev, replies: [...prev.replies, reply] };
      });
    });

    const offLike = realtimeSocket.onReflectionLike(({ postId, liked, userId }) => {
      if (!postId || !userId) return;

      // Ignore own like event because optimistic update is already applied locally.
      if (userId === currentUserId) return;

      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;

          return {
            ...p,
            likes: Math.max(0, (p.likes || 0) + (liked ? 1 : -1)),
          };
        }),
      );

      setActiveThread((prev) => {
        if (!prev || prev.id !== postId) return prev;

        return {
          ...prev,
          likes: Math.max(0, (prev.likes || 0) + (liked ? 1 : -1)),
        };
      });
    });

    return () => {
      offPost?.();
      offComment?.();
      offLike?.();
    };
  }, [currentUserId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
  };

  const handlePost = async () => {
    if (!newContent.trim()) return;

    try {
      const data = await postsService.create(newContent, selectedMood.label);

      const newPost: ReflectionPost = {
        id: data.id,
        author: data.user?.display_name || 'Me',
        user_id: data.user_id,
        content: data.content,
        moodTag: data.mood_tag,
        timestamp: new Date(data.created_at).getTime(),
        replies: [],
        likes: 0,
        isLiked: false,
        user: {
          username: data.user?.username,
          display_name: data.user?.display_name,
        },
      };

      setPosts(prev => [newPost, ...prev]);
      realtimeSocket.emitReflectionPost(newPost);
      setNewContent('');
      setSelectedMood(MOOD_TAGS[0]);
      setShowCompose(false);
      
      try {
        await scheduleLocalPostNotification("Your fragment has been added to the collective wisdom.");
      } catch (e) {
        console.log("Failed to notify", e);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to post reflection');
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim() || !activeThread) return;
    setReplying(true);

    try {
      const data = await commentsService.create(activeThread.id, replyContent);

      const newReply: ReflectionReply = {
        id: data.id,
        author: data.user?.display_name || 'Me',
        user_id: data.user_id,
        content: data.content,
        timestamp: new Date(data.created_at).getTime(),
        user: {
          username: data.user?.username,
          display_name: data.user?.display_name,
        },
      };

      const updatedThread: ReflectionPost = {
        ...activeThread,
        replies: [...activeThread.replies, newReply],
      };

      setActiveThread(updatedThread);
      setPosts(prev => prev.map(p => (p.id === activeThread.id ? updatedThread : p)));
      realtimeSocket.emitReflectionComment({ postId: activeThread.id, reply: newReply });
      setReplyContent('');

      // Create notification for post owner on comment (not self-comment)
      if (activeThread.user_id && activeThread.user_id !== currentUserId) {
        const myName = settings.name || 'Someone';
        notificationsService.create(
          activeThread.user_id,
          'comment',
          `${myName} replied to your reflection 💬`,
          { postId: activeThread.id, commenterId: currentUserId }
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reply');
    } finally {
      setReplying(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    Alert.alert(
      'Delete Reflection',
      'Are you sure you want to delete this reflection?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await postsService.delete(postId);
              setPosts(prev => prev.filter(p => p.id !== postId));
              if (activeThread?.id === postId) setActiveThread(null);
            } catch (error: any) {
              Alert.alert('Error', 'Could not delete post');
            }
          },
        },
      ],
    );
  };

  const handleLike = async (postId: string) => {
    try {
      const liked = await likesService.toggle(postId);

      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === postId
            ? {
                ...post,
                isLiked: liked,
                likes: (post.likes || 0) + (liked ? 1 : -1),
              }
            : post,
        ),
      );

      if (activeThread?.id === postId) {
        setActiveThread(prev =>
          prev
            ? {
                ...prev,
                isLiked: liked,
                likes: (prev.likes || 0) + (liked ? 1 : -1),
              }
            : prev,
        );
      }

      if (currentUserId) {
        realtimeSocket.emitReflectionLike({
          postId,
          liked,
          userId: currentUserId,
        });
      }

      // Create notification for post owner on like (not unlike, not self-like)
      if (liked && currentUserId) {
        const likedPost = posts.find(p => p.id === postId);
        if (likedPost && likedPost.user_id && likedPost.user_id !== currentUserId) {
          const myName = settings.name || 'Someone';
          notificationsService.create(
            likedPost.user_id,
            'like',
            `${myName} liked your reflection ❤️`,
            { postId, likerId: currentUserId }
          );
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const renderItem = ({ item }: { item: ReflectionPost }) => {
    const isLiked = item.isLiked;
    const moodStyle = getMoodStyle(item.moodTag || 'Peaceful');
    const isOwnPost = item.user_id === currentUserId;

    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <TouchableOpacity
          style={[styles.card, dynamicStyles.cardBg]}
          onPress={() => setActiveThread(item)}
          activeOpacity={0.8}
        >
          <View style={[styles.cardAccent, { backgroundColor: moodStyle.color }]} />

          <View style={styles.cardHeader}>
            <View style={styles.authorContainer}>
              <View style={[styles.avatar, { borderColor: moodStyle.color }]}>
                <Text style={[styles.avatarText, { color: moodStyle.color }]}>
                  {item.author[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.authorInfo}>
                <Text style={[styles.authorName, dynamicStyles.textColor]}>{item.author}</Text>
                <View style={styles.timeRow}>
                  <Clock size={10} color={theme.colors.muted} />
                  <Text style={[styles.timeTextSmall, dynamicStyles.mutedColor]}>{formatTimeAgo(item.timestamp)}</Text>
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {item.moodTag && (
                <View
                  style={[
                    styles.moodTag,
                    { backgroundColor: moodStyle.backgroundColor },
                  ]}
                >
                  <Sparkles size={10} color={moodStyle.color} />
                  <Text style={[styles.moodText, { color: moodStyle.color }]}>
                    {item.moodTag.toUpperCase()}
                  </Text>
                </View>
              )}
              {isOwnPost && (
                <TouchableOpacity
                  onPress={() => handleDeletePost(item.id)}
                  style={{ padding: 4 }}
                >
                  <Trash2 size={14} color={theme.colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.quoteContainer}>
            <Quote
              size={18}
              color={dynamicStyles.accentLight}
              style={styles.quoteIcon}
            />
            <Text style={[styles.quoteText, dynamicStyles.textColor]}>{item.content}</Text>
          </View>

          <View style={[styles.cardFooter, dynamicStyles.borderColor]}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleLike(item.id)}
              activeOpacity={0.7}
            >
              <Heart
                size={18}
                color={isLiked ? '#f472b6' : theme.colors.muted}
                fill={isLiked ? '#f472b6' : 'transparent'}
              />
              <Text
                style={[
                  styles.actionText,
                  isLiked && { color: '#f472b6' },
                  !isLiked && dynamicStyles.mutedColor,
                ]}
              >
                {item.likes || 0}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setActiveThread(item)}
              activeOpacity={0.7}
            >
              <MessageCircle size={18} color={theme.colors.muted} />
              <Text style={[styles.actionText, dynamicStyles.mutedColor]}>
                {item.replies?.length || 0} replies
              </Text>
            </TouchableOpacity>

            <View style={styles.readMore}>
              <Text style={[styles.readMoreText, dynamicStyles.accentColor]}>Read thread</Text>
              <ArrowRight size={14} color={theme.colors.accent} />
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Thread View
  if (activeThread) {
    const moodStyle = getMoodStyle(activeThread.moodTag || 'Peaceful');
    const isOwnPost = activeThread.user_id === currentUserId;

    return (
      <KeyboardAvoidingView
        style={[styles.container, dynamicStyles.containerBg]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.threadHeader, dynamicStyles.borderColor]}>
          <TouchableOpacity
            onPress={() => setActiveThread(null)}
            style={[styles.backButton, { backgroundColor: dynamicStyles.accentTransparent }]}
            activeOpacity={0.7}
          >
            <ArrowRight
              size={24}
              color={theme.colors.accent}
              style={{ transform: [{ rotate: '180deg' }] }}
            />
          </TouchableOpacity>
          <View style={styles.threadTitleContainer}>
            <Feather size={18} color={theme.colors.accent} />
            <Text style={[styles.threadTitle, dynamicStyles.accentColor]}>Soul Thread</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.threadContent}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.mainPostCard,
              dynamicStyles.cardBg,
              { borderLeftColor: moodStyle.color },
            ]}
          >
            <View style={styles.mainPostHeader}>
              <View style={styles.authorContainer}>
                <View
                  style={[
                    styles.avatar,
                    styles.avatarLarge,
                    { borderColor: moodStyle.color },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      styles.avatarTextLarge,
                      { color: moodStyle.color },
                    ]}
                  >
                    {activeThread.author[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.authorInfo}>
                  <Text style={[styles.mainAuthorName, dynamicStyles.textColor]}>{activeThread.author}</Text>
                  <View
                    style={[
                      styles.moodTagInline,
                      { backgroundColor: moodStyle.backgroundColor },
                    ]}
                  >
                    <Sparkles size={10} color={moodStyle.color} />
                    <Text
                      style={[
                        styles.moodTextSmall,
                        { color: moodStyle.color },
                      ]}
                    >
                      {activeThread.moodTag}
                    </Text>
                  </View>
                </View>
                {isOwnPost && (
                  <TouchableOpacity
                    onPress={() => handleDeletePost(activeThread.id)}
                    style={{ marginLeft: 'auto' }}
                  >
                    <Trash2 size={18} color={theme.colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.mainQuoteContainer}>
              <Quote
                size={24}
                color={dynamicStyles.accentLight}
                style={styles.mainQuoteIcon}
              />
              <Text style={[styles.mainQuoteText, dynamicStyles.textColor]}>{activeThread.content}</Text>
            </View>

            <View style={[styles.mainPostFooter, dynamicStyles.borderColor]}>
              <View style={styles.mainPostStats}>
                <TouchableOpacity
                  style={styles.mainActionButton}
                  onPress={() => handleLike(activeThread.id)}
                >
                  <Heart
                    size={20}
                    color={activeThread.isLiked ? '#f472b6' : theme.colors.muted}
                    fill={activeThread.isLiked ? '#f472b6' : 'transparent'}
                  />
                  <Text
                    style={[
                      styles.mainActionText,
                      activeThread.isLiked && { color: '#f472b6' },
                      !activeThread.isLiked && dynamicStyles.mutedColor,
                    ]}
                  >
                    {activeThread.likes || 0} hearts
                  </Text>
                </TouchableOpacity>
                <View style={styles.mainActionButton}>
                  <MessageCircle size={20} color={theme.colors.muted} />
                  <Text style={[styles.mainActionText, dynamicStyles.mutedColor]}>
                    {activeThread.replies.length} reflections
                  </Text>
                </View>
              </View>
              <Text style={[styles.mainTimeText, dynamicStyles.mutedColor]}>
                {new Date(activeThread.timestamp).toLocaleDateString(
                  undefined,
                  {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  },
                )}
              </Text>
            </View>
          </View>

          <View style={styles.repliesSection}>
            <View style={styles.repliesHeader}>
              <View style={[styles.repliesDivider, dynamicStyles.borderColor]} />
              <Text style={[styles.repliesLabel, dynamicStyles.mutedColor]}>
                {activeThread.replies.length > 0
                  ? `${activeThread.replies.length} Reflection$${
                      activeThread.replies.length > 1 ? 's' : ''
                    }`
                  : 'No reflections yet'}
              </Text>
              <View style={[styles.repliesDivider, dynamicStyles.borderColor]} />
            </View>

            {activeThread.replies.length === 0 ? (
              <View style={[styles.emptyRepliesCard, dynamicStyles.surfaceHighlight]}>
                <Feather size={32} color={dynamicStyles.accentLight} />
                <Text style={[styles.emptyRepliesTitle, dynamicStyles.textColor]}>Be the first to share</Text>
                <Text style={[styles.emptyRepliesText, dynamicStyles.mutedColor]}>
                  Leave a thoughtful reflection on this moment of wisdom
                </Text>
              </View>
            ) : (
              activeThread.replies.map(reply => (
                <View key={reply.id} style={styles.replyCard}>
                  <View style={[styles.replyConnector, { backgroundColor: dynamicStyles.accentLight }]} />
                  <View style={[styles.replyContent, dynamicStyles.surfaceHighlight]}>
                    <View style={styles.replyHeader}>
                      <View style={[styles.replyAvatarSmall, { backgroundColor: dynamicStyles.accentTransparent }]}>
                        <Text style={[styles.replyAvatarText, dynamicStyles.accentColor]}>
                          {reply.author[0].toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.replyAuthor, dynamicStyles.textColor]}>{reply.author}</Text>
                      <Text style={[styles.replyTime, dynamicStyles.mutedColor]}>
                        {formatTimeAgo(reply.timestamp)}
                      </Text>
                    </View>
                    <Text style={[styles.replyText, dynamicStyles.textColor]}>{reply.content}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        <View style={styles.replyInputWrapper}>
          <BlurView intensity={40} tint={theme.isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <View style={styles.replyInputContainer}>
            <View style={[styles.replyInputInner, dynamicStyles.surfaceHighlight, dynamicStyles.borderColor]}>
              <TextInput
                style={[styles.replyInput, dynamicStyles.textColor]}
                placeholder="Share your reflection..."
                placeholderTextColor={dynamicStyles.inputPlaceholder}
                value={replyContent}
                onChangeText={setReplyContent}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                onPress={handleReply}
                disabled={!replyContent.trim() || replying}
                style={[
                  styles.replySendBtn,
                  dynamicStyles.accentBg,
                  (!replyContent.trim() || replying) &&
                    styles.replySendBtnDisabled,
                ]}
                activeOpacity={0.8}
              >
                <Send
                  size={18}
                  color={replyContent.trim() ? (theme.isDark ? '#000' : '#FFF') : theme.colors.muted}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Inbox View
  if (showInbox) {
    return <Inbox settings={settings} onBack={() => setShowInbox(false)} />;
  }

  // Notifications View
  if (showNotifications) {
    return (
      <>
        <VideoRoom
          visible={showNotifVideoRoom}
          roomName={notifVideoRoomName}
          onClose={() => setShowNotifVideoRoom(false)}
          friendName={notifVideoCallerName}
          userInfo={{ displayName: settings.name || 'Friend' }}
        />
        <NotificationList
          notifications={notifications}
          onNotificationPress={(notification) => {
            if (notification.type === 'video_call' && notification.data?.roomName) {
              setNotifVideoRoomName(notification.data.roomName as string);
              setNotifVideoCallerName((notification.data.callerName as string) || 'Friend');
              setShowNotifVideoRoom(true);
            }
          }}
          onRefresh={refreshNotifications}
          onMarkAllRead={markAllAsRead}
          onBack={() => setShowNotifications(false)}
        />
      </>
    );
  }

  // Main Feed View
  return (
    <View style={[styles.container, dynamicStyles.containerBg]}>
      <VideoRoom
        visible={showVideoRoom}
        roomName="dharma-community-circle-unique-99"
        onClose={() => setShowVideoRoom(false)}
        userInfo={{
          displayName: settings.name || 'Friend',
          avatar: user?.user_metadata?.avatar_url,
        }}
      />

      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerAnim,
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <View style={styles.titleContainer}>
            <Feather
              size={28}
              color={theme.colors.accent}
              style={styles.titleIcon}
            />
            <Text style={[styles.title, dynamicStyles.accentColor]}>
              {getTranslation(settings.language, 'reflections.title')}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.notificationIcon, { borderColor: theme.colors.accent }]}
            onPress={() => setShowNotifications(true)}
            activeOpacity={0.8}
          >
            <Bell size={22} color={theme.colors.accent} />
            {unreadCount > 0 && (
              <View style={[styles.notificationBadge, dynamicStyles.accentBg]}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.subtitle, dynamicStyles.mutedColor]}>
          {getTranslation(settings.language, 'reflections.subtitle')}
        </Text>

        <View style={[styles.quickActionsCard, { backgroundColor: dynamicStyles.surfaceHighlight.backgroundColor, borderColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[styles.composeBtn, styles.quickActionBtn, { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent }]}
            onPress={() => setShowInbox(true)}
            activeOpacity={0.8}
          >
            <MessageSquare size={20} color={theme.isDark ? '#000' : '#FFF'} />
            <Text
              style={[styles.composeBtnText, { color: theme.isDark ? '#000' : '#FFF' }]}
            >
              Messages
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.composeBtn, styles.quickActionBtn, { backgroundColor: '#60a5fa', borderColor: '#60a5fa' }]}
            onPress={() => setShowVideoRoom(true)}
            activeOpacity={0.8}
          >
            <Video size={20} color={theme.isDark ? '#FFF' : '#000'} />
            <Text
              style={[styles.composeBtnText, { color: theme.isDark ? '#FFF' : '#000' }]}
            >
              Join Circle
            </Text>
          </TouchableOpacity>
        </View>

        <Animated.View
          style={{ transform: [{ scale: composeScaleAnim }], marginTop: 12 }}
        >
          <TouchableOpacity
            style={[styles.composeBtn, { borderColor: theme.colors.accent }]}
            onPress={() => setShowCompose(true)}
            activeOpacity={0.8}
            onPressIn={() => {
              Animated.spring(composeScaleAnim, {
                toValue: 0.95,
                useNativeDriver: true,
              }).start();
            }}
            onPressOut={() => {
              Animated.spring(composeScaleAnim, {
                toValue: 1,
                useNativeDriver: true,
              }).start();
            }}
          >
            <View style={[styles.composeBtnGlow, { backgroundColor: dynamicStyles.accentLight }]} />
            <Plus size={20} color={theme.colors.accent} />
            <Text style={[styles.composeBtnText, dynamicStyles.accentColor]}>
              {getTranslation(settings.language, 'reflections.leaveFragment')}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
            title="Refreshing..."
            titleColor={theme.colors.accent}
          />
        }
        ListFooterComponent={() => (
          <View style={styles.footer}>
            <View style={[styles.footerDivider, { backgroundColor: dynamicStyles.accentLight }]} />
            <View style={styles.wisdomContainer}>
              <Quote
                size={16}
                color={dynamicStyles.accentLight}
              />
              <Text style={[styles.wisdomText, dynamicStyles.mutedColor]}>{wisdomQuote}</Text>
            </View>
            <Text style={[styles.footerSignature, dynamicStyles.accentColor]}>— DharmaAI</Text>
          </View>
        )}
      />

      <Modal visible={showCompose} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <BlurView intensity={95} tint={theme.isDark ? "dark" : "light"} style={[styles.modalContainer, dynamicStyles.containerBg]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Feather size={24} color={theme.colors.accent} />
                <Text style={[styles.modalTitle, dynamicStyles.accentColor]}>
                  {getTranslation(
                    settings.language,
                    'reflections.leaveFragment',
                  )}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowCompose(false);
                  setNewContent('');
                }}
                style={styles.closeButton}
              >
                <X color={theme.colors.muted} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.modalScrollView}
            >
              <View style={styles.moodSection}>
                <Text style={[styles.sectionLabel, dynamicStyles.mutedColor]}>What's your essence today?</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.moodScroll}
                >
                  {MOOD_TAGS.map(mood => (
                    <TouchableOpacity
                      key={mood.label}
                      style={[
                        styles.moodOption,
                        { backgroundColor: mood.bgColor },
                        selectedMood.label === mood.label && {
                          borderColor: mood.color,
                          borderWidth: 2,
                        },
                      ]}
                      onPress={() => setSelectedMood(mood)}
                      activeOpacity={0.7}
                    >
                      <Sparkles size={12} color={mood.color} />
                      <Text
                        style={[
                          styles.moodOptionText,
                          { color: mood.color },
                        ]}
                      >
                        {mood.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.inputSection}>
                <Text style={[styles.sectionLabel, dynamicStyles.mutedColor]}>Your reflection</Text>
                <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceHighlight }]}>
                  <Quote
                    size={20}
                    color={dynamicStyles.accentLight}
                    style={styles.inputQuoteIcon}
                  />
                  <TextInput
                    style={[styles.composeInput, dynamicStyles.textColor]}
                    multiline
                    placeholder="Share a moment of insight, a whisper of wisdom, or a fragment of your journey..."
                    placeholderTextColor={dynamicStyles.inputPlaceholder}
                    value={newContent}
                    onChangeText={setNewContent}
                    maxLength={300}
                    textAlignVertical="top"
                  />
                </View>
                <View style={styles.charCountRow}>
                  <Text style={[styles.charCount, dynamicStyles.mutedColor]}>
                    {newContent.length}/300 characters
                  </Text>
                </View>
              </View>

              <View style={styles.previewSection}>
                <Text style={[styles.sectionLabel, dynamicStyles.mutedColor]}>Posting as</Text>
                <View style={[styles.authorPreview, { backgroundColor: theme.colors.surfaceHighlight, borderColor: theme.colors.border }]}>
                  <View
                    style={[
                      styles.previewAvatar,
                      { borderColor: selectedMood.color, backgroundColor: dynamicStyles.accentTransparent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.previewAvatarText,
                        { color: selectedMood.color },
                      ]}
                    >
                      {(settings.name || 'Wandering Spirit')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.previewInfo}>
                    <Text style={[styles.previewName, dynamicStyles.textColor]}>
                      {settings.name || 'Wandering Spirit'}
                    </Text>
                    <View
                      style={[
                        styles.previewMood,
                        { backgroundColor: selectedMood.bgColor },
                      ]}
                    >
                      <Sparkles size={10} color={selectedMood.color} />
                      <Text
                        style={[
                          styles.previewMoodText,
                          { color: selectedMood.color },
                        ]}
                      >
                        {selectedMood.label}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.postButton,
                  dynamicStyles.accentBg,
                  !newContent.trim() && styles.postButtonDisabled,
                ]}
                onPress={handlePost}
                disabled={!newContent.trim()}
                activeOpacity={0.8}
              >
                <Send
                  size={18}
                  color={newContent.trim() ? (theme.isDark ? '#000' : '#FFF') : theme.colors.muted}
                />
                <Text
                  style={[
                    styles.postButtonText,
                    !newContent.trim() && styles.postButtonTextDisabled,
                    newContent.trim() && { color: theme.isDark ? '#000' : '#FFF' },
                  ]}
                >
                  Share Reflection
                </Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 20,
    alignItems: 'stretch',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  titleIcon: {
    marginRight: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'left',
    marginBottom: 16,
    lineHeight: 22,
    fontSize: 14,
  },
  notificationIcon: {
    padding: 6,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notificationBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '600',
  },
  quickActionsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
  },
  quickActionBtn: {
    flex: 1,
    justifyContent: 'center',
  },
  composeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    borderWidth: 1,
    gap: 10,
    overflow: 'hidden',
  },
  composeBtnGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  composeBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorInfo: {
    gap: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  avatarLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  avatarTextLarge: {
    fontSize: 20,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
  },
  mainAuthorName: {
    fontSize: 16,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeTextSmall: {
    fontSize: 11,
  },
  moodTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  moodTagInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  moodText: {
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  moodTextSmall: {
    fontSize: 11,
    fontWeight: '600',
  },
  quoteContainer: {
    marginBottom: 16,
  },
  quoteIcon: {
    position: 'absolute',
    top: -4,
    left: -4,
  },
  quoteText: {
    fontSize: 18,
    lineHeight: 28,
    paddingLeft: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 16,
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 13,
  },
  readMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  readMoreText: {
    fontSize: 12,
    fontWeight: '500',
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  threadTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  threadTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  threadContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  mainPostCard: {
    borderRadius: 24,
    padding: 24,
    borderLeftWidth: 4,
    marginBottom: 24,
  },
  mainPostHeader: {
    marginBottom: 20,
  },
  mainQuoteContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  mainQuoteIcon: {
    position: 'absolute',
    top: -8,
    left: -8,
  },
  mainQuoteText: {
    fontSize: 22,
    lineHeight: 34,
    paddingLeft: 24,
  },
  mainPostFooter: {
    borderTopWidth: 1,
    paddingTop: 16,
  },
  mainPostStats: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 12,
  },
  mainActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mainActionText: {
    fontSize: 14,
  },
  mainTimeText: {
    fontSize: 12,
  },
  repliesSection: {
    marginTop: 8,
  },
  repliesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  repliesDivider: {
    flex: 1,
    height: 1,
  },
  repliesLabel: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  emptyRepliesCard: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyRepliesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyRepliesText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  replyCard: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  replyConnector: {
    width: 2,
    marginRight: 16,
    borderRadius: 1,
  },
  replyContent: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  replyAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyAvatarText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  replyAuthor: {
    fontSize: 14,
    fontWeight: '600',
  },
  replyTime: {
    fontSize: 11,
    marginLeft: 'auto',
  },
  replyText: {
    fontSize: 15,
    lineHeight: 24,
  },
  replyInputWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  replyInputContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  replyInputInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
    borderWidth: 1,
  },
  replyInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
    maxHeight: 80,
  },
  replySendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replySendBtnDisabled: {
    opacity: 0.5,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  footerDivider: {
    width: 60,
    height: 2,
    marginBottom: 24,
    borderRadius: 1,
  },
  wisdomContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  wisdomText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 22,
    flex: 1,
    textAlign: 'center',
  },
  footerSignature: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
  },
  modalContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
  },
  modalScrollView: {
    flex: 1,
  },
  moodSection: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  moodScroll: {
    marginHorizontal: -4,
  },
  moodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moodOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputSection: {
    marginBottom: 32,
  },
  inputContainer: {
    borderRadius: 20,
    padding: 20,
    minHeight: 160,
    borderWidth: 1,
  },
  inputQuoteIcon: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  composeInput: {
    fontSize: 18,
    lineHeight: 28,
    paddingLeft: 28,
    minHeight: 120,
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  charCount: {
    fontSize: 12,
  },
  previewSection: {
    marginBottom: 32,
  },
  authorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  previewAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  previewAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  previewInfo: {
    gap: 6,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewMood: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  previewMoodText: {
    fontSize: 11,
    fontWeight: '600',
  },
  modalFooter: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  postButtonTextDisabled: {
    color: '#768783',
  },
});

export default Reflections;
