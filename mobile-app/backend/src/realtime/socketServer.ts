import { Server as HttpServer } from "http";
import { Server } from "socket.io";

interface DMEventPayload {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface NotificationPayload {
  id: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  isRead?: boolean;
  createdAt?: string;
}

interface ReflectionPostPayload {
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

interface ReflectionReplyPayload {
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

interface ReflectionLikePayload {
  postId: string;
  liked: boolean;
  userId: string;
}

function userRoom(userId: string) {
  return `user:${userId}`;
}

export function createSocketServer(httpServer: HttpServer, corsOrigin: string) {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin === "*" ? true : corsOrigin.split(",").map((v) => v.trim()),
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    socket.on("user:join", (userId: string) => {
      if (!userId) return;
      socket.join(userRoom(userId));
    });

    socket.on("dm:send", (payload: DMEventPayload) => {
      if (!payload?.sender_id || !payload?.receiver_id) return;

      io.to(userRoom(payload.receiver_id)).emit("dm:new", payload);
      io.to(userRoom(payload.sender_id)).emit("dm:new", payload);
    });

    socket.on("notification:send", (payload: NotificationPayload) => {
      if (!payload?.userId) return;
      io.to(userRoom(payload.userId)).emit("notification:new", payload);
    });

    socket.on("reflection:post:create", (payload: ReflectionPostPayload) => {
      if (!payload?.id || !payload?.user_id) return;
      io.emit("reflection:post:new", payload);
    });

    socket.on("reflection:comment:create", (payload: ReflectionReplyPayload) => {
      if (!payload?.postId || !payload?.reply?.id) return;
      io.emit("reflection:comment:new", payload);
    });

    socket.on("reflection:like:update", (payload: ReflectionLikePayload) => {
      if (!payload?.postId || !payload?.userId) return;
      io.emit("reflection:like:updated", payload);
    });
  });

  return io;
}
