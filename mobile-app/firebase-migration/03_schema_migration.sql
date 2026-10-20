-- ============================================================
--  STEP 3 — Schema ko Firebase Auth ke liye migrate karo
--  Kahan chalana hai: Supabase Dashboard → SQL Editor
--
--  Ye kya karta hai:
--    1. auth.users par nirbharta hatata hai (trigger + foreign key)
--    2. saare user-id columns uuid → text karta hai
--       (values wahi rehti hain, kyunki humne Firebase me same UUID
--        localId ke roop me import kiya hai — 02 script dekho)
--    3. har RLS policy ko auth.uid() se auth.jwt()->>'sub' par le jaata hai
--       [auth.uid() ko uuid cast chahiye, Firebase UID uuid nahi hoti]
--    4. sirf tumhare Firebase project ke tokens allow karta hai
--
--  PEHLE BACKUP LO:
--    Supabase Dashboard → Database → Backups → on-demand backup
--  Ye migration ek transaction me hai — beech me fail hua to
--  poora rollback ho jayega, aadha-adhoora state nahi banega.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0. Helpers
--
--    current_uid()  → token ka 'sub' as TEXT (Firebase UID ya purana UUID)
--    is_our_token() → token sach me TUMHARE Firebase project ka hai?
--
--    Dono SECURITY DEFINER hain. Wajah: plain `language sql` function
--    policy me inline ho jaata hai aur phir caller ke privileges se
--    `auth` schema chhoota hai — jahan authenticated role ko usage na
--    ho, wahan har query "permission denied for schema auth" se girti
--    hai. SECURITY DEFINER + fixed search_path isse pakka theek rakhta hai.
-- ------------------------------------------------------------
create or replace function public.current_uid()
returns text
language sql
stable
security definer
set search_path = auth, public, pg_temp
as $$
  select nullif(auth.jwt() ->> 'sub', '')
$$;

create or replace function public.is_our_token()
returns boolean
language sql
stable
security definer
set search_path = auth, public, pg_temp
as $$
  select
    -- tumhara Firebase project
    (auth.jwt() ->> 'iss' = 'https://securetoken.google.com/sarrthi-d81d3'
     and auth.jwt() ->> 'aud' = 'sarrthi-d81d3')
$$;

revoke all on function public.current_uid()  from public;
revoke all on function public.is_our_token() from public;
grant execute on function public.current_uid()  to anon, authenticated, service_role;
grant execute on function public.is_our_token() to anon, authenticated, service_role;


-- ------------------------------------------------------------
-- 1. Purani auth.users nirbharta hatao
-- ------------------------------------------------------------
drop trigger  if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;

alter table public.profiles drop constraint if exists profiles_id_fkey;


-- ------------------------------------------------------------
-- 2. Saari RLS policies drop karo
--    (column type badalne se pehle hatana zaroori hai, kyunki
--     ye policies uuid comparison par bani hain)
-- ------------------------------------------------------------
drop policy if exists "Public profiles are viewable by everyone."   on public.profiles;
drop policy if exists "Users can insert their own profile."         on public.profiles;
drop policy if exists "Users can update own profile."               on public.profiles;

drop policy if exists "Posts are viewable by everyone."             on public.posts;
drop policy if exists "Users can insert their own posts."           on public.posts;
drop policy if exists "Users can update own posts."                 on public.posts;
drop policy if exists "Users can delete own posts."                 on public.posts;

drop policy if exists "Comments are viewable by everyone."          on public.comments;
drop policy if exists "Users can insert their own comments."        on public.comments;
drop policy if exists "Users can delete own comments."              on public.comments;

drop policy if exists "Likes are viewable by everyone"              on public.likes;
drop policy if exists "Users can insert their own likes."           on public.likes;
drop policy if exists "Users can delete own likes."                 on public.likes;

drop policy if exists "Follows are viewable by everyone"            on public.follows;
drop policy if exists "Users can follow others"                     on public.follows;
drop policy if exists "Users can unfollow"                          on public.follows;

drop policy if exists "Users can view their own messages"           on public.messages;
drop policy if exists "Users can send messages"                     on public.messages;

drop policy if exists "Communities are viewable by everyone"        on public.communities;
drop policy if exists "Authenticated users can create communities"  on public.communities;

drop policy if exists "Community members are viewable by everyone"  on public.community_members;
drop policy if exists "Users can join communities"                  on public.community_members;
drop policy if exists "Users can leave communities"                 on public.community_members;

drop policy if exists "Users can view their own notifications"      on public.notifications;

drop policy if exists "Users can view own push tokens"              on public.push_tokens;
drop policy if exists "Users can insert own push tokens"            on public.push_tokens;
drop policy if exists "Users can update own push tokens"            on public.push_tokens;
drop policy if exists "Users can delete own push tokens"            on public.push_tokens;


-- ------------------------------------------------------------
-- 3. Foreign keys drop karo (type badalne ke liye)
-- ------------------------------------------------------------
alter table public.posts             drop constraint if exists posts_user_id_fkey;
alter table public.comments          drop constraint if exists comments_user_id_fkey;
alter table public.likes             drop constraint if exists likes_user_id_fkey;
alter table public.follows           drop constraint if exists follows_follower_id_fkey;
alter table public.follows           drop constraint if exists follows_following_id_fkey;
alter table public.messages          drop constraint if exists messages_sender_id_fkey;
alter table public.messages          drop constraint if exists messages_receiver_id_fkey;
alter table public.communities       drop constraint if exists communities_creator_id_fkey;
alter table public.community_members drop constraint if exists community_members_user_id_fkey;
alter table public.notifications     drop constraint if exists notifications_user_id_fkey;
alter table public.push_tokens       drop constraint if exists push_tokens_user_id_fkey;


-- ------------------------------------------------------------
-- 4. uuid → text
--    Values nahi badalti: '3f9a...' uuid ka text roop wahi string hai,
--    aur wahi string humne Firebase me localId banaya hai.
-- ------------------------------------------------------------
alter table public.profiles          alter column id           type text using id::text;

alter table public.posts             alter column user_id      type text using user_id::text;
alter table public.comments          alter column user_id      type text using user_id::text;
alter table public.likes             alter column user_id      type text using user_id::text;
alter table public.follows           alter column follower_id  type text using follower_id::text;
alter table public.follows           alter column following_id type text using following_id::text;
alter table public.messages          alter column sender_id    type text using sender_id::text;
alter table public.messages          alter column receiver_id  type text using receiver_id::text;
alter table public.communities       alter column creator_id   type text using creator_id::text;
alter table public.community_members alter column user_id      type text using user_id::text;
alter table public.notifications     alter column user_id      type text using user_id::text;
alter table public.push_tokens       alter column user_id      type text using user_id::text;


-- ------------------------------------------------------------
-- 5. Foreign keys wapas lagao (ab text par)
-- ------------------------------------------------------------
alter table public.posts
  add constraint posts_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.comments
  add constraint comments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.likes
  add constraint likes_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.follows
  add constraint follows_follower_id_fkey
  foreign key (follower_id) references public.profiles(id) on delete cascade;

alter table public.follows
  add constraint follows_following_id_fkey
  foreign key (following_id) references public.profiles(id) on delete cascade;

alter table public.messages
  add constraint messages_sender_id_fkey
  foreign key (sender_id) references public.profiles(id) on delete cascade;

alter table public.messages
  add constraint messages_receiver_id_fkey
  foreign key (receiver_id) references public.profiles(id) on delete cascade;

alter table public.communities
  add constraint communities_creator_id_fkey
  foreign key (creator_id) references public.profiles(id) on delete set null;

alter table public.community_members
  add constraint community_members_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.notifications
  add constraint notifications_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.push_tokens
  add constraint push_tokens_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;


-- ------------------------------------------------------------
-- 6. RLS policies dobara — ab current_uid() (text) par
-- ------------------------------------------------------------

-- profiles
create policy "Public profiles are viewable by everyone."
  on public.profiles for select using ( true );
create policy "Users can insert their own profile."
  on public.profiles for insert with check ( (select public.current_uid()) = id );
create policy "Users can update own profile."
  on public.profiles for update using ( (select public.current_uid()) = id );

-- posts
create policy "Posts are viewable by everyone."
  on public.posts for select using ( true );
create policy "Users can insert their own posts."
  on public.posts for insert with check ( (select public.current_uid()) = user_id );
create policy "Users can update own posts."
  on public.posts for update using ( (select public.current_uid()) = user_id );
create policy "Users can delete own posts."
  on public.posts for delete using ( (select public.current_uid()) = user_id );

-- comments
create policy "Comments are viewable by everyone."
  on public.comments for select using ( true );
create policy "Users can insert their own comments."
  on public.comments for insert with check ( (select public.current_uid()) = user_id );
create policy "Users can delete own comments."
  on public.comments for delete using ( (select public.current_uid()) = user_id );

-- likes
create policy "Likes are viewable by everyone"
  on public.likes for select using ( true );
create policy "Users can insert their own likes."
  on public.likes for insert with check ( (select public.current_uid()) = user_id );
create policy "Users can delete own likes."
  on public.likes for delete using ( (select public.current_uid()) = user_id );

-- follows
create policy "Follows are viewable by everyone"
  on public.follows for select using ( true );
create policy "Users can follow others"
  on public.follows for insert with check ( (select public.current_uid()) = follower_id );
create policy "Users can unfollow"
  on public.follows for delete using ( (select public.current_uid()) = follower_id );

-- messages
create policy "Users can view their own messages"
  on public.messages for select
  using ( (select public.current_uid()) = sender_id or (select public.current_uid()) = receiver_id );
create policy "Users can send messages"
  on public.messages for insert with check ( (select public.current_uid()) = sender_id );

-- communities
create policy "Communities are viewable by everyone"
  on public.communities for select using ( true );
-- Original policy thi: auth.role() = 'authenticated'
-- Firebase token me role claim custom claim se aata hai, isliye seedha
-- "signed in hai ya nahi" check kar rahe hain — semantics wahi rehti hai.
create policy "Authenticated users can create communities"
  on public.communities for insert
  with check ( (select public.current_uid()) is not null );
-- Chaaho to baad me isse tight kar sakte ho:
--   with check ( (select public.current_uid()) = creator_id )
-- par pehle confirm karna ki app insert karte waqt creator_id set karta hai.

-- community_members
create policy "Community members are viewable by everyone"
  on public.community_members for select using ( true );
create policy "Users can join communities"
  on public.community_members for insert with check ( (select public.current_uid()) = user_id );
create policy "Users can leave communities"
  on public.community_members for delete using ( (select public.current_uid()) = user_id );

-- notifications
create policy "Users can view their own notifications"
  on public.notifications for select using ( (select public.current_uid()) = user_id );

-- push_tokens
create policy "Users can view own push tokens"
  on public.push_tokens for select using ( (select public.current_uid()) = user_id );
create policy "Users can insert own push tokens"
  on public.push_tokens for insert with check ( (select public.current_uid()) = user_id );
create policy "Users can update own push tokens"
  on public.push_tokens for update using ( (select public.current_uid()) = user_id );
create policy "Users can delete own push tokens"
  on public.push_tokens for delete using ( (select public.current_uid()) = user_id );


-- ------------------------------------------------------------
-- 7. Sirf TUMHARE Firebase project ke tokens allow karo
--    Firebase ki JWT signing keys saare projects me shared hain,
--    isliye issuer + audience check zaroori hai — warna kisi aur
--    ke Firebase project ka token bhi tumhara data padh sakta hai.
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','posts','comments','likes','follows','messages',
    'communities','community_members','notifications','push_tokens'
  ]
  loop
    execute format('drop policy if exists "Only our Firebase project" on public.%I', t);
    execute format(
      'create policy "Only our Firebase project" on public.%I '
      'as restrictive to authenticated '
      'using ( (select public.is_our_token()) )', t);
  end loop;
end $$;

commit;


-- ============================================================
--  VERIFY — migration ke baad ye chalao
-- ============================================================
-- 1) Column types text ho gaye?
-- select table_name, column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and column_name in ('id','user_id','sender_id','receiver_id','follower_id','following_id','creator_id')
--   and table_name in ('profiles','posts','comments','likes','follows','messages',
--                      'communities','community_members','notifications','push_tokens')
-- order by table_name, column_name;
--
-- 2) Row counts wahi hain jo step 1 me note kiye the?
-- select 'profiles' as t, count(*) from public.profiles
-- union all select 'posts', count(*) from public.posts
-- union all select 'messages', count(*) from public.messages
-- union all select 'follows', count(*) from public.follows;
--
-- 3) Koi orphan row to nahi bani?
-- select count(*) as orphan_posts
-- from public.posts p
-- left join public.profiles pr on pr.id = p.user_id
-- where pr.id is null;
