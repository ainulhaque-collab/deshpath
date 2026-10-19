-- Administrative QA only. Every fixture and publication is rolled back.
-- No Storage/Auth mutations. Run after the final moderation delta.
begin;
set local role service_role;
do $$
declare actor uuid; photo uuid:=gen_random_uuid(); source uuid; review_source uuid; second uuid;
  canonical text:='qa-'||gen_random_uuid()::text; result jsonb; before_count bigint; body jsonb;
  test_kind text; decision text; expected_status text; state_source uuid; state_body jsonb;
  state_photos uuid[]; state_place text; state_revision integer; persisted_status text;
  publication_status text; published_snapshot jsonb; persisted_snapshot jsonb;
begin
  select user_id into actor from public.deshpath_admins where active and role='owner' limit 1;
  if actor is null then raise exception 'Owner setup required for QA';end if;
  insert into public.deshpath_media(id,user_id,sha256,original_path,prepared_path,public_path,mime,bytes,width,height,status)
  values(photo,actor,md5(photo::text)||md5(photo::text),'qa-original/'||photo,'qa-prepared/'||photo,'approved/'||photo||'/'||gen_random_uuid()::text||'.jpg','image/jpeg',10,1,1,'approved');
  body:=jsonb_build_object('name','QA isolated destination','district','dhaka','area','QA area','category','nature','description','An isolated test description that is always rolled back.','howTo','An isolated test route that is always rolled back.');
  result:=public.deshpath_save_proposal(actor,'submissions',null,null,body,array[photo]);source:=(result->>'id')::uuid;
  result:=public.deshpath_moderate(actor,'submissions',source::text,'approve','',body,array[photo],null,1);
  if (result->'item'->>'revision')::int<>1 then raise exception 'Initial approval revision failed';end if;
  select count(*) into before_count from public.deshpath_moderation_audit where item_id=source::text;
  perform public.deshpath_moderate(actor,'submissions',source::text,'approve','',body,array[photo],null,1);
  if (select count(*) from public.deshpath_moderation_audit where item_id=source::text)<>before_count then raise exception 'Idempotent approval wrote audit twice';end if;
  body:=jsonb_set(body,'{name}','"QA revised approved destination"');
  result:=public.deshpath_moderate(actor,'submissions',source::text,'approve','Editor correction',body,array[photo],null,1);
  if (result->'item'->>'revision')::int<>2 or (result->'item'->>'published_revision')::int<>2 or result->'place'->'payload'->>'name'<>'QA revised approved destination' then raise exception 'Edited approval did not publish revision2';end if;
  begin
    perform public.deshpath_moderate(actor,'submissions',source::text,'approve','',body,array[photo],null,1);
    raise exception 'Expected stale revision rejection';
  exception when others then if sqlerrm<>'revision-conflict' then raise;end if;end;
  insert into public.deshpath_places(id,payload,builtin) values(canonical,body,true);
  begin
    perform public.deshpath_moderate(actor,'submissions',source::text,'approve','',body,array[photo],canonical,2);
    raise exception 'Expected safe remerge conflict';
  exception when others then if sqlerrm<>'conflict' then raise;end if;end;
  body:=jsonb_set(body,'{name}','"QA new duplicate proposal"');
  result:=public.deshpath_save_proposal(actor,'submissions',null,null,body,array[photo]);second:=(result->>'id')::uuid;
  result:=public.deshpath_moderate(actor,'submissions',second::text,'approve','Merge duplicate',body,array[photo],canonical,1);
  if result->'item'->>'place_id'<>canonical then raise exception 'New duplicate merge failed';end if;
  perform public.deshpath_moderate(actor,'submissions',second::text,'archive','Withdraw merged proposal',null,null,null,1);
  if (select status from public.deshpath_places where id=canonical)<>'published' then raise exception 'Merged proposal archive changed canonical';end if;
  begin
    perform public.deshpath_moderate(actor,'places',canonical,'archive','Built-in archive denied',null,null,null,null);
    raise exception 'Expected built-in protection';
  exception when others then if sqlerrm<>'builtin-protected' then raise;end if;end;
  body:=jsonb_set(body,'{name}','"QA canonical structured edit"');
  result:=public.deshpath_moderate(actor,'places',canonical,'approve','',body,array[photo],null,null);
  if result->'item'->'payload'->>'name'<>'QA canonical structured edit' then raise exception 'Published-place edit ignored';end if;
  body:=jsonb_build_object('rating',5,'body','An isolated review that is always rolled back.','visitDate','2026-10-17','origin','Dhaka','transport','Bus','totalCost',1000,'people',1);
  result:=public.deshpath_save_proposal(actor,'reviews',null,'community-'||source::text,body,'{}');review_source:=(result->>'id')::uuid;
  perform public.deshpath_moderate(actor,'reviews',review_source::text,'approve','',body,'{}',null,1);
  body:=jsonb_set(body,'{rating}','4');
  result:=public.deshpath_moderate(actor,'reviews',review_source::text,'approve','Rating correction',body,'{}',null,1);
  if (result->'item'->>'revision')::int<>2 or (result->'item'->>'published_revision')::int<>2 or (select payload->>'rating' from public.deshpath_visit_reviews where source_id=review_source)<>'4' then raise exception 'Edited review approval failed';end if;

  -- Exercise every decision against both table CHECK constraints. Start from a
  -- published snapshot, then verify rejected/changes-requested revisions leave it
  -- intact. Archive is exercised on an approved current revision and must unpublish.
  foreach test_kind in array array['submissions','reviews'] loop
    if test_kind='submissions' then
      state_body:=jsonb_build_object('name','QA decision matrix destination','district','dhaka','area','QA area','category','nature','description','An isolated status regression destination, always rolled back.','howTo','An isolated route for status regression, always rolled back.');
      state_photos:=array[photo];state_place:=null;
    else
      state_body:=jsonb_build_object('rating',5,'body','An isolated status regression review, always rolled back.','visitDate','2026-10-17','origin','Dhaka','transport','Bus','totalCost',1000,'people',1);
      state_photos:='{}'::uuid[];state_place:=canonical;
    end if;
    result:=public.deshpath_save_proposal(actor,test_kind,null,state_place,state_body,state_photos);
    state_source:=(result->>'id')::uuid;state_revision:=(result->>'revision')::integer;
    result:=public.deshpath_moderate(actor,test_kind,state_source::text,'approve','Initial matrix publication',state_body,state_photos,null,state_revision);
    published_snapshot:=result->'item'->'payload';
    if test_kind='submissions' then state_place:=result->'item'->>'place_id';end if;
    foreach decision in array array['reject','changes_requested','archive'] loop
      if test_kind='submissions' then state_body:=jsonb_set(state_body,'{name}',to_jsonb('QA destination revision for '||decision));
      else state_body:=jsonb_set(state_body,'{body}',to_jsonb('An isolated review revision for '||decision||', always rolled back.'));end if;
      result:=public.deshpath_save_proposal(actor,test_kind,state_source,case when test_kind='reviews' then state_place else null end,state_body,state_photos);
      state_revision:=(result->>'revision')::integer;
      if decision='archive' then
        result:=public.deshpath_moderate(actor,test_kind,state_source::text,'approve','Publish before archive test',state_body,state_photos,null,state_revision);
        state_revision:=(result->'item'->>'revision')::integer;
        published_snapshot:=result->'item'->'payload';
      end if;
      result:=public.deshpath_moderate(actor,test_kind,state_source::text,decision,'QA status regression check',null,null,null,state_revision);
      expected_status:=case decision when 'reject' then 'rejected' when 'archive' then 'archived' else 'changes_requested' end;
      if test_kind='submissions' then
        select status into persisted_status from public.deshpath_destination_submissions where id=state_source;
        select status,payload into publication_status,persisted_snapshot from public.deshpath_places where id=state_place;
      else
        select status into persisted_status from public.deshpath_review_submissions where id=state_source;
        select status,payload into publication_status,persisted_snapshot from public.deshpath_visit_reviews where source_id=state_source;
      end if;
      if (result->'item'->>'status') is distinct from expected_status or persisted_status is distinct from expected_status then
        raise exception 'Decision/status mismatch for % / %: returned %, persisted %',test_kind,decision,result->'item'->>'status',persisted_status;
      end if;
      if decision='archive' then
        if publication_status is distinct from 'archived' then raise exception 'Archive failed to unpublish %',test_kind;end if;
      elsif publication_status is distinct from 'published' or persisted_snapshot is distinct from published_snapshot then
        raise exception 'Unapproved % revision changed published % snapshot',decision,test_kind;
      end if;
    end loop;
  end loop;
end $$;
rollback;
