-- App-specific visitor summary. Never exposes the shared Auth directory or journals.
create function public.deshpath_admin_visitors(p_actor uuid,p_limit integer default 50)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; total bigint;
begin
  if not exists(select 1 from public.deshpath_admins where user_id=p_actor and active) then raise exception 'admin-required';end if;
  if p_limit not between 1 and 50 then raise exception 'invalid-input';end if;
  select count(*) into total from public.deshpath_profiles;
  select coalesce(jsonb_agg(x.item order by x.created_at desc,x.id),'[]'::jsonb) into result from (
    select p.id,p.created_at,jsonb_build_object(
      'id',p.id,'displayName',p.display_name,'publicOptIn',p.public_opt_in,'analyticsOptIn',p.analytics_opt_in,'createdAt',p.created_at,
      'lastActiveAt',greatest(p.updated_at,
        (select max(g.updated_at) from public.deshpath_game_sessions g where g.user_id=p.user_id),
        (select max(s.updated_at) from public.deshpath_destination_submissions s where s.user_id=p.user_id),
        (select max(r.updated_at) from public.deshpath_review_submissions r where r.user_id=p.user_id)),
      'submissionCount',(select count(*) from public.deshpath_destination_submissions s where s.user_id=p.user_id),
      'reviewCount',(select count(*) from public.deshpath_review_submissions r where r.user_id=p.user_id),
      'resultCount',(select count(*) from public.deshpath_game_results g where g.user_id=p.user_id),
      'results',(select coalesce(jsonb_agg(jsonb_build_object('game',g.game,'difficulty',g.difficulty,'score',g.score,'durationMs',g.duration_ms,'finishedAt',g.finished_at) order by g.finished_at desc),'[]'::jsonb)
        from (select game,difficulty,score,duration_ms,finished_at from public.deshpath_game_results where user_id=p.user_id order by finished_at desc limit 5) g)
    ) item from public.deshpath_profiles p order by p.created_at desc,p.id limit p_limit
  ) x;
  return jsonb_build_object('profiles',result,'total',total,'limited',total>p_limit,'limit',p_limit);
end $$;
revoke all on function public.deshpath_admin_visitors(uuid,integer) from public,anon,authenticated;
grant execute on function public.deshpath_admin_visitors(uuid,integer) to service_role;
