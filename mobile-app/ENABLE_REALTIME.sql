-- Important: For Realtime Messaging & Notifications to work across multiple devices, 
-- you MUST run this script in the Supabase SQL Editor.

-- This enables the "messages" and "notifications" tables to broadcast INSERT events 
-- over WebSockets so both phones receive chats and alerts instantly.

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
