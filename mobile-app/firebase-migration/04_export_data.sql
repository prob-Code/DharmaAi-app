-- ============================================================
--  STEP 4 — Saara app data export karo (Firestore ke liye)
--  Kahan: Supabase Dashboard → SQL Editor
--  Har query alag chalao aur "Download JSON" se save karo
--  firebase-migration/data/<naam>.json me
-- ============================================================

-- ---- profiles.json ----
select id, username, display_name, avatar_url, bio, is_anonymous, website, updated_at
from public.profiles;

-- ---- posts.json ----
-- select id, user_id, content, mood_tag, is_anonymous, image_url, community_id,
--        likes_count, comments_count, created_at
-- from public.posts;

-- ---- comments.json ----
-- select id, post_id, user_id, content, is_anonymous, created_at
-- from public.comments;

-- ---- likes.json ----
-- select id, post_id, user_id, created_at
-- from public.likes;

-- ---- follows.json ----
-- select id, follower_id, following_id, created_at
-- from public.follows;

-- ---- messages.json ----
-- select id, sender_id, receiver_id, content, is_read, created_at
-- from public.messages;

-- ---- communities.json ----
-- select id, name, description, category, is_private, creator_id, member_count, created_at
-- from public.communities;

-- ---- community_members.json ----
-- select id, community_id, user_id, role, created_at
-- from public.community_members;

-- ---- notifications.json ----
-- select id, user_id, type, content, data, is_read, created_at
-- from public.notifications;

-- ---- push_tokens.json ----
-- select id, user_id, token, platform, created_at
-- from public.push_tokens;


-- ------------------------------------------------------------
--  Row counts — migrate karne ke baad milaan ke liye note kar lo
-- ------------------------------------------------------------
-- select 'profiles' t, count(*) from public.profiles
-- union all select 'posts',            count(*) from public.posts
-- union all select 'comments',         count(*) from public.comments
-- union all select 'likes',            count(*) from public.likes
-- union all select 'follows',          count(*) from public.follows
-- union all select 'messages',         count(*) from public.messages
-- union all select 'communities',      count(*) from public.communities
-- union all select 'community_members',count(*) from public.community_members
-- union all select 'notifications',    count(*) from public.notifications
-- union all select 'push_tokens',      count(*) from public.push_tokens;
