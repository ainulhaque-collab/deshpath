-- Additive community release. Apply after setup.sql, before games.sql and catalog seed.
-- No shared Auth hooks, Storage schema writes, or changes to the three v1 tables.
begin;
create table public.deshpath_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check(role in ('owner','moderator')), active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.deshpath_profiles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null default 'Traveller' check(char_length(btrim(display_name)) between 2 and 60),
  public_opt_in boolean not null default false, analytics_opt_in boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.deshpath_media (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), original_path text not null unique, prepared_path text not null unique,
  public_path text, mime text not null check(mime in ('image/jpeg','image/png','image/webp')),
  bytes integer not null check(bytes between 1 and 5242880), width integer not null check(width between 1 and 12000),
  height integer not null check(height between 1 and 12000), metadata jsonb not null default '{}'::jsonb check(octet_length(metadata::text)<=4096),
  caption text not null default '' check(char_length(caption)<=200), consent_at timestamptz not null default now(),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(), unique(user_id,sha256), check(width::bigint*height<=24000000)
);
create table public.deshpath_destination_submissions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  place_id text, payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=24000),
  photo_ids uuid[] not null check(cardinality(photo_ids) between 1 and 3), dedupe_key text not null,
  status text not null default 'pending' check(status in ('pending','changes_requested','approved','rejected','archived')),
  reason text not null default '' check(char_length(reason)<=1000), revision integer not null default 1,
  published_revision integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,dedupe_key)
);
create table public.deshpath_places (
  id text primary key check(id ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  user_id uuid references auth.users(id) on delete set null,
  submission_id uuid unique references public.deshpath_destination_submissions(id) on delete set null,
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=24000),
  photo_ids uuid[] not null default '{}' check(cardinality(photo_ids)<=3),
  builtin boolean not null default false, status text not null default 'published' check(status in ('published','archived')),
  published_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.deshpath_destination_submissions add constraint deshpath_submission_place_fk foreign key(place_id) references public.deshpath_places(id);
create table public.deshpath_review_submissions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null references public.deshpath_places(id),
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=8000),
  photo_ids uuid[] not null default '{}' check(cardinality(photo_ids)<=3), dedupe_key text not null,
  status text not null default 'pending' check(status in ('pending','changes_requested','approved','rejected','archived')),
  reason text not null default '' check(char_length(reason)<=1000), revision integer not null default 1,
  published_revision integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,place_id)
);
create table public.deshpath_visit_reviews (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null references public.deshpath_places(id), source_id uuid not null unique references public.deshpath_review_submissions(id),
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=8000),
  photo_ids uuid[] not null default '{}' check(cardinality(photo_ids)<=3),
  status text not null default 'published' check(status in ('published','archived')), published_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,place_id)
);
create table public.deshpath_reports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'report' check(kind in ('report','withdraw')),
  place_id text references public.deshpath_places(id), review_id uuid references public.deshpath_visit_reviews(id),
  reason text not null check(char_length(btrim(reason)) between 10 and 1000),
  status text not null default 'pending' check(status in ('pending','resolved','rejected')),
  resolution text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(place_id is not null or review_id is not null)
);
create table public.deshpath_notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, message text not null check(char_length(message)<=1200), entity_id text,
  created_at timestamptz not null default now(), read_at timestamptz
);
create table public.deshpath_moderation_audit (
  id bigint generated always as identity primary key, actor_id uuid references auth.users(id) on delete set null,
  kind text not null, item_id text not null, decision text not null, reason text not null default '',
  detail jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table public.deshpath_rate_limits (
  key text not null, window_start timestamptz not null, hits integer not null default 1, expires_at timestamptz not null,
  primary key(key,window_start)
);
create index deshpath_media_owner_idx on public.deshpath_media(user_id,created_at desc);
create index deshpath_dest_queue_idx on public.deshpath_destination_submissions(status,updated_at);
create index deshpath_dest_owner_idx on public.deshpath_destination_submissions(user_id,updated_at desc);
create index deshpath_review_queue_idx on public.deshpath_review_submissions(status,updated_at);
create index deshpath_review_public_idx on public.deshpath_visit_reviews(place_id,published_at desc) where status='published';
create index deshpath_notifications_owner_idx on public.deshpath_notifications(user_id,created_at desc);
create index deshpath_reports_queue_idx on public.deshpath_reports(status,created_at);
create index deshpath_audit_recent_idx on public.deshpath_moderation_audit(created_at desc);
create index deshpath_rate_expiry_idx on public.deshpath_rate_limits(expires_at);

-- No policies or browser grants: all reads/writes use the explicitly authorized Edge API.
do $$ declare t text; begin
  foreach t in array array['deshpath_admins','deshpath_profiles','deshpath_media','deshpath_destination_submissions','deshpath_places','deshpath_review_submissions','deshpath_visit_reviews','deshpath_reports','deshpath_notifications','deshpath_moderation_audit','deshpath_rate_limits'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
revoke all on sequence public.deshpath_moderation_audit_id_seq from public,anon,authenticated;
grant usage,select on sequence public.deshpath_moderation_audit_id_seq to service_role;

create function public.deshpath_take_rate(p_key text,p_limit integer,p_window_seconds integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare w timestamptz; n integer;
begin
  if p_limit not between 1 and 10000 or p_window_seconds not between 1 and 86400 or char_length(p_key) not between 1 and 200 then raise exception 'invalid-input'; end if;
  w:=to_timestamp(floor(extract(epoch from clock_timestamp())/p_window_seconds)*p_window_seconds);
  insert into public.deshpath_rate_limits(key,window_start,hits,expires_at) values(p_key,w,1,w+make_interval(secs=>p_window_seconds*2))
  on conflict(key,window_start) do update set hits=public.deshpath_rate_limits.hits+1 returning hits into n;
  -- Bounded opportunistic cleanup without an unbounded per-request DELETE.
  delete from public.deshpath_rate_limits where (key,window_start) in (select key,window_start from public.deshpath_rate_limits where expires_at<clock_timestamp() limit 100);
  return n<=p_limit;
end $$;

create function public.deshpath_save_proposal(p_actor uuid,p_kind text,p_id uuid,p_place_id text,p_payload jsonb,p_photo_ids uuid[]) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.deshpath_destination_submissions; v public.deshpath_review_submissions; k text; c integer;
begin
  if p_actor is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>24000 or p_photo_ids is null or cardinality(p_photo_ids)>3 then raise exception 'invalid-input';end if;
  select count(*) into c from public.deshpath_media where id=any(p_photo_ids) and user_id=p_actor and status in('pending','approved');
  if c<>cardinality(p_photo_ids) then raise exception 'invalid-photo';end if;
  k:=md5(p_payload::text||p_photo_ids::text||coalesce(p_place_id,''));
  if p_kind='submissions' then
    if cardinality(p_photo_ids)<1 then raise exception 'invalid-photo';end if;
    if p_id is not null then
      select * into r from public.deshpath_destination_submissions where id=p_id and user_id=p_actor for update;
      if not found or r.status='archived' then raise exception 'not-found';end if;
      if r.dedupe_key=k then return to_jsonb(r);end if;
      update public.deshpath_destination_submissions set payload=p_payload,photo_ids=p_photo_ids,dedupe_key=k,status='pending',reason='',revision=revision+1,updated_at=now() where id=r.id returning * into r;
    else
      insert into public.deshpath_destination_submissions(user_id,payload,photo_ids,dedupe_key) values(p_actor,p_payload,p_photo_ids,k)
      on conflict(user_id,dedupe_key) do update set dedupe_key=excluded.dedupe_key returning * into r;
    end if;
    return to_jsonb(r);
  elsif p_kind='reviews' then
    if not exists(select 1 from public.deshpath_places where id=p_place_id and status='published') then raise exception 'not-found';end if;
    select * into v from public.deshpath_review_submissions where user_id=p_actor and place_id=p_place_id for update;
    if found then
      if p_id is not null and p_id<>v.id then raise exception 'not-found';end if;
      if v.dedupe_key=k then return to_jsonb(v);end if;
      update public.deshpath_review_submissions set payload=p_payload,photo_ids=p_photo_ids,dedupe_key=k,status='pending',reason='',revision=revision+1,updated_at=now() where id=v.id returning * into v;
    else
      if p_id is not null then raise exception 'not-found';end if;
      insert into public.deshpath_review_submissions(user_id,place_id,payload,photo_ids,dedupe_key) values(p_actor,p_place_id,p_payload,p_photo_ids,k) returning * into v;
    end if;
    return to_jsonb(v);
  end if;
  raise exception 'invalid-input';
end $$;

-- Expected revision prevents moderation of an edited proposal after the admin loaded it.
-- Publication, status, notification and audit commit together; a revision never changes the
-- currently published snapshot until this transaction approves it.
create function public.deshpath_moderate(p_actor uuid,p_kind text,p_id text,p_decision text,p_reason text,p_payload jsonb,p_photo_ids uuid[],p_merge_place_id text,p_revision integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s public.deshpath_destination_submissions; r public.deshpath_review_submissions; q public.deshpath_reports;
  p public.deshpath_places; v public.deshpath_visit_reviews; owner_id uuid; body jsonb; ids uuid[]; result jsonb; target text;
begin
  if not exists(select 1 from public.deshpath_admins where user_id=p_actor and active=true) then raise exception 'admin-required';end if;
  if p_decision not in('approve','reject','changes_requested','archive','resolve') or char_length(coalesce(p_reason,''))>1000 then raise exception 'invalid-input';end if;
  if p_decision in('reject','changes_requested','archive') and char_length(btrim(coalesce(p_reason,'')))<5 then raise exception 'reason-required';end if;
  if p_kind='submissions' then
    select * into s from public.deshpath_destination_submissions where id=p_id::uuid for update;
    if not found then raise exception 'not-found';end if;
    if s.revision<>p_revision then raise exception 'revision-conflict';end if;
    if p_merge_place_id is not null and s.place_id is not null and p_merge_place_id<>s.place_id then raise exception 'conflict';end if;
    if p_decision not in('approve','reject','changes_requested','archive') then raise exception 'invalid-input';end if;
    owner_id:=s.user_id;body:=coalesce(p_payload,s.payload);ids:=coalesce(p_photo_ids,s.photo_ids);
    if p_decision='approve' then
      if s.status='approved' and s.published_revision=s.revision and body=s.payload and ids=s.photo_ids then return jsonb_build_object('item',to_jsonb(s),'place',(select to_jsonb(x) from public.deshpath_places x where x.id=s.place_id));end if;
      if body is distinct from s.payload or ids is distinct from s.photo_ids then update public.deshpath_destination_submissions set revision=revision+1 where id=s.id returning * into s;end if;
      perform 1 from public.deshpath_media where id=any(ids) order by id for update;
      if cardinality(ids) not between 1 and 3 or exists(select 1 from unnest(ids) i where not exists(select 1 from public.deshpath_media m where m.id=i and m.user_id=s.user_id and m.status='approved' and m.public_path is not null)) then raise exception 'invalid-photo';end if;
      target:=coalesce(p_merge_place_id,s.place_id,'community-'||s.id::text);
      if p_merge_place_id is not null and not exists(select 1 from public.deshpath_places where id=p_merge_place_id) then raise exception 'not-found';end if;
      if exists(select 1 from public.deshpath_places where id=target and submission_id is not null and submission_id<>s.id) and p_merge_place_id is null then raise exception 'conflict';end if;
      -- Merging updates the canonical ID; previous reviews still reference that ID.
      insert into public.deshpath_places(id,user_id,submission_id,payload,photo_ids) values(target,s.user_id,s.id,body,ids)
      on conflict(id) do update set payload=excluded.payload,photo_ids=excluded.photo_ids,status='published',updated_at=now() returning * into p;
      update public.deshpath_destination_submissions set status='approved',reason=coalesce(p_reason,''),place_id=target,payload=body,photo_ids=ids,published_revision=revision,updated_at=now() where id=s.id returning * into s;
    else
      update public.deshpath_destination_submissions set status=case p_decision when 'archive' then 'archived' when 'reject' then 'rejected' else p_decision end,reason=coalesce(p_reason,''),updated_at=now() where id=s.id returning * into s;
      if p_decision='archive' and s.place_id is not null then update public.deshpath_places set status='archived',updated_at=now() where id=s.place_id and submission_id=s.id and builtin=false;end if;
    end if;
    result:=jsonb_build_object('item',to_jsonb(s),'place',case when p_decision='approve' then to_jsonb(p) else null end);
  elsif p_kind='reviews' then
    select * into r from public.deshpath_review_submissions where id=p_id::uuid for update;
    if not found then raise exception 'not-found';end if;
    if r.revision<>p_revision then raise exception 'revision-conflict';end if;
    if p_decision not in('approve','reject','changes_requested','archive') then raise exception 'invalid-input';end if;
    owner_id:=r.user_id;body:=coalesce(p_payload,r.payload);ids:=coalesce(p_photo_ids,r.photo_ids);
    if p_decision='approve' then
      if r.status='approved' and r.published_revision=r.revision and body=r.payload and ids=r.photo_ids then return jsonb_build_object('item',to_jsonb(r));end if;
      if body is distinct from r.payload or ids is distinct from r.photo_ids then update public.deshpath_review_submissions set revision=revision+1 where id=r.id returning * into r;end if;
      perform 1 from public.deshpath_media where id=any(ids) order by id for update;
      if cardinality(ids)>3 or exists(select 1 from unnest(ids) i where not exists(select 1 from public.deshpath_media m where m.id=i and m.user_id=r.user_id and m.status='approved' and m.public_path is not null)) then raise exception 'invalid-photo';end if;
      if not exists(select 1 from public.deshpath_places where id=r.place_id and status='published') then raise exception 'not-found';end if;
      insert into public.deshpath_visit_reviews(user_id,place_id,source_id,payload,photo_ids) values(r.user_id,r.place_id,r.id,body,ids)
      on conflict(user_id,place_id) do update set payload=excluded.payload,photo_ids=excluded.photo_ids,status='published',updated_at=now() returning * into v;
      update public.deshpath_review_submissions set status='approved',reason=coalesce(p_reason,''),payload=body,photo_ids=ids,published_revision=revision,updated_at=now() where id=r.id returning * into r;
    else
      update public.deshpath_review_submissions set status=case p_decision when 'archive' then 'archived' when 'reject' then 'rejected' else p_decision end,reason=coalesce(p_reason,''),updated_at=now() where id=r.id returning * into r;
      if p_decision='archive' then update public.deshpath_visit_reviews set status='archived',updated_at=now() where source_id=r.id;end if;
    end if;
    result:=jsonb_build_object('item',to_jsonb(r));
  elsif p_kind='places' then
    if p_decision not in('archive','approve') then raise exception 'invalid-input';end if;
    if p_decision='archive' and exists(select 1 from public.deshpath_places where id=p_id and builtin=true) then raise exception 'builtin-protected';end if;
    select * into p from public.deshpath_places where id=p_id for update;
    if not found then raise exception 'not-found';end if;
    ids:=coalesce(p_photo_ids,p.photo_ids);body:=coalesce(p_payload,p.payload);
    perform 1 from public.deshpath_media where id=any(ids) order by id for update;
    if cardinality(ids)>3 or (not p.builtin and cardinality(ids)<1) or not ids<@p.photo_ids or exists(select 1 from unnest(ids) i where not exists(select 1 from public.deshpath_media m where m.id=i and m.status='approved' and m.public_path is not null)) then raise exception 'invalid-photo';end if;
    update public.deshpath_places set status=case when p_decision='approve' then 'published' else 'archived' end,payload=body,photo_ids=ids,updated_at=now() where id=p_id returning * into p;
    if not found then raise exception 'not-found';end if;owner_id:=p.user_id;result:=jsonb_build_object('item',to_jsonb(p));
  elsif p_kind='reports' then
    if p_decision not in('resolve','reject') then raise exception 'invalid-input';end if;
    update public.deshpath_reports set status=case when p_decision='resolve' then 'resolved' else 'rejected' end,resolution=coalesce(p_reason,''),updated_at=now() where id=p_id::uuid returning * into q;
    if not found then raise exception 'not-found';end if;owner_id:=q.user_id;result:=jsonb_build_object('item',to_jsonb(q));
  else raise exception 'invalid-input';end if;
  insert into public.deshpath_moderation_audit(actor_id,kind,item_id,decision,reason,detail) values(p_actor,p_kind,p_id,p_decision,coalesce(p_reason,''),jsonb_build_object('revision',case when p_kind='submissions' then s.revision when p_kind='reviews' then r.revision else p_revision end,'mergePlaceId',p_merge_place_id));
  if owner_id is not null then insert into public.deshpath_notifications(user_id,kind,message,entity_id) values(owner_id,p_kind,'Moderation: '||p_decision||case when coalesce(p_reason,'')<>'' then '. '||p_reason else '' end,p_id);end if;
  return result;
end $$;

-- Roll back a failed publication's private-to-public promotion only if no committed
-- publication references that media. Row lock and unique attempt paths prevent an
-- overlapping moderator from publishing a derivative scheduled for deletion.
create function public.deshpath_rollback_media(p_actor uuid,p_id uuid,p_path text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare m public.deshpath_media;
begin
  if not exists(select 1 from public.deshpath_admins where user_id=p_actor and active=true) then raise exception 'admin-required';end if;
  if p_path !~ ('^approved/'||p_id::text||'/[a-f0-9-]{36}\.jpg$') then raise exception 'invalid-input';end if;
  select * into m from public.deshpath_media where id=p_id for update;
  if not found or m.public_path is distinct from p_path then return true;end if;
  if exists(select 1 from public.deshpath_places where p_id=any(photo_ids)) or exists(select 1 from public.deshpath_visit_reviews where p_id=any(photo_ids)) then return false;end if;
  update public.deshpath_media set status='pending',public_path=null where id=p_id;
  return true;
end $$;

revoke all on function public.deshpath_take_rate(text,integer,integer),public.deshpath_save_proposal(uuid,text,uuid,text,jsonb,uuid[]),public.deshpath_moderate(uuid,text,text,text,text,jsonb,uuid[],text,integer),public.deshpath_rollback_media(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.deshpath_take_rate(text,integer,integer),public.deshpath_save_proposal(uuid,text,uuid,text,jsonb,uuid[]),public.deshpath_moderate(uuid,text,text,text,text,jsonb,uuid[],text,integer),public.deshpath_rollback_media(uuid,uuid,text) to service_role;
commit;
