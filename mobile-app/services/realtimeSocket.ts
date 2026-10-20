import { io, Socket } from 'socket.io-client';
import { Config } from '../config';

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
  isLiked?: boolean;
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

class RealtimeSocketService {
  private socket: Socket | null = null;
  private currentUserId: string | null = null;
  private isConnected = false;

  private dmHandlers: ((payload: DMRealtimeMessage) => void)[] = [];
  private notifHandlers: ((payload: RealtimeNotification) => void)[] = [];
  private postHandlers: ((payload: ReflectionPostRealtimePayload) => void)[] = [];
  private commentHandlers: ((payload: ReflectionReplyRealtimePayload) => void)[] = [];
  private likeHandlers: ((payload: ReflectionLikeRealtimePayload) => void)[] = [];

  connect(userId: string) {
    if (this.socket && this.currentUserId === userId) {
      return this.socket;
    }

    this.disconnect();
    this.currentUserId = userId;

    if (!Config.BACKEND_URL) {
      console.warn('[Realtime] EXPO_PUBLIC_BACKEND_URL is not configured');
      return null;
    }

    this.socket = io(Config.BACKEND_URL, { transports: ['websocket'] });
    this.socket.on('connect', () => {
      this.socket?.emit('user:join', userId);
      this.isConnected = true;
    });
    this.socket.on('disconnect', () => { this.isConnected = false; });
    this.socket.on('dm:new', (payload: DMRealtimeMessage) => this.dmHandlers.forEach(h => h(payload)));
    this.socket.on('notification:new', (payload: RealtimeNotification) => this.notifHandlers.forEach(h => h(payload)));
    this.socket.on('reflection:post:new', (payload: ReflectionPostRealtimePayload) => this.postHandlers.forEach(h => h(payload)));
    this.socket.on('reflection:comment:new', (payload: ReflectionReplyRealtimePayload) => this.commentHandlers.forEach(h => h(payload)));
    this.socket.on('reflection:like:updated', (payload: ReflectionLikeRealtimePayload) => this.likeHandlers.forEach(h => h(payload)));

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.currentUserId = null;
  }

  onDM(handler: (payload: DMRealtimeMessage) => void) {
    this.dmHandlers.push(handler);
    return () => {
      this.dmHandlers = this.dmHandlers.filter(h => h !== handler);
    };
  }

  onNotification(handler: (payload: RealtimeNotification) => void) {
    this.notifHandlers.push(handler);
    return () => {
      this.notifHandlers = this.notifHandlers.filter(h => h !== handler);
    };
  }

  emitDM(payload: DMRealtimeMessage) {
    this.socket?.emit('dm:send', payload);
  }

  emitNotification(payload: RealtimeNotification) {
    this.socket?.emit('notification:send', payload);
  }

  onReflectionPost(handler: (payload: ReflectionPostRealtimePayload) => void) {
    this.postHandlers.push(handler);
    return () => {
      this.postHandlers = this.postHandlers.filter(h => h !== handler);
    };
  }

  onReflectionComment(handler: (payload: ReflectionReplyRealtimePayload) => void) {
    this.commentHandlers.push(handler);
    return () => {
      this.commentHandlers = this.commentHandlers.filter(h => h !== handler);
    };
  }

  onReflectionLike(handler: (payload: ReflectionLikeRealtimePayload) => void) {
    this.likeHandlers.push(handler);
    return () => {
      this.likeHandlers = this.likeHandlers.filter(h => h !== handler);
    };
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
export const realtimeConfig = { DEFAULT_BACKEND_URL: Config.BACKEND_URL };
