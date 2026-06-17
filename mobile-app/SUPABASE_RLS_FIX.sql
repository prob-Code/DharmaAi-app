-- Run this in Supabase SQL Editor to fix the "new row violates row-level security" error

-- 1. Ensure the trigger function bypasses RLS (Security Definer)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

-- 2. Ensure the trigger exists
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Fallback: Allow users to insert their own profile manually (if client does it)
drop policy if exists "Users can insert their own profile." on profiles;
create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );
