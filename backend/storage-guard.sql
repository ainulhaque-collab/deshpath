-- Deshpath-only restrictive guard: unrelated app bucket policies are unchanged.
-- Service-role Edge operations and explicitly signed URLs continue to work.
create policy deshpath_edge_only_storage on storage.objects
as restrictive for all to anon,authenticated
using (bucket_id not in ('deshpath-private','deshpath-public'))
with check (bucket_id not in ('deshpath-private','deshpath-public'));
