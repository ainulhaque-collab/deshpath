# Deshpath Supabase connection

## Pages and owner account controls — 19 October 2026

`admin-visitors.sql` adds a service-only, SECURITY INVOKER summary function. Both the Edge handler and the function check current Deshpath membership. It returns at most 50 Deshpath profiles and each profile's most recent five game results; no shared Auth directory, journal, email, original photo paths or metadata is projected. The public browser cannot call this RPC directly.

`admin-auth.js` adds password sign-in and a human-operated password setting for the verified owner. The browser verifies the actual Auth user and server-side admin membership. Setting uses a nonpersisted SDK client bound to the verified owner's session to prevent an account switch redirecting a credential update. The owner must enter and submit their password personally. No password or Auth settings were changed automatically. This credential belongs to the same shared Supabase Auth account, so the form discloses that scope and requires explicit acknowledgement. Existing email-link sign-in remains available.

The page router retains the feature DOM and existing hash URLs; it never reads or writes Auth credentials, query codes or personal drafts. New router, admin authentication and visitor authorization regression tests run with the existing test runner. Real password creation/sign-in remains a human handoff; mock tests never create credentials or send email.

## Community release v2 — 18 October 2026

The moderated photo/destination/review system, owner administration, in-app notifications and server-scored online games are documented in [COMMUNITY.md](COMMUNITY.md) and [GAMES.md](GAMES.md). These additive changes preserve the v1 journal and text tables described below. Selected submission photographs now upload only after explicit consent; private journal/gallery photographs still do not upload automatically. The earlier deployment record below describes v1, not the current photo workflow.

## Deployment record — 18 October 2026

The owner approved the existing **PestGurd — Development Test** project (`sfzitbasxrpmtmldujbm`, Singapore) for Deshpath. Three new `public.deshpath_` tables and one namespaced journal timestamp trigger were added. Existing application tables, data, roles, functions, email templates and the existing Site URL were not changed. Three exact Deshpath callback URLs were appended to the redirect allowlist on 18 October 2026. No paid project or upgrade was created.

Applied remote migration: `20261018032314_deshpath_private_journal_moderated_text_v1`.
`setup.sql` is the exact additive initial schema. **Do not rerun it**: it deliberately fails on existing object names. Future changes require separate reviewed migrations.

The browser has only a modern publishable key. It has no service key, database password or management credential. The SDK is pinned to official Supabase JS 2.118.0, bundled locally with SRI and MIT licence.

**v1 state:** email-link sign-in, explicit private journal save/load and text-only submissions are enabled with `authReady: true`. Gmail SMTP was saved by the owner and real inbox delivery plus a PKCE callback were verified. The owner created and entered the dedicated App Password directly in the dashboards; it is absent from the repository and browser configuration. Empty public feeds show an honest empty state, without demonstration posts or ratings.

## Email delivery and operations

1. Saved exact callbacks: `https://deshpath.vercel.app/`, `http://127.0.0.1:4173/` and `http://localhost:4173/`. The existing application's Site URL and redirect entry remain intact. Do not add wildcard origins. A separate local QA origin is temporary and must be removed after testing.
2. The owner approved Gmail SMTP for an initial pilot without an owned domain: `smtp.gmail.com`, TLS port `465`, the owner's matching Gmail username/sender, and neutral sender name `Account Support`. SMTP is project-wide and also serves the other application's Auth emails. Existing email templates, verification requirements and provider settings were preserved; Google OAuth is not enabled by using Gmail as a sender.
3. Gmail is a limited pilot sender, subject to daily, per-recipient and abuse limits shared with normal mailbox use. Supabase also enforces its own project/IP/email limits. Keep conservative limits and monitor delivery; move to a verified domain and transactional provider before a broad launch. This setup is not a promise of unlimited or guaranteed delivery.
4. Request a link from the exact origin you will use and open it in the **same browser and device**. `localhost` and `127.0.0.1` are different origins. The adapter uses PKCE, removes callback parameters immediately and verifies the user on the Auth server. The existing template sends a link; the optional code form only applies when a template includes a code. A successful request alone is not proof of delivery.
5. Recheck inbox delivery, callback, session persistence, save/load confirmation and sign-out after changing the sender, templates, Auth configuration or deployment origin. Use separately controlled accounts for further delivery-provider testing; never upload genuine local journals merely to test the connection. Set `authReady: false` to stop new email requests during a delivery outage while retaining local journals and approved public reads.

The shared project's Auth identity pool and delivery limits are shared with its other application. Deshpath uses a separate browser session storage key and namespaced app tables. Do not delete a shared Auth user as an app-only account deletion action.

## Data access

- `deshpath_journals`: one text/selection snapshot per verified user; owner-only SELECT/INSERT/UPDATE, including UPDATE USING and WITH CHECK. Save/load are explicit actions. Loading requires review before local replacement. Saving replaces the previous snapshot; no multi-device conflict merging is claimed.
- `deshpath_contributions` and `deshpath_reviews`: authenticated authors can insert only allowed text columns, with their own ID. Status defaults to pending. They can read only their own rows, including pending/rejected status. There are no browser UPDATE/DELETE/moderation grants.
- Public feeds use an isolated nonpersisted client, with no signed-in token. The `anon` role has only projected content-column SELECT grants and approved-only policies. It cannot read journals, pending/rejected records, author UUIDs or email addresses. The signed-in client's table reads remain owner-only even for approved records.
- Anonymous Auth accounts are excluded from private/write policies. No editable user metadata controls authorization. The timestamp trigger is SECURITY INVOKER with a fixed empty search path.
- Photos remain in the browser's IndexedDB and backup files. No Storage bucket or cloud photo upload was created. Manual journal saves omit portraits and photo assignments; explicit public review submission sends text/rating only.
- Local-data removal signs out this device and erases local app data; it does not erase remote records or the shared Supabase account.

## Moderation and removal

Review new submissions through the owner's trusted [table dashboard](https://supabase.com/dashboard/project/sfzitbasxrpmtmldujbm/editor). A checked contribution/review may be approved by setting `status='approved'` and `published_at=now()` together. Rejection uses `status='rejected'` and `published_at=null`. This is an administrator operation, never a browser role or user-editable flag.

The public application has no admin screen. Before opening submissions broadly, establish an owner-operated correction/removal channel, retention procedure and abuse/rate-limit controls. Deshpath-specific deletion must be scoped to `deshpath_` rows, preserving any other application's account/data. Google OAuth, public cloud photos, automatic notifications, shared journal links and a trusted global leaderboard remain separate work.

## Verification completed

Live PostgreSQL assertions exercised the actual `authenticated` and `anon` roles with two isolated synthetic identities inside a rollback-only transaction. They verified owner save/load/update/upsert; blocked cross-owner reads, updates, reassignment and forged author inserts; pending-only community inserts; inability to self-approve/update/delete; exclusion of anonymous Auth accounts; approved-only public content and hidden UUID/journals. All assertions passed. No credentials/email identities were created; post-rollback assertions confirmed no test user or fixture remained.

Real HTTP Data API checks with the publishable key returned HTTP 200 and empty arrays for approved stories/reviews, and HTTP 401 / PostgreSQL 42501 for private journals and author UUID reads. No posts were fabricated for production.

Security advisors reported no Deshpath-specific findings. Performance advisors only noted newly created, not-yet-used publication indexes, which are retained for feed queries. Existing unrelated project advisories were not changed; this was not an audit of the other application's private code.

On 18 October 2026, a controlled browser test received the real email in the owner's inbox and completed the PKCE callback. Reload retained the verified session. An explicitly saved QA journal was read back and restored only after confirmation; a local change remained intact until that confirmation. A scoped SQL check confirmed photo-assignment/avatar/group fields and embedded images were absent from the saved snapshot. Sign-out restored the email form and left the local journal intact. With the owner's explicit approval, only the marked QA cloud snapshot was deleted afterwards; the shared Auth identity was retained. The temporary local QA redirect was removed. No public story or rating was fabricated for this test. This is one real email identity plus two synthetic rollback-only RLS identities, not a claim that two real inboxes were tested.

Unit tests cover PKCE exchange/cleanup, route restoration, setup gating, isolated public reads, payload validation, SRI, grant/policy structure, fixed bilingual rate/SMTP errors, empty-cloud guidance, photo-field omission, restore confirmation and error visibility after an Auth rerender. The real pinned SDK was also exercised with mocked HTTP for repeated user/journal reads; no speculative auth-lock workaround was introduced.

## Adapter contract

`window.DESH_CLOUD.getStatus()` reports `enabled`, `authReady`, `mode` and `reason`. With `authReady:false`, `requestMagicLink()` and `requestOtp()` reject `auth-not-ready` before SDK/email activity. `completeAuthCallback()` handles an incoming PKCE code once, removes auth parameters immediately, exchanges the code and verifies the user on the Auth server. It preserves a safe local section route. It does not accept an implicit token URL.

Other methods: `getUser`, `refreshSession`, `signOut` (this device), `onAuthChange`, `saveJournal`, `loadJournal`, `submitContribution`, `submitReview`, `listApprovedContributions`, `listApprovedReviews` and `listMySubmissions`. Owner writes require a real verified session and explicit user action. Review submissions are one per user/place. Submission content is pending until the administrator approves it.

## Primary references checked

- [Supabase changelog](https://supabase.com/changelog.md) and [upcoming TLS cipher removal](https://supabase.com/changelog/cbc-tls-ciphers-deprecated)
- [Passwordless email and PKCE](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Server-verified user](https://supabase.com/docs/reference/javascript/auth-getuser)
- [Google SMTP with Supabase](https://supabase.com/docs/guides/troubleshooting/using-google-smtp-with-supabase-custom-smtp-ZZzU4Y)
- [Google App Passwords](https://support.google.com/accounts/answer/185833) and [Gmail sending limits](https://support.google.com/mail/answer/22839?hl=en)
- [Row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Data API grants](https://supabase.com/docs/guides/api/securing-your-api)
- [Official SDK package](https://registry.npmjs.org/@supabase/supabase-js/2.118.0)

## Community release backend

The new API is `deshpath-community`. Apply `community.sql`, then `games.sql` and the original-catalog seed. Existing deployments apply the final `community-moderation-update.sql` with a new migration name. The three v1 tables remain unchanged. New tables have RLS and no browser grants. Moderation RPCs execute only as `service_role`, check active Deshpath admin membership, and atomically update publications, proposal status, notifications and audit history.

Deploy `functions/deshpath-community/index.ts` with `verify_jwt=false`. Public and private actions intentionally share one endpoint; each private request calls `auth.getUser(userJWT)` and requires a confirmed, non-anonymous email identity. The publishable key belongs in `apikey`, never in the Bearer header. Server credentials come only from platform secret environment variables. Do not add service keys to client configuration, screenshots or Git.

Runtime sources are `index.ts`, `context.mjs`, `validation.mjs`, `community.mjs`, `dashboard.mjs`, `media.mjs`, `games.mjs` and `games-data.mjs`; retain `deno.json` and `deno.lock`. npm imports pin Supabase JS 2.118.0, jpeg-js 0.4.4 and exifr 7.1.3. `dependencies.json` records official npm integrity metadata. Exact permitted origins can be set with `DESHPATH_ALLOWED_ORIGINS`; defaults are the production URL and localhost/127.0.0.1 ports 4173/4174.

An authorized owner runs `admin.setup` to create only `deshpath-private` and `deshpath-public` using the Storage API. Originals and prepared previews remain private. Approval copies only the re-encoded derivative to `deshpath-public/approved/{mediaId}/{attemptId}.jpg`. Failed publication uses the service-only rollback RPC; an asset referenced by any committed publication is retained. Prepared previews expire after 10 minutes. Only admin queue/moderation responses include an additional 10 minute `originalUrl`; visitor profile/upload results and public feeds never include original links or private metadata.

Originals are limited to 5 MiB, JPEG/PNG/WebP signatures and 24 MP. Prepared JPEGs are limited to 700 KiB, 1600 pixels per edge and 1.6 MP. The server strictly decodes and re-encodes their pixels under a 64 MiB decoder allocation budget. EXIF/GPS is extracted from original bytes into private review signals and is absent from published JPEGs. A client can supply an unrelated prepared image: moderators must compare the private original with the prepared image before approval. Dates/GPS are editable signals, not proof of travel or ownership.

`admin.moderate` requires the queue item's `revision` for submissions/reviews. A stale revision fails without publication. Identical approvals are no-ops; edited approval advances `revision` and `published_revision`. A new pending duplicate can merge into an existing canonical destination. Moving an already published destination to a different canonical ID fails with `conflict`; historical review transfer is not implemented. Archiving a merged proposal cannot archive another canonical owner or a built-in destination. Built-in archive fails explicitly because the static 16-place fallback retains those IDs.

The endpoint returns `{error:{code}}` with fixed codes, never raw provider messages:

| Codes | Meaning |
| --- | --- |
| `sign-in-required`, `admin-required` | A verified visitor/admin identity is required. |
| `invalid-input`, `invalid-image`, `invalid-photo`, `consent-required`, `reason-required` | Correct the bounded form, image or explicit consent. |
| `not-found`, `unknown-action`, `method-not-allowed`, `origin-not-allowed` | Missing resource or unsupported request. |
| `conflict`, `revision-conflict`, `builtin-protected` | Refresh the queue or use the supported canonical workflow. |
| `request-too-large`, `rate-limited` | Request/body or server-side rate limit. Guest analytics has a per-session limit and a shared 600/minute ceiling; no IP/location is stored. |
| `service-unavailable`, `storage-configuration` | Backend/provider setup or temporary request failure. |
| `invalid-game`, `invalid-answer`, `game-not-found`, `game-closed`, `game-conflict`, `game-rate-limited`, `daily-attempt-used`, `game-service-unavailable`, `analytics-unavailable` | Fixed online game/analytics errors. |

Admin game/request totals are exact 24 hour counts. Recent named online-game activity uses a 2 minute window and bounded rows; necessary account/game records are distinct from optional consenting practice/export analytics. Guest numbers estimate browser sessions. Export breakdowns use the latest1,000 consenting events; photo-byte summaries sample at most5,000 originals. Download/print request counters do not prove successful file saves.

Local verification: `node tests/backend-community.test.cjs` passes authorization, public privacy projections, ownership, request bounds, revisions and safe media rollback tests. From the function folder, `deno check index.ts` passes and `deno test media.test.ts` passes 2 real-codec tests, including GPS extraction/removal and rejection of a truncated JPEG. `community-moderation-qa.sql` is a rollback-only administrative regression script for edited approvals, idempotence, stale revisions, canonical protection and review revisions; it does not perform Storage or Auth mutations. Remote moderation/upload end-to-end checks must be recorded separately after deployment; local mocks are not evidence of that completion.
