# Deshpath community release contract

Approved scope: moderated destinations and rich visitor reviews with photos; owner admin panel and audit history; notifications/reports; consent-based usage metrics; server-scored online games and opted-in public rankings. Preserve existing local journals, images, backups and the original 16 destination IDs.

## Transport

`DESH_CLOUD.community(action, payload={})` calls the namespaced `deshpath-community` Edge Function. Success returns its JSON object directly. Errors carry a fixed `code`; never display raw provider details. `DESH_CLOUD.uploadCommunityPhoto(file, {caption, consent:true})` sends multipart `action=media.upload`, original file, and a client-prepared JPEG thumbnail (server decodes/re-encodes it). Max original 5MB, prepared 700KB, max 3 photos per submission/review initially. Upload result `{photo:{id,url,caption,metadata,status}}`; URL is a short-lived private preview. Metadata is a review signal, not proof of travel. Public derivatives exclude GPS/EXIF.

The Edge Function must verify the supplied user JWT on every private action and look up Deshpath admin membership in a server-controlled table on every admin action. No shared Auth hooks, user_metadata authorization, browser service keys, or other app data. Public actions have explicit safe projections. All new tables have RLS and no direct browser write grants. Storage creation/operations use the Storage API with only Deshpath bucket names.

## Public actions

- `catalog.list` -> `{places:[place]}`. `place` matches `DESH_DATA.places` and adds `{community:true,en:{name,description,season,duration,categoryLabel},howTo,stay,cost,notes,lat,lng,photos:[{url,caption}],credit,updatedAt}`. Fields: `id,district,name,category,categoryLabel,description,image,season,duration`; category is nature/adventure/beach/heritage. Built-in rows retain their existing IDs and can be merged with source fallbacks.
- `reviews.list {placeId}` -> `{reviews:[{id,placeId,rating,body,visitDate,origin,transport,totalCost,people,displayName,profileId,photos:[{url,caption}],publishedAt}],average,total}`. Only approved publications. No email, private original URL, raw metadata or Auth user UUID.
- `leaderboard.list {game,difficulty,period}` -> `{rows:[{rank,profileId,displayName,score,durationMs,finishedAt}],game,difficulty,period}`; period week/all; only opted-in public profiles and validated online results.
- `profile.public {id}` -> `{profile:{id,displayName},reviews,results}` only for opted-in profiles.
- `analytics.record {id,sessionId,event,game?,exportType?,format?,consent:true}` -> `{accepted:true}`. Allowlisted metadata only, server timestamp, deduplicate IDs, bounded rate. Event names game_started/game_completed/game_activity/export_prepared/download_requested/print_requested. Guest sessions are estimates; do not collect selected districts, map names, photos, exact location or arbitrary payloads.

## Signed-in visitor actions

- `profile.me` -> `{profile:{id,displayName,publicOptIn,analyticsOptIn},submissions:[],reviews:[],notifications:[],results:[]}`. Submission/review status records include id,status,reason,title/placeId,createdAt,payload,photo previews where appropriate.
- `profile.save {displayName,publicOptIn,analyticsOptIn}` -> `{profile}`. This public identity is separate from private local profile/bio. Public opt-in defaults false.
- `submission.save {id?,name,enName?,district,area,category,description,enDescription?,howTo,stay?,season?,duration?,lat?,lng?,cost?,notes?,photoIds:[],consent:true}` -> `{submission}`. New pending proposal or own changes-requested revision. Approved place remains published until a new revision is approved.
- `review.save {id?,placeId,rating,body,visitDate,origin,transport,totalCost,people,photoIds:[],consent:true}` -> `{review}`. One published review per user/place; a later proposal is reviewed before replacing it.
- `report.create {placeId?,reviewId?,reason}` -> `{report}`.
- `withdraw.request {kind,id,reason}` -> `{report}`; author request, admin reviews before unpublishing.
- `notifications.read {ids:[]}` -> `{updated:true}`.
- `game.start {game,difficulty?}` -> `{session:{id,game,difficulty,round,total,challenge,startedAt,expiresAt}}`.
- `game.answer {sessionId,answer}` -> `{session,feedback:{correct,points,explanation?},result?}`. Never accept user_id, computed score, elapsed time or completion from the client. Session owns secret answers. Unique attempt completion, replay protection, server timing and limits. Daily challenges use the same rules/questions per game/difficulty/day. Personality stays outside competitive ranking.
- `game.cancel {sessionId}` -> `{cancelled:true}`.

## Admin actions

- `admin.status` -> `{isAdmin:boolean,role?}` (requires login; false is normal).
- `admin.setup` -> `{ready:true}` creates missing namespaced private-original and public-approved buckets using the Storage API; membership required.
- `admin.dashboard` -> `{stats,activity:[],games:[],exports:[],submissions:[],reviews:[],reports:[],audit:[],profiles:[],storage}`. Bounded lists; only Deshpath data. Activity has an explicit recent time window. Export counts mean generation/requests, not proof of a disk save.
- `admin.queue {kind,status?}` -> `{items:[]}`. kind submissions/reviews/reports/places/audit; items include safe private photo previews and parsed metadata for review when relevant.
- `admin.moderate {kind,id,decision,reason?,payload?,mergePlaceId?}` -> `{item,place?}`. decision approve/reject/changes_requested/archive/resolve. Admin may edit structured fields before approval, publish English text, choose cover photo and merge duplicates. Approval is idempotent and transactional for DB publication. Unapproved originals and metadata never become public.

## Backend-owned tables

Use only `deshpath_` names. Expected logical entities: admins; profiles (separate public ID); destination submissions; published places; review submissions; published visit reviews; media; reports; notifications; moderation audit; analytics events/rate limits; game sessions and validated results. Existing three v1 tables remain compatible. Seed the original16 catalog IDs before accepting new-place reviews. Initial owner membership is granted only to the exact human-approved email via an administrative operation; no self-enrolment.

## Parallel ownership

- Root: cloud.js adapter extensions, catalog/app/index integration, remote deployment, seed generation, security and end-to-end verification.
- Community UI agent: community-profile.js integration plus community-online.js/admin.js/community-online.css and UI tests. Keep v1 private profile/backup intact. Use `DESH_CLOUD.community`; public reads use `{public:true}` third transport option if supplied. Root provides `publicCommunity` alias for public actions.
- Games agent: ranked-games.js/ranked-games.css, games.js and map-ui.js/world-passport.js analytics hooks, backend games.mjs, game tests. `DESH_RANKED.renderProfile(mount)` renders a separate online-results panel; community UI calls it after local profile renders. `DESH_ACTIVITY.record(event,metadata)` is consent-gated.
- Backend agent: backend/community.sql; backend/functions/deshpath-community/index.ts and validation modules/tests. Import game handler from `games.mjs` (owned by games agent); agree its context contract directly. No remote mutations by agents.

Root integrates new modules and service-worker asset updates. No fake public posts, ratings, users, analytics or rankings. Test fixtures must be isolated and safely removed/rolled back with authorization.
