-- Final delta: structured published edits, changed approvals advance revision, remerge fails safely.
begin;
create or replace function public.deshpath_moderate(p_actor uuid,p_kind text,p_id text,p_decision text,p_reason text,p_payload jsonb,p_photo_ids uuid[],p_merge_place_id text,p_revision integer) returns jsonb
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

commit;
