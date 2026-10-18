-- Additive Deshpath online games and consented usage events. Service-only writes.
begin;
create table public.deshpath_game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null check(game in ('knowledge','photo','farthest','puzzle')),
  difficulty text not null check(difficulty in ('standard','easy','medium','hard')),
  challenge_day date not null,
  state jsonb not null check(jsonb_typeof(state)='object' and octet_length(state::text)<100000),
  status text not null default 'active' check(status in ('active','completed','cancelled')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique(user_id,game,difficulty,challenge_day)
);
create table public.deshpath_game_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.deshpath_game_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null check(game in ('knowledge','photo','farthest','puzzle')),
  difficulty text not null check(difficulty in ('standard','easy','medium','hard')),
  challenge_day date not null,
  score integer not null check(score between 0 and 5000),
  duration_ms integer not null check(duration_ms between 0 and 7200000),
  finished_at timestamptz not null default now()
);
create index deshpath_game_results_rank_idx on public.deshpath_game_results(game,difficulty,finished_at desc);
create index deshpath_game_results_owner_idx on public.deshpath_game_results(user_id,finished_at desc);
create index deshpath_game_sessions_active_idx on public.deshpath_game_sessions(updated_at desc) where status='active';
create table public.deshpath_analytics_events (
  id uuid primary key,
  session_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  event text not null check(event in ('game_started','game_completed','game_activity','export_prepared','download_requested','print_requested')),
  game text check(game in ('knowledge','photo','farthest','puzzle','personality')),
  export_type text check(export_type in ('bangladesh-map','world-map','bangladesh-passport','world-passport')),
  format text check(format in ('png','jpeg','pdf')),
  created_at timestamptz not null default now(),
  check ((event like 'game_%' and game is not null and export_type is null and format is null)
    or (event not like 'game_%' and game is null and export_type is not null and format is not null))
);
create index deshpath_analytics_date_idx on public.deshpath_analytics_events(created_at desc,event);
alter table public.deshpath_game_sessions enable row level security;
alter table public.deshpath_game_results enable row level security;
alter table public.deshpath_analytics_events enable row level security;
revoke all on public.deshpath_game_sessions,public.deshpath_game_results,public.deshpath_analytics_events from public,anon,authenticated;
grant all on public.deshpath_game_sessions,public.deshpath_game_results,public.deshpath_analytics_events to service_role;

-- Handler computes answers and time. This service-only RPC atomically checks the
-- previous revision, advances the private state, and creates at most one result.
create function public.deshpath_commit_game_answer(p_session_id uuid,p_user_id uuid,p_revision integer,p_state jsonb,p_status text,p_score integer,p_duration_ms integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_row public.deshpath_game_sessions; next_row public.deshpath_game_sessions;
begin
  select * into current_row from public.deshpath_game_sessions where id=p_session_id and user_id=p_user_id for update;
  if not found then raise exception 'game-not-found'; end if;
  if current_row.status<>'active' or current_row.expires_at<=pg_catalog.now() then raise exception 'game-closed'; end if;
  if (current_row.state->>'revision')::integer<>p_revision then raise exception 'game-conflict'; end if;
  if p_status not in ('active','completed') or (p_state->>'revision')::integer<>p_revision+1 then raise exception 'invalid-game-transition'; end if;
  update public.deshpath_game_sessions set state=p_state,status=p_status,updated_at=pg_catalog.now() where id=current_row.id returning * into next_row;
  if p_status='completed' then
    insert into public.deshpath_game_results(session_id,user_id,game,difficulty,challenge_day,score,duration_ms)
    values(current_row.id,current_row.user_id,current_row.game,current_row.difficulty,current_row.challenge_day,p_score,p_duration_ms);
  end if;
  return pg_catalog.to_jsonb(next_row);
end; $$;
revoke all on function public.deshpath_commit_game_answer(uuid,uuid,integer,jsonb,text,integer,integer) from public,anon,authenticated;
grant execute on function public.deshpath_commit_game_answer(uuid,uuid,integer,jsonb,text,integer,integer) to service_role;
create function public.deshpath_public_leaderboard(p_game text,p_difficulty text,p_period text)
returns table(profile_id uuid,display_name text,score integer,duration_ms integer,finished_at timestamptz)
language sql stable security invoker set search_path='' as $$
  with candidates as (
    select p.id as profile_id,p.display_name,r.score,r.duration_ms,r.finished_at,
      row_number() over(partition by r.user_id order by r.score desc,r.duration_ms asc,r.finished_at asc,r.id asc) as own_rank
    from public.deshpath_game_results r join public.deshpath_profiles p on p.user_id=r.user_id
    where p.public_opt_in and p.display_name<>'' and r.game=p_game and r.difficulty=p_difficulty
      and p_period in ('week','all') and (p_period='all' or r.finished_at>=pg_catalog.now()-interval '7 days')
  ) select c.profile_id,c.display_name,c.score,c.duration_ms,c.finished_at from candidates c where c.own_rank=1
  order by c.score desc,c.duration_ms asc,c.finished_at asc,c.profile_id asc limit 100;
$$;
revoke all on function public.deshpath_public_leaderboard(text,text,text) from public,anon,authenticated;
grant execute on function public.deshpath_public_leaderboard(text,text,text) to service_role;
commit;
