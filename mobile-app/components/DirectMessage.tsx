import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { ChevronLeft, Send, Search, Video } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase, notificationsService } from '../services/supabase';
import { realtimeSocket } from '../services/realtimeSocket';
import { COLORS } from '../constants';
import { UserSettings } from '../src/types';
import { VideoRoom } from './VideoRoom';

interface DirectMessageProps {
  receiver: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
  onBack: () => void;
  settings: UserSettings;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export const DirectMessage: React.FC<DirectMessageProps> = ({ receiver, onBack, settings }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const dynamicStyles = useMemo(() => ({
    containerBg: { backgroundColor: theme.colors.background },
    textColor: { color: theme.colors.text },
    mutedColor: { color: theme.colors.muted },
    accentColor: { color: theme.colors.accent },
    myMessageBg: { backgroundColor: theme.isDark ? 'rgba(197, 160, 89, 0.15)' : 'rgba(163, 93, 71, 0.12)' },
    theirMessageBg: { backgroundColor: theme.colors.surface },
    headerBg: { backgroundColor: theme.colors.surfaceHighlight },
    headerBorder: { borderBottomColor: theme.colors.border },
    inputBg: { backgroundColor: theme.colors.surface },
  }), [theme]);

  useEffect(() => {
    fetchMessages();

    const unsubscribe = realtimeSocket.onDM((newMsg) => {
      const isSameThread =
        (newMsg.sender_id === receiver.id && newMsg.receiver_id === user?.id) ||
        (newMsg.sender_id === user?.id && newMsg.receiver_id === receiver.id);

      if (!isSameThread) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) {
          return prev;
        }
        return [newMsg, ...prev];
      });

      if (newMsg.receiver_id === user?.id) {
        markAsRead(newMsg.id);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [receiver.id, user?.id]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${receiver.id}),and(sender_id.eq.${receiver.id},receiver_id.eq.${user?.id})`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setMessages(data || []);
      
      // Mark received unread messages as read
      const unreadIds = (data || [])
        .filter(msg => msg.receiver_id === user?.id && !msg.is_read)
        .map(msg => msg.id);
        
      if (unreadIds.length > 0) {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadIds);
      }

    } catch (error) {
      console.log('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const markAsRead = async (messageId: string) => {
      try {
          await supabase.from('messages').update({ is_read: true }).eq('id', messageId);
      } catch (e) {
          console.log('Error marking as read', e);
      }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    
    const textToSend = inputText.trim();
    setInputText('');

    // Optimistic UI update
    const tempMsg: ChatMessage = {
      id: Math.random().toString(), // temporary
      sender_id: user?.id || '',
      receiver_id: receiver.id,
      content: textToSend,
      created_at: new Date().toISOString(),
      is_read: false,
    };
    
    setMessages((prev) => [tempMsg, ...prev]);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          sender_id: user?.id,
          receiver_id: receiver.id,
          content: textToSend
        }])
        .select()
        .single();

      if (error) throw error;
      
      // Replace temp with real
      setMessages(prev => prev.map(msg => msg.id === tempMsg.id ? data : msg));

      realtimeSocket.emitDM(data as ChatMessage);
      realtimeSocket.emitNotification({
        id: `${Date.now()}`,
        userId: receiver.id,
        type: 'message',
        title: `${user?.user_metadata?.display_name || user?.email || 'Someone'} sent you a message`,
        body: textToSend,
        data: { senderId: user?.id, receiverId: receiver.id }
      });

      // Also persist notification to Supabase so it shows in bell icon
      const senderName = user?.user_metadata?.display_name || user?.email || 'Someone';
      notificationsService.create(
        receiver.id,
        'message',
        `${senderName} sent you a message 💬`,
        { senderId: user?.id, receiverId: receiver.id }
      );
      
    } catch (error) {
      console.log('Error sending message:', error);
      // Remove failed message
      setMessages(prev => prev.filter(msg => msg.id !== tempMsg.id));
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMine = item.sender_id === user?.id;

    return (
      <View style={[styles.messageBubble, isMine ? [styles.myMessage, dynamicStyles.myMessageBg] : [styles.theirMessage, dynamicStyles.theirMessageBg]]}>
        <Text style={[styles.messageText, dynamicStyles.textColor]}>{item.content}</Text>
        <Text style={[styles.messageTime, dynamicStyles.mutedColor]}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, dynamicStyles.containerBg]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >
      <View style={[styles.header, dynamicStyles.headerBg, dynamicStyles.headerBorder]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ChevronLeft color={theme.colors.accent} size={24} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, dynamicStyles.textColor]}>{receiver.display_name || receiver.username}</Text>
          <Text style={[styles.headerSubtitle, dynamicStyles.mutedColor]}>Direct Message</Text>
        </View>
        <TouchableOpacity
          style={[styles.videoCallHeaderBtn, { backgroundColor: 'rgba(96,165,250,0.15)' }]}
          onPress={() => {
            const roomName = `dharma-dm-${[user?.id || 'guest', receiver.id].sort().join('-').slice(0, 20)}`;
            const callerName = settings.name || 'Someone';

            // Send persistent notification via Supabase
            notificationsService.create(
              receiver.id,
              'video_call',
              `📹 ${callerName} is calling you!`,
              { roomName, callerName, callerId: user?.id }
            );

            // Send realtime notification for instant popup
            realtimeSocket.emitNotification({
              id: `vc-${Date.now()}`,
              userId: receiver.id,
              type: 'video_call',
              title: `📹 ${callerName} is calling you!`,
              body: 'Tap Join to connect',
              data: { roomName, callerName, callerId: user?.id },
            });

            setShowVideoCall(true);
          }}
        >
          <Video color="#60a5fa" size={20} />
        </TouchableOpacity>
      </View>

      {/* Video call modal */}
      <VideoRoom
        visible={showVideoCall}
        roomName={`dharma-dm-${[user?.id || 'guest', receiver.id].sort().join('-').slice(0, 20)}`}
        onClose={() => setShowVideoCall(false)}
        userInfo={{ displayName: settings.name || 'Friend' }}
        friendName={receiver.display_name || receiver.username}
      />

      {loading ? (
         <ActivityIndicator size="large" color={theme.colors.accent} style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          inverted
          ListEmptyComponent={
            <Text style={[styles.emptyText, dynamicStyles.mutedColor]}>Start a conversation with {receiver.display_name}.</Text>
          }
        />
      )}

      <View style={[styles.inputContainer, dynamicStyles.headerBg, dynamicStyles.headerBorder]}>
        <TextInput
          style={[styles.input, dynamicStyles.inputBg, dynamicStyles.textColor]}
          placeholder="Message..."
          placeholderTextColor={theme.colors.muted}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendButton, !inputText.trim() && { opacity: 0.5 }]} 
          onPress={sendMessage}
          disabled={!inputText.trim()}
        >
          <Send color={theme.colors.accent} size={20} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 5,
    marginRight: 10,
  },
  headerTitleContainer: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
  },
  videoCallHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  messageList: {
    paddingHorizontal: 15,
    paddingVertical: 20,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  myMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageTime: {
    fontSize: 11,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 25 : 15,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    marginLeft: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(197, 160, 89, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#768783',
    textAlign: 'center',
    marginTop: 40,
    transform: [{ scaleY: -1 }] // Due to inverted flatlist
  }
});
