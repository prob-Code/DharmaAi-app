import { Platform } from 'react-native';

// Conditionally import socket.io-client - only resolve for RN/native platforms
let io: any = null;
let Socket: any = null;

if (Platform.OS !== 'web') {
  try {
    const socketio = require('socket.io-client');
    io = socketio.io;
    Socket = socketio.Socket;
  } catch (e) {
    console.warn('[Realtime] socket.io-client not available:', e);
  }
}

export interface DMRealtimeMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export interface RealtimeNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  isRead?: boolean;
  createdAt?: string;
}

export interface ReflectionPostRealtimePayload {
  id: string;
  author: string;
  user_id: string;
  content: string;
  moodTag?: string;
  timestamp: number;
  likes: number;
  isLiked: boolean;
  user?: {
    username?: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface ReflectionReplyRealtimePayload {
  postId: string;
  reply: {
    id: string;
    author: string;
    user_id: string;
    content: string;
    timestamp: number;
    user?: {
      username?: string;
      display_name?: string;
      avatar_url?: string;
    };
  };
}

export interface ReflectionLikeRealtimePayload {
  postId: string;
  liked: boolean;
  userId: string;
}

const DEFAULT_BACKEND_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

class RealtimeSocketService {
  private socket: any = null;
  private currentUserId: string | null = null;

  connect(userId: string, backendUrl: string = DEFAULT_BACKEND_URL) {
    if (!io) {
      console.warn('[Realtime] socket.io-client not available, skipping WebSocket connection');
      return null;
    }

    if (this.socket?.connected && this.currentUserId === userId) {
      return this.socket;
    }

    this.disconnect();

    this.socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,       // Don't retry forever on unreachable hosts
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 8000,
    });

    this.currentUserId = userId;
    let hasLoggedError = false;

    this.socket.on('connect', () => {
      this.socket?.emit('user:join', userId);
      console.log('[Realtime] Connected and joined user room:', userId);
      hasLoggedError = false;
    });

    this.socket.on('disconnect', () => {
      console.log('[Realtime] Disconnected');
    });

    this.socket.on('connect_error', (err: any) => {
      // Only log the first error to avoid flooding the JS thread
      if (!hasLoggedError) {
        console.warn('[Realtime] Socket.io connection error (will retry silently):', err.message);
        hasLoggedError = true;
      }
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentUserId = null;
  }

  onDM(handler: (payload: DMRealtimeMessage) => void) {
    this.socket?.on('dm:new', handler);
    return () => this.socket?.off('dm:new', handler);
  }

  onNotification(handler: (payload: RealtimeNotification) => void) {
    this.socket?.on('notification:new', handler);
    return () => this.socket?.off('notification:new', handler);
  }

  emitDM(payload: DMRealtimeMessage) {
    this.socket?.emit('dm:send', payload);
  }

  emitNotification(payload: RealtimeNotification) {
    this.socket?.emit('notification:send', payload);
  }

  onReflectionPost(handler: (payload: ReflectionPostRealtimePayload) => void) {
    this.socket?.on('reflection:post:new', handler);
    return () => this.socket?.off('reflection:post:new', handler);
  }

  onReflectionComment(handler: (payload: ReflectionReplyRealtimePayload) => void) {
    this.socket?.on('reflection:comment:new', handler);
    return () => this.socket?.off('reflection:comment:new', handler);
  }

  onReflectionLike(handler: (payload: ReflectionLikeRealtimePayload) => void) {
    this.socket?.on('reflection:like:updated', handler);
    return () => this.socket?.off('reflection:like:updated', handler);
  }

  emitReflectionPost(payload: ReflectionPostRealtimePayload) {
    this.socket?.emit('reflection:post:create', payload);
  }

  emitReflectionComment(payload: ReflectionReplyRealtimePayload) {
    this.socket?.emit('reflection:comment:create', payload);
  }

  emitReflectionLike(payload: ReflectionLikeRealtimePayload) {
    this.socket?.emit('reflection:like:update', payload);
  }
}

export const realtimeSocket = new RealtimeSocketService();
export const realtimeConfig = { DEFAULT_BACKEND_URL };
