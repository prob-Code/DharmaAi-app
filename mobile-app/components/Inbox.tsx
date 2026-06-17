import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Search, ChevronLeft, Send, MessageSquare, Video } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase, notificationsService } from '../services/supabase';
import { realtimeSocket } from '../services/realtimeSocket';
import { COLORS } from '../constants';
import { UserSettings } from '../src/types';
import { DirectMessage } from './DirectMessage';
import { VideoRoom } from './VideoRoom';

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
}

interface InboxProps {
  settings: UserSettings;
  onBack?: () => void;
}

export const Inbox: React.FC<InboxProps> = ({ settings, onBack }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [videoCallUser, setVideoCallUser] = useState<Profile | null>(null);

  const dynamicStyles = useMemo(() => ({
    containerBg: { backgroundColor: theme.colors.background },
    headerBg: { backgroundColor: theme.colors.surfaceHighlight },
    headerBorder: { borderBottomColor: theme.colors.border },
    textColor: { color: theme.colors.text },
    mutedColor: { color: theme.colors.muted },
    accentColor: { color: theme.colors.accent },
    searchContainerBg: { backgroundColor: theme.colors.surface },
    cardBg: { backgroundColor: theme.colors.surface },
    avatarBg: { backgroundColor: theme.isDark ? 'rgba(197, 160, 89, 0.2)' : 'rgba(163, 93, 71, 0.15)' },
  }), [theme]);

  useEffect(() => {
    // Load recent conversations or all users initially
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Just fetch all users for now except self
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user?.id)
        .limit(20);

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.log('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length === 0) {
      fetchUsers();
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user?.id)
        .ilike('display_name', `%${text}%`)
        .limit(20);

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.log('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  if (selectedUser) {
    return <DirectMessage 
              receiver={selectedUser} 
              onBack={() => setSelectedUser(null)} 
              settings={settings} 
           />;
  }

  // Generate a unique room name for 1-on-1 video calls
  const getVideoRoomName = (otherUserId: string) => {
    const ids = [user?.id || 'guest', otherUserId].sort();
    return `dharma-dm-${ids[0].slice(0, 8)}-${ids[1].slice(0, 8)}`;
  };

  // Start a video call and notify the friend
  const startVideoCall = (friend: Profile) => {
    const roomName = getVideoRoomName(friend.id);
    const callerName = settings.name || 'Someone';

    // Send persistent notification via Supabase
    notificationsService.create(
      friend.id,
      'video_call',
      `📹 ${callerName} is calling you!`,
      { roomName, callerName, callerId: user?.id }
    );

    // Send realtime notification for instant popup
    realtimeSocket.emitNotification({
      id: `vc-${Date.now()}`,
      userId: friend.id,
      type: 'video_call',
      title: `📹 ${callerName} is calling you!`,
      body: 'Tap Join to connect',
      data: { roomName, callerName, callerId: user?.id },
    });

    // Open the video room for the caller
    setVideoCallUser(friend);
  };

  return (
    <View style={[styles.container, dynamicStyles.containerBg]}>
      {/* Video call modal */}
      {videoCallUser && (
        <VideoRoom
          visible={!!videoCallUser}
          roomName={getVideoRoomName(videoCallUser.id)}
          onClose={() => setVideoCallUser(null)}
          userInfo={{ displayName: settings.name || 'Friend' }}
          friendName={videoCallUser.display_name || videoCallUser.username}
        />
      )}

      <View style={[styles.header, dynamicStyles.headerBg, dynamicStyles.headerBorder]}>
        <View style={styles.headerTitleContainer}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <ChevronLeft color={theme.colors.accent} size={28} />
            </TouchableOpacity>
          )}
          <Text style={[styles.headerTitle, dynamicStyles.textColor]}>Messages</Text>
        </View>
      </View>

      <View style={[styles.searchContainer, dynamicStyles.searchContainerBg]}>
        <Search color={theme.colors.muted} size={20} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, dynamicStyles.textColor]}
          placeholder="Search friends..."
          placeholderTextColor={theme.colors.muted}
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.accent} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.userCard, dynamicStyles.cardBg]}
              onPress={() => setSelectedUser(item)}
            >
              <View style={[styles.avatarPlaceholder, dynamicStyles.avatarBg]}>
                <Text style={[styles.avatarText, dynamicStyles.accentColor]}>
                  {item.display_name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={[styles.userName, dynamicStyles.textColor]}>{item.display_name || item.username || 'Anonymous'}</Text>
                <Text style={[styles.userSub, dynamicStyles.mutedColor]}>Tap to message</Text>
              </View>
              <View style={styles.userActions}>
                <TouchableOpacity
                  style={[styles.videoCallBtn, { backgroundColor: 'rgba(96,165,250,0.15)' }]}
                  onPress={() => startVideoCall(item)}
                >
                  <Video color="#60a5fa" size={18} />
                </TouchableOpacity>
                <MessageSquare color={theme.colors.accent} size={20} />
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.emptyText, dynamicStyles.mutedColor]}>No users found.</Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    borderRadius: 12,
    paddingHorizontal: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
    marginLeft: 15,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userSub: {
    fontSize: 13,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  videoCallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
