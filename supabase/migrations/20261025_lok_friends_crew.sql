-- Lok friends, crews and recent players.
-- Shared by every Lok game: one player card per account, friendships, a small "crew" (up to 4 players)
-- and a recent-players list. Presence (who is online) is NOT stored here; it rides Supabase Realtime
-- presence, which costs nothing at rest.
--
-- All writes go through the security-definer functions below. Tables are read-only to the client and
-- row-level security limits every read to the player's own friends, crew and invites.

create table if not exists public.lok_player_cards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  friend_code text not null unique,
  display_name text not null default 'Player',
  avatar_url text,
  show_online boolean not null default true,
  allow_requests boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.lok_friendships (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists lok_friendships_b_idx on public.lok_friendships (user_b);

create table if not exists public.lok_recent_players (
  user_id uuid not null references auth.users(id) on delete cascade,
  other_id uuid not null references auth.users(id) on delete cascade,
  game text not null,
  last_played_at timestamptz not null default now(),
  primary key (user_id, other_id)
);

create table if not exists public.lok_crews (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid not null references auth.users(id) on delete cascade,
  game text not null default 'survivor616',
  created_at timestamptz not null default now()
);

-- unique (user_id): a player is in one crew at a time.
create table if not exists public.lok_crew_members (
  crew_id uuid not null references public.lok_crews(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);

create table if not exists public.lok_crew_invites (
  crew_id uuid not null references public.lok_crews(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (crew_id, to_user)
);
create index if not exists lok_crew_invites_to_idx on public.lok_crew_invites (to_user);

alter table public.lok_player_cards enable row level security;
alter table public.lok_friendships enable row level security;
alter table public.lok_recent_players enable row level security;
alter table public.lok_crews enable row level security;
alter table public.lok_crew_members enable row level security;
alter table public.lok_crew_invites enable row level security;

-- Helpers (security definer so policies can look across tables without recursion).
create or replace function public.lok_is_friend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.lok_friendships
    where user_a = least(a, b) and user_b = greatest(a, b) and status = 'accepted'
  );
$$;

create or replace function public.lok_in_same_crew(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.lok_crew_members x join public.lok_crew_members y on x.crew_id = y.crew_id
    where x.user_id = a and y.user_id = b
  );
$$;

drop policy if exists lok_cards_read on public.lok_player_cards;
create policy lok_cards_read on public.lok_player_cards for select to authenticated
  using (user_id = auth.uid() or public.lok_is_friend(auth.uid(), user_id) or public.lok_in_same_crew(auth.uid(), user_id));

drop policy if exists lok_friendships_read on public.lok_friendships;
create policy lok_friendships_read on public.lok_friendships for select to authenticated
  using (auth.uid() in (user_a, user_b));

drop policy if exists lok_recent_read on public.lok_recent_players;
create policy lok_recent_read on public.lok_recent_players for select to authenticated
  using (user_id = auth.uid());

drop policy if exists lok_crews_read on public.lok_crews;
create policy lok_crews_read on public.lok_crews for select to authenticated
  using (exists (select 1 from public.lok_crew_members m where m.crew_id = id and m.user_id = auth.uid()));

drop policy if exists lok_crew_members_read on public.lok_crew_members;
create policy lok_crew_members_read on public.lok_crew_members for select to authenticated
  using (user_id = auth.uid() or public.lok_in_same_crew(auth.uid(), user_id));

drop policy if exists lok_crew_invites_read on public.lok_crew_invites;
create policy lok_crew_invites_read on public.lok_crew_invites for select to authenticated
  using (to_user = auth.uid() or from_user = auth.uid());

revoke all on public.lok_player_cards, public.lok_friendships, public.lok_recent_players,
  public.lok_crews, public.lok_crew_members, public.lok_crew_invites from anon, authenticated;
grant select on public.lok_player_cards, public.lok_friendships, public.lok_recent_players,
  public.lok_crews, public.lok_crew_members, public.lok_crew_invites to authenticated;

-- Friend codes look like LOK-7K2M-Q9XD. No I, L, O, 0 or 1, so they read cleanly aloud.
create or replace function public.lok_make_friend_code() returns text
language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := 'LOK-';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      if i = 4 then code := code || '-'; end if;
    end loop;
    exit when not exists (select 1 from public.lok_player_cards where friend_code = code);
  end loop;
  return code;
end;
$$;

-- Creates the caller's card on first use and keeps name and picture fresh from their sign-in.
create or replace function public.lok_card_sync(p_name text, p_avatar text)
returns public.lok_player_cards
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  card public.lok_player_cards;
  clean_name text := left(coalesce(nullif(btrim(p_name), ''), 'Player'), 40);
  clean_avatar text := case when p_avatar ~* '^https://' and length(p_avatar) <= 500 then p_avatar else null end;
begin
  if me is null then raise exception 'not signed in'; end if;
  insert into public.lok_player_cards (user_id, friend_code, display_name, avatar_url)
  values (me, public.lok_make_friend_code(), clean_name, clean_avatar)
  on conflict (user_id) do update
    set display_name = excluded.display_name, avatar_url = excluded.avatar_url, updated_at = now()
  returning * into card;
  return card;
end;
$$;

create or replace function public.lok_card_settings(p_show_online boolean, p_allow_requests boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.lok_player_cards
     set show_online = coalesce(p_show_online, show_online),
         allow_requests = coalesce(p_allow_requests, allow_requests),
         updated_at = now()
   where user_id = auth.uid();
end;
$$;

create or replace function public.lok_card_new_code() returns text
language plpgsql security definer set search_path = public as $$
declare code text := public.lok_make_friend_code();
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.lok_player_cards set friend_code = code, updated_at = now() where user_id = auth.uid();
  return code;
end;
$$;

-- Friend requests: by code. Result is one of: sent, accepted (they had already asked you),
-- already, self, unknown, closed, limit.
create or replace function public.lok_friend_request(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  target public.lok_player_cards;
  a uuid; b uuid;
  existing public.lok_friendships;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into target from public.lok_player_cards where friend_code = upper(btrim(p_code));
  if not found then return 'unknown'; end if;
  if target.user_id = me then return 'self'; end if;
  if not target.allow_requests then return 'closed'; end if;
  a := least(me, target.user_id); b := greatest(me, target.user_id);
  select * into existing from public.lok_friendships where user_a = a and user_b = b;
  if found then
    if existing.status = 'accepted' then return 'already'; end if;
    if existing.requested_by = me then return 'sent'; end if;
    update public.lok_friendships set status = 'accepted' where user_a = a and user_b = b;
    return 'accepted';
  end if;
  if (select count(*) from public.lok_friendships where requested_by = me and status = 'pending') >= 40 then
    return 'limit';
  end if;
  insert into public.lok_friendships (user_a, user_b, requested_by) values (a, b, me);
  return 'sent';
end;
$$;

create or replace function public.lok_friend_respond(p_other uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if p_accept then
    update public.lok_friendships set status = 'accepted'
     where user_a = least(me, p_other) and user_b = greatest(me, p_other) and requested_by = p_other and status = 'pending';
  else
    delete from public.lok_friendships
     where user_a = least(me, p_other) and user_b = greatest(me, p_other) and requested_by = p_other and status = 'pending';
  end if;
end;
$$;

-- Unfriend, or cancel a request you sent.
create or replace function public.lok_friend_remove(p_other uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  delete from public.lok_friendships where user_a = least(me, p_other) and user_b = greatest(me, p_other);
end;
$$;

-- Everyone the caller is connected to, with names and pictures, in one call.
create or replace function public.lok_friends_list()
returns table (user_id uuid, display_name text, avatar_url text, show_online boolean, status text, incoming boolean)
language sql stable security definer set search_path = public as $$
  select c.user_id, c.display_name, c.avatar_url, c.show_online, f.status, (f.requested_by <> auth.uid()) as incoming
    from public.lok_friendships f
    join public.lok_player_cards c on c.user_id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
   where auth.uid() in (f.user_a, f.user_b)
   order by f.status, c.display_name;
$$;

create or replace function public.lok_record_recent(p_others uuid[], p_game text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  insert into public.lok_recent_players (user_id, other_id, game, last_played_at)
  select me, o, left(coalesce(p_game, 'survivor616'), 40), now()
    from unnest(p_others[1:8]) as o
   where o <> me and exists (select 1 from public.lok_player_cards where user_id = o)
  on conflict (user_id, other_id) do update set last_played_at = now(), game = excluded.game;
  delete from public.lok_recent_players
   where user_id = me and other_id in (
     select other_id from public.lok_recent_players where user_id = me order by last_played_at desc offset 30
   );
end;
$$;

create or replace function public.lok_recent_list()
returns table (user_id uuid, display_name text, avatar_url text, game text, last_played_at timestamptz, is_friend boolean)
language sql stable security definer set search_path = public as $$
  select r.other_id, c.display_name, c.avatar_url, r.game, r.last_played_at, public.lok_is_friend(auth.uid(), r.other_id)
    from public.lok_recent_players r
    join public.lok_player_cards c on c.user_id = r.other_id
   where r.user_id = auth.uid()
   order by r.last_played_at desc
   limit 30;
$$;

-- Crews. Up to 4 players. Only friends can be invited. Leaving as leader hands the crew to the longest-standing member.
create or replace function public.lok_crew_create(p_game text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); new_id uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  perform public.lok_crew_leave();
  insert into public.lok_crews (leader_id, game) values (me, left(coalesce(p_game, 'survivor616'), 40)) returning id into new_id;
  insert into public.lok_crew_members (crew_id, user_id) values (new_id, me);
  return new_id;
end;
$$;

create or replace function public.lok_crew_invite(p_crew uuid, p_to uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.lok_crew_members where crew_id = p_crew and user_id = me) then return 'not-member'; end if;
  if not public.lok_is_friend(me, p_to) then return 'not-friend'; end if;
  if exists (select 1 from public.lok_crew_members where crew_id = p_crew and user_id = p_to) then return 'already'; end if;
  if (select count(*) from public.lok_crew_members where crew_id = p_crew) >= 4 then return 'full'; end if;
  insert into public.lok_crew_invites (crew_id, to_user, from_user) values (p_crew, p_to, me)
  on conflict (crew_id, to_user) do update set created_at = now(), from_user = me;
  return 'sent';
end;
$$;

create or replace function public.lok_crew_accept(p_crew uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.lok_crew_invites where crew_id = p_crew and to_user = me) then return 'no-invite'; end if;
  if (select count(*) from public.lok_crew_members where crew_id = p_crew) >= 4 then
    delete from public.lok_crew_invites where crew_id = p_crew and to_user = me;
    return 'full';
  end if;
  perform public.lok_crew_leave();
  insert into public.lok_crew_members (crew_id, user_id) values (p_crew, me);
  delete from public.lok_crew_invites where to_user = me;
  return 'joined';
end;
$$;

create or replace function public.lok_crew_decline(p_crew uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.lok_crew_invites where crew_id = p_crew and to_user = auth.uid();
end;
$$;

create or replace function public.lok_crew_leave() returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mine uuid; heir uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  select crew_id into mine from public.lok_crew_members where user_id = me;
  if mine is null then return; end if;
  delete from public.lok_crew_members where user_id = me;
  select user_id into heir from public.lok_crew_members where crew_id = mine order by joined_at limit 1;
  if heir is null then
    delete from public.lok_crews where id = mine;
  else
    update public.lok_crews set leader_id = heir where id = mine and leader_id = me;
  end if;
end;
$$;

create or replace function public.lok_crew_kick(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mine uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  select id into mine from public.lok_crews where leader_id = me;
  if mine is null or p_user = me then return; end if;
  delete from public.lok_crew_members where crew_id = mine and user_id = p_user;
end;
$$;

-- The caller's crew, its members and the invites waiting for them, as one document.
create or replace function public.lok_crew_state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); mine uuid; crew_row public.lok_crews; members jsonb; invites jsonb;
begin
  if me is null then raise exception 'not signed in'; end if;
  select crew_id into mine from public.lok_crew_members where user_id = me;
  if mine is not null then
    select * into crew_row from public.lok_crews where id = mine;
    select coalesce(jsonb_agg(jsonb_build_object(
      'userId', m.user_id, 'name', c.display_name, 'avatar', c.avatar_url, 'showOnline', c.show_online
    ) order by m.joined_at), '[]'::jsonb)
      into members
      from public.lok_crew_members m join public.lok_player_cards c on c.user_id = m.user_id
     where m.crew_id = mine;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'crewId', i.crew_id, 'fromId', i.from_user, 'fromName', c.display_name, 'fromAvatar', c.avatar_url
  ) order by i.created_at desc), '[]'::jsonb)
    into invites
    from public.lok_crew_invites i join public.lok_player_cards c on c.user_id = i.from_user
   where i.to_user = me and i.created_at > now() - interval '1 day';
  return jsonb_build_object(
    'crew', case when mine is null then null else jsonb_build_object('id', crew_row.id, 'leaderId', crew_row.leader_id, 'game', crew_row.game) end,
    'members', coalesce(members, '[]'::jsonb),
    'invites', invites
  );
end;
$$;

revoke all on function
  public.lok_card_sync(text, text), public.lok_card_settings(boolean, boolean), public.lok_card_new_code(),
  public.lok_friend_request(text), public.lok_friend_respond(uuid, boolean), public.lok_friend_remove(uuid),
  public.lok_friends_list(), public.lok_record_recent(uuid[], text), public.lok_recent_list(),
  public.lok_crew_create(text), public.lok_crew_invite(uuid, uuid), public.lok_crew_accept(uuid),
  public.lok_crew_decline(uuid), public.lok_crew_leave(), public.lok_crew_kick(uuid), public.lok_crew_state(),
  public.lok_make_friend_code(), public.lok_is_friend(uuid, uuid), public.lok_in_same_crew(uuid, uuid)
  from public, anon, authenticated;
grant execute on function
  public.lok_card_sync(text, text), public.lok_card_settings(boolean, boolean), public.lok_card_new_code(),
  public.lok_friend_request(text), public.lok_friend_respond(uuid, boolean), public.lok_friend_remove(uuid),
  public.lok_friends_list(), public.lok_record_recent(uuid[], text), public.lok_recent_list(),
  public.lok_crew_create(text), public.lok_crew_invite(uuid, uuid), public.lok_crew_accept(uuid),
  public.lok_crew_decline(uuid), public.lok_crew_leave(), public.lok_crew_kick(uuid), public.lok_crew_state()
  to authenticated;
-- The two row-level-security helpers must stay callable by the policies that use them.
grant execute on function public.lok_is_friend(uuid, uuid), public.lok_in_same_crew(uuid, uuid) to authenticated;

-- Live updates for crew roster, invites and friend requests (row-level security still applies).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.lok_crew_members; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.lok_crew_invites; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.lok_friendships; exception when duplicate_object then null; end;
  end if;
end $$;
