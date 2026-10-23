-- Run after creating the Supabase project schema.
-- Firebase UIDs are strings, not UUIDs, so this bridge schema uses text IDs.
create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id text primary key,
  username text unique,
  display_name text,
  avatar_url text,
  bio text
);
create table if not exists public.posts (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  user_id text not null references public.profiles(id) on delete cascade,
  content text not null,
  image_url text,
  mood_tag text,
  is_anonymous boolean not null default false,
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  community_id uuid
);
create table if not exists public.comments (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  content text not null,
  is_anonymous boolean not null default false
);
create table if not exists public.likes (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  unique (post_id, user_id)
);
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  sender_id text not null references public.profiles(id) on delete cascade,
  receiver_id text not null references public.profiles(id) on delete cascade,
  content text not null,
  is_read boolean not null default false
);
create table if not exists public.communities (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  name text unique not null,
  description text,
  category text,
  is_private boolean not null default false,
  creator_id text references public.profiles(id) on delete set null,
  member_count integer not null default 1
);
create table if not exists public.community_members (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  unique (community_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.messages enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists comments_post_created_at_idx on public.comments (post_id, created_at);
create index if not exists messages_participants_idx on public.messages (sender_id, receiver_id, created_at desc);
