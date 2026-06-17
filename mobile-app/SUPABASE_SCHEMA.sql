
-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- PROFILES: Public profiles for each user
create table profiles (
  id uuid references auth.users(id) on delete cascade not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  is_anonymous boolean default false,
  website text,

  constraint username_length check (char_length(username) >= 3)
);

-- Set up Row Level Security (RLS)
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- POSTS: User content
create table posts (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references profiles(id) on delete cascade not null,
  content text,
  image_url text,
  mood_tag text,
  is_anonymous boolean default false,
  likes_count integer default 0,
  comments_count integer default 0,
  community_id uuid -- Optional link to community
);

alter table posts enable row level security;

create policy "Posts are viewable by everyone."
  on posts for select
  using ( true );

create policy "Users can insert their own posts."
  on posts for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own posts."
  on posts for update
  using ( auth.uid() = user_id );

create policy "Users can delete own posts."
  on posts for delete
  using ( auth.uid() = user_id );

-- COMMENTS
create table comments (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  is_anonymous boolean default false
);

alter table comments enable row level security;

create policy "Comments are viewable by everyone."
  on comments for select
  using ( true );

create policy "Users can insert their own comments."
  on comments for insert
  with check ( auth.uid() = user_id );

create policy "Users can delete own comments."
  on comments for delete
  using ( auth.uid() = user_id );

-- LIKES
create table likes (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  unique(post_id, user_id)
);

alter table likes enable row level security;

create policy "Likes are viewable by everyone"
  on likes for select
  using ( true );

create policy "Users can insert their own likes."
  on likes for insert
  with check ( auth.uid() = user_id );

create policy "Users can delete own likes."
  on likes for delete
  using ( auth.uid() = user_id );

-- FOLLOWS
create table follows (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  follower_id uuid references profiles(id) on delete cascade not null,
  following_id uuid references profiles(id) on delete cascade not null,
  unique(follower_id, following_id)
);

alter table follows enable row level security;

create policy "Follows are viewable by everyone"
  on follows for select using ( true );

create policy "Users can follow others"
  on follows for insert with check ( auth.uid() = follower_id );

create policy "Users can unfollow"
  on follows for delete using ( auth.uid() = follower_id );

-- MESSAGES
create table messages (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  receiver_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  is_read boolean default false
);

alter table messages enable row level security;

create policy "Users can view their own messages"
  on messages for select
  using ( auth.uid() = sender_id or auth.uid() = receiver_id );

create policy "Users can send messages"
  on messages for insert
  with check ( auth.uid() = sender_id );

-- COMMUNITIES
create table communities (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text unique not null,
  description text,
  category text,
  is_private boolean default false,
  creator_id uuid references profiles(id) on delete set null,
  member_count integer default 1
);

alter table communities enable row level security;

create policy "Communities are viewable by everyone"
  on communities for select using ( true );

create policy "Authenticated users can create communities"
  on communities for insert with check ( auth.role() = 'authenticated' );

-- COMMUNITY MEMBERS
create table community_members (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  community_id uuid references communities(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  role text default 'member', -- member, admin, moderator
  unique(community_id, user_id)
);

alter table community_members enable row level security;

create policy "Community members are viewable by everyone"
  on community_members for select using ( true );

create policy "Users can join communities"
  on community_members for insert with check ( auth.uid() = user_id );

create policy "Users can leave communities"
  on community_members for delete using ( auth.uid() = user_id );

-- NOTIFICATIONS
create table notifications (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null, -- like, comment, follow, reply
  content text,
  data jsonb, -- link to post_id, etc.
  is_read boolean default false
);

alter table notifications enable row level security;

create policy "Users can view their own notifications"
  on notifications for select using ( auth.uid() = user_id );

-- PUSH TOKENS (for mobile push notifications)
create table push_tokens (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references profiles(id) on delete cascade not null,
  token text not null,
  platform text,
  unique(user_id, token)
);

alter table push_tokens enable row level security;

create policy "Users can view own push tokens"
  on push_tokens for select
  using ( auth.uid() = user_id );

create policy "Users can insert own push tokens"
  on push_tokens for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own push tokens"
  on push_tokens for update
  using ( auth.uid() = user_id );

create policy "Users can delete own push tokens"
  on push_tokens for delete
  using ( auth.uid() = user_id );

-- FUNCTIONS AND TRIGGERS

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper functions for counters
create or replace function increment_likes(post_id uuid)
returns void as $$
begin
  update posts set likes_count = likes_count + 1 where id = post_id;
end;
$$ language plpgsql;

create or replace function decrement_likes(post_id uuid)
returns void as $$
begin
  update posts set likes_count = likes_count - 1 where id = post_id;
end;
$$ language plpgsql;

create or replace function increment_comments(post_id uuid)
returns void as $$
begin
  update posts set comments_count = comments_count + 1 where id = post_id;
end;
$$ language plpgsql;

create or replace function decrement_comments(post_id uuid)
returns void as $$
begin
  update posts set comments_count = comments_count - 1 where id = post_id;
end;
$$ language plpgsql;

-- ENABLE REALTIME FOR MESSAGES
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ENABLE REALTIME FOR NOTIFICATIONS
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- NOTIFY USERS WHEN SOMEONE POSTS (REFLECTIONS)
-- Creates a notification for all users except the author.
-- Run this in Supabase SQL Editor after creating the tables.
create or replace function public.notify_users_on_new_post()
returns trigger as $$
declare
  author_label text;
begin
  -- If the post is anonymous, don't expose identity
  if new.is_anonymous then
    author_label := 'Someone';
  else
    select coalesce(p.display_name, p.username, 'Someone')
      into author_label
    from public.profiles p
    where p.id = new.user_id;
  end if;

  insert into public.notifications (user_id, type, content, data)
  select
    p.id,
    'community_post',
    case
      when p.id = new.user_id then 'You posted a new reflection'
      else author_label || ' posted a new reflection'
    end,
    jsonb_build_object(
      'post_id', new.id,
      'author_id', new.user_id,
      'mood_tag', new.mood_tag
    )
  from public.profiles p;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_post_created_notify_users on public.posts;
create trigger on_post_created_notify_users
  after insert on public.posts
  for each row
  execute procedure public.notify_users_on_new_post();

-- MESSAGE NOTIFICATIONS: create a notification whenever a new direct message is sent
create or replace function public.create_message_notification()
returns trigger as $$
declare
  sender_profile record;
begin
  -- Fetch sender display name for a friendly notification message
  select display_name into sender_profile
  from profiles
  where id = new.sender_id;

  insert into notifications (user_id, type, content, data)
  values (
    new.receiver_id,
    'message',
    coalesce(sender_profile.display_name, 'Someone') || ' sent you a message',
    jsonb_build_object(
      'sender_id', new.sender_id,
      'receiver_id', new.receiver_id,
      'message_id', new.id
    )
  );

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_message_created_notify on messages;
create trigger on_message_created_notify
  after insert on messages
  for each row execute procedure public.create_message_notification();
