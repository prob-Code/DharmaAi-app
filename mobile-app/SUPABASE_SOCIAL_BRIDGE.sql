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

-- Migration for databases created from an older version of this bridge.
-- Firebase UIDs are not UUIDs. Convert user identity columns without changing
-- post, comment, like, community, or message record IDs.
-- The existing Supabase policies are removed first because PostgreSQL does not
-- allow changing a column type while an RLS policy depends on that column.
-- The backend uses the service-role key, which bypasses these client policies.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'posts', 'comments', 'likes', 'messages',
        'communities', 'community_members'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conrelid::regclass as table_name, conname
    from pg_constraint
    where contype = 'f'
      and (
        conrelid = 'public.profiles'::regclass
        or (
          conrelid in (
            'public.posts'::regclass,
            'public.comments'::regclass,
            'public.likes'::regclass,
            'public.messages'::regclass,
            'public.communities'::regclass,
            'public.community_members'::regclass
          )
          and confrelid = 'public.profiles'::regclass
        )
      )
  loop
    execute format(
      'alter table %s drop constraint %I',
      constraint_record.table_name,
      constraint_record.conname
    );
  end loop;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'id' and data_type = 'uuid'
  ) then
    alter table public.profiles alter column id type text using id::text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'posts'
      and column_name = 'user_id' and data_type = 'uuid'
  ) then
    alter table public.posts alter column user_id type text using user_id::text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comments'
      and column_name = 'user_id' and data_type = 'uuid'
  ) then
    alter table public.comments alter column user_id type text using user_id::text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'likes'
      and column_name = 'user_id' and data_type = 'uuid'
  ) then
    alter table public.likes alter column user_id type text using user_id::text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'messages'
      and column_name = 'sender_id' and data_type = 'uuid'
  ) then
    alter table public.messages alter column sender_id type text using sender_id::text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'messages'
      and column_name = 'receiver_id' and data_type = 'uuid'
  ) then
    alter table public.messages alter column receiver_id type text using receiver_id::text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'communities'
      and column_name = 'creator_id' and data_type = 'uuid'
  ) then
    alter table public.communities alter column creator_id type text using creator_id::text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'community_members'
      and column_name = 'user_id' and data_type = 'uuid'
  ) then
    alter table public.community_members alter column user_id type text using user_id::text;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'posts_user_id_fkey'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint posts_user_id_fkey foreign key (user_id)
      references public.profiles(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'comments_user_id_fkey'
      and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
      add constraint comments_user_id_fkey foreign key (user_id)
      references public.profiles(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'likes_user_id_fkey'
      and conrelid = 'public.likes'::regclass
  ) then
    alter table public.likes
      add constraint likes_user_id_fkey foreign key (user_id)
      references public.profiles(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'messages_sender_id_fkey'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_sender_id_fkey foreign key (sender_id)
      references public.profiles(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'messages_receiver_id_fkey'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_receiver_id_fkey foreign key (receiver_id)
      references public.profiles(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'communities_creator_id_fkey'
      and conrelid = 'public.communities'::regclass
  ) then
    alter table public.communities
      add constraint communities_creator_id_fkey foreign key (creator_id)
      references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'community_members_user_id_fkey'
      and conrelid = 'public.community_members'::regclass
  ) then
    alter table public.community_members
      add constraint community_members_user_id_fkey foreign key (user_id)
      references public.profiles(id) on delete cascade;
  end if;
end $$;
