-- Baseline reconciliation, 2026-10-26. These changes were ALREADY APPLIED to the live LokServices project
-- (jfavkudihasswkhkouxq) directly through SQL. This file records them so a fresh database matches production.
-- Every statement is idempotent; re-running it is safe.

-- 1. Cloud saves: owner-only, and never for guest (anonymous) accounts. Guest progress stays on the device.
--    Anonymous Auth users use the `authenticated` role, so `TO authenticated` alone does not exclude them.
drop policy if exists "Users manage own saves" on public.auth_saves;
create policy "Users manage own saves" on public.auth_saves for all to authenticated
  using (auth.uid() = user_id and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
  with check (auth.uid() = user_id and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);
revoke truncate, trigger, references on public.auth_saves from anon, authenticated;

-- 2. Fixed search path on seven existing functions (signatures unchanged).
alter function public.check_bleep_rate_limit() set search_path = public, pg_temp;
alter function public.lok_assign_numbers() set search_path = public, pg_temp;
alter function public.lok_format_agent(integer) set search_path = public, pg_temp;
alter function public.lok_format_number(integer) set search_path = public, pg_temp;
alter function public.lok_guard_numbers() set search_path = public, pg_temp;
alter function public.lok_make_friend_code() set search_path = public, pg_temp;
alter function public.send_loks(uuid, integer, text) set search_path = public, pg_temp;

-- 3. Trigger / event-trigger functions are run by the database, never through the API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.send_welcome_email_webhook() from public, anon, authenticated;

-- 4. Friend DMs (live-only; no message text stored). Thread id is a random uuid handed only to the two friends.
create table if not exists public.lok_dm_threads (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
alter table public.lok_dm_threads enable row level security;
revoke all on public.lok_dm_threads from anon, authenticated;
create or replace function public.lok_dm_open(p_friend uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a uuid; b uuid; tid uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if p_friend is null or p_friend = me then raise exception 'bad friend'; end if;
  if not public.lok_is_friend(me, p_friend) then raise exception 'not friends'; end if;
  a := least(me, p_friend); b := greatest(me, p_friend);
  insert into public.lok_dm_threads (user_a, user_b) values (a, b) on conflict do nothing;
  select thread_id into tid from public.lok_dm_threads where user_a = a and user_b = b;
  return tid;
end;
$$;
revoke all on function public.lok_dm_open(uuid) from public, anon;
grant execute on function public.lok_dm_open(uuid) to authenticated;
