-- ============================================================
--  STEP 1 — Purane Supabase users export karo
--  Kahan chalana hai: Supabase Dashboard → SQL Editor
--  Kya karna hai: result ko "Download JSON" se save karo
--                 as  firebase-migration/supabase_users.json
-- ============================================================
--
--  NOTE: auth.users sirf service-role ko dikhta hai. SQL Editor
--  service-role par chalta hai, isliye yahan se chal jayega.
--  App ke anon key se ye kabhi mat chalana.

select
  u.id::text                                as uid,
  u.email,
  u.encrypted_password,                     -- bcrypt hash ($2a$.. ya $2b$..), google users me null
  (u.email_confirmed_at is not null)        as email_verified,
  u.created_at,
  u.last_sign_in_at,
  -- kaunse provider se bana tha
  coalesce(u.raw_app_meta_data->>'provider', 'email')            as provider,
  u.raw_user_meta_data->>'sub'                                   as google_sub,
  u.raw_user_meta_data->>'full_name'                             as full_name,
  u.raw_user_meta_data->>'avatar_url'                            as oauth_avatar,
  -- profile side
  p.username,
  p.display_name,
  p.avatar_url
from auth.users u
left join public.profiles p on p.id = u.id
where u.deleted_at is null
order by u.created_at;


-- ------------------------------------------------------------
--  Sanity check — migration se PEHLE ye numbers note kar lo,
--  baad me inhi se milaan karna hai.
-- ------------------------------------------------------------
-- select 'auth.users'        as t, count(*) from auth.users where deleted_at is null
-- union all select 'profiles',         count(*) from public.profiles
-- union all select 'posts',            count(*) from public.posts
-- union all select 'comments',         count(*) from public.comments
-- union all select 'likes',            count(*) from public.likes
-- union all select 'follows',          count(*) from public.follows
-- union all select 'messages',         count(*) from public.messages
-- union all select 'communities',      count(*) from public.communities
-- union all select 'community_members',count(*) from public.community_members
-- union all select 'notifications',    count(*) from public.notifications
-- union all select 'push_tokens',      count(*) from public.push_tokens;
