-- Transaction-only verification. All fixture records are rolled back, never published.
begin;
do $$
declare owner_id uuid; stranger uuid:=gen_random_uuid(); media_id uuid:=gen_random_uuid(); proposal jsonb; revised jsonb;
  published jsonb; game_id uuid:=gen_random_uuid(); row_data jsonb; rejected boolean; t record;
begin
  select a.user_id into owner_id from public.deshpath_admins a join auth.users u on u.id=a.user_id
  where a.active and a.role='owner' and lower(u.email)='ainulshalkhuria@gmail.com';
  assert owner_id is not null,'confirmed owner missing';
  for t in select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relname like 'deshpath_%'
      and c.relname not in ('deshpath_journals','deshpath_contributions','deshpath_reviews') loop
    assert t.relrowsecurity,'RLS missing';
    assert not has_table_privilege('anon','public.'||t.relname,'SELECT,INSERT,UPDATE,DELETE'),'anonymous table access';
    assert not has_table_privilege('authenticated','public.'||t.relname,'SELECT,INSERT,UPDATE,DELETE'),'browser table access';
  end loop;
  assert not has_function_privilege('authenticated','public.deshpath_moderate(uuid,text,text,text,text,jsonb,uuid[],text,integer)','EXECUTE'),'browser moderation permission';
  assert not has_function_privilege('anon','public.deshpath_public_leaderboard(text,text,text)','EXECUTE'),'anonymous privileged RPC permission';
  insert into public.deshpath_media(id,user_id,sha256,original_path,prepared_path,mime,bytes,width,height,status,public_path)
    values(media_id,owner_id,repeat('b',64),'verify-only/'||media_id,'verify-prepared/'||media_id,'image/jpeg',100,10,10,'approved','approved/'||media_id||'/verify.jpg');
  proposal:=public.deshpath_save_proposal(owner_id,'submissions',null,null,
    '{"name":"Transaction verification only","district":"dhaka","area":"QA","category":"nature","description":"This transaction is rolled back and this fixture never becomes publicly visible.","howTo":"Transaction only test route"}'::jsonb,array[media_id]);
  assert proposal->>'status'='pending','proposal self approved';
  rejected:=false;
  begin perform public.deshpath_moderate(stranger,'submissions',proposal->>'id','approve','',null,null,null,1);
  exception when others then rejected:=sqlerrm='admin-required'; end;
  assert rejected,'nonadmin moderation not rejected';
  published:=public.deshpath_moderate(owner_id,'submissions',proposal->>'id','approve','',null,null,null,1);
  assert published->'place'->>'status'='published','approval missing canonical place';
  perform public.deshpath_moderate(owner_id,'submissions',proposal->>'id','approve','',null,null,null,1);
  assert (select count(*) from public.deshpath_moderation_audit where item_id=proposal->>'id')=1,'approval retry not idempotent';
  revised:=public.deshpath_save_proposal(owner_id,'submissions',(proposal->>'id')::uuid,null,
    (proposal->'payload')||'{"name":"Revised verification only"}'::jsonb,array[media_id]);
  assert revised->>'status'='pending' and (revised->>'revision')::int=2,'revision missing';
  assert (select payload->>'name' from public.deshpath_places where id=published->'place'->>'id')='Transaction verification only','pending edit replaced public snapshot';
  rejected:=false;
  begin perform public.deshpath_moderate(owner_id,'submissions',proposal->>'id','approve','',null,null,null,1);
  exception when others then rejected:=sqlerrm='revision-conflict';end;
  assert rejected,'stale moderation revision accepted';
  perform public.deshpath_moderate(owner_id,'submissions',proposal->>'id','approve','',null,null,null,2);
  row_data:=public.deshpath_moderate(owner_id,'submissions',proposal->>'id','approve','',
    (revised->'payload')||'{"name":"Edited approved verification only"}'::jsonb,array[media_id],null,2);
  assert (row_data->'item'->>'revision')::int=3,'edited approval did not advance revision';
  assert (select payload->>'name' from public.deshpath_places where id=published->'place'->>'id')='Edited approved verification only','edited approval not published';
  row_data:=public.deshpath_moderate(owner_id,'places','sajek','approve','',
    (select payload from public.deshpath_places where id='sajek')||'{"name":"Rolled back editorial change"}'::jsonb,'{}',null,null);
  assert row_data->'item'->'payload'->>'name'='Rolled back editorial change','published editor changes ignored';
  rejected:=false;
  begin perform public.deshpath_save_proposal(stranger,'submissions',null,null,'{}'::jsonb,array[media_id]);
  exception when others then rejected:=sqlerrm='invalid-photo';end;
  assert rejected,'cross-owner photo accepted';
  rejected:=false;
  begin perform public.deshpath_moderate(owner_id,'places','sajek','archive','Verification only',null,null,null,null);
  exception when others then rejected:=sqlerrm='builtin-protected';end;
  assert rejected,'original destination can be archived';
  insert into public.deshpath_game_sessions(id,user_id,game,difficulty,challenge_day,state,expires_at)
    values(game_id,owner_id,'knowledge','standard',current_date-10000,'{"revision":0}',now()+interval '1 hour');
  rejected:=false;
  begin perform public.deshpath_commit_game_answer(game_id,stranger,0,'{"revision":1}','completed',5,2000);
  exception when others then rejected:=sqlerrm='game-not-found';end;
  assert rejected,'cross-owner game accepted';
  row_data:=public.deshpath_commit_game_answer(game_id,owner_id,0,'{"revision":1}','completed',5,2000);
  assert row_data->>'status'='completed','game result not committed';
  assert (select count(*) from public.deshpath_game_results where session_id=game_id)=1,'game result missing';
  rejected:=false;
  begin perform public.deshpath_commit_game_answer(game_id,owner_id,0,'{"revision":1}','completed',5,2000);
  exception when others then rejected:=sqlerrm='game-closed';end;
  assert rejected,'completed game written twice';
end $$;
select 'PASS: RLS, private grants, admin-only approval, photo ownership, revision isolation, idempotency, original catalog and atomic owned game results; fixtures rolled back' as verification;
rollback;
