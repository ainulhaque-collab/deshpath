# Deshpath Supabase connection

## Deployment record — 18 October 2026

The owner approved the existing **PestGurd — Development Test** project (`sfzitbasxrpmtmldujbm`, Singapore) for Deshpath. Three new `public.deshpath_` tables and one namespaced journal timestamp trigger were added. Existing application tables, data, roles, functions, email templates and Auth settings were not changed. No paid project or upgrade was created.

Applied remote migration: `20261018032314_deshpath_private_journal_moderated_text_v1`.
`setup.sql` is the exact additive initial schema. **Do not rerun it**: it deliberately fails on existing object names. Future changes require separate reviewed migrations.

The browser has only a modern publishable key. It has no service key, database password or management credential. The SDK is pinned to official Supabase JS 2.118.0, bundled locally with SRI and MIT licence.

**Current state:** database connected; approved public text/reviews can be read. Email sign-in, personal cloud save/load and online submissions are held behind `authReady: false`. The owner will sign in to the Supabase dashboard later. No sign-in email has been sent during implementation, and no successful real email login is claimed. Empty feeds display an honest empty state, without demonstration posts or ratings.

## Finish email sign-in

1. Sign in to the existing project [URL Configuration](https://supabase.com/dashboard/project/sfzitbasxrpmtmldujbm/auth/url-configuration).
2. Preserve its existing Site URL and redirect entries. Add the exact Deshpath return URL `https://deshpath.vercel.app/`. For local testing add only origins used: `http://127.0.0.1:4173/` and `http://localhost:4173/`. Do not add wildcard origins.
3. Review existing email delivery/provider, expiry, rate limits and templates. Email and signup were enabled at inspection; automatic email confirmation, Google and anonymous sign-ins were disabled. These settings were not changed. The shared template should use its normal confirmation URL/redirect rather than hardcoding another app's return address. Do not globally replace its template or Site URL for Deshpath.
4. Temporarily set `authReady: true` for a controlled local test after the local redirect is allowed. Request a sign-in email using an account you control. Open its link in the **same browser and device** that requested it. The adapter uses PKCE; a code verifier is stored locally. If the shared template includes an email code, its 6–10 digits can also be entered. A successful request is not proof of delivery.
5. Test expiry, retry, reload, sign-out and refresh; use two real accounts to check independent saves. Confirm the shared project's email service can deliver to intended visitors. Default delivery restrictions may limit public signup; configure a suitable sender through the project owner if needed.
6. Set `authReady: true` in the production configuration and push only after these checks pass. Test the exact production return URL. Until then the public interface deliberately shows setup pending and does not send email requests.

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

Security advisors reported no Deshpath-specific findings. Performance advisors only noted newly created, not-yet-used publication indexes, which are retained for feed queries. Existing unrelated project advisories were not changed; this was not an audit of the other application's private code. A read of that code was declined by automatic approval review as outside Deshpath scope and was not retried.

Unit tests cover PKCE callback exchange/cleanup, route restoration, auth setup gating, isolated public client, payload validation, SRI and grant/policy structure. These are not a substitute for the pending real email/session tests above.

## Adapter contract

`window.DESH_CLOUD.getStatus()` reports `enabled`, `authReady`, `mode` and `reason`. With `authReady:false`, `requestMagicLink()` and `requestOtp()` reject `auth-not-ready` before SDK/email activity. `completeAuthCallback()` handles an incoming PKCE code once, removes auth parameters immediately, exchanges the code and verifies the user on the Auth server. It preserves a safe local section route. It does not accept an implicit token URL.

Other methods: `getUser`, `refreshSession`, `signOut` (this device), `onAuthChange`, `saveJournal`, `loadJournal`, `submitContribution`, `submitReview`, `listApprovedContributions`, `listApprovedReviews` and `listMySubmissions`. Owner writes require a real verified session and explicit user action. Review submissions are one per user/place. Submission content is pending until the administrator approves it.

## Primary references checked

- [Supabase changelog](https://supabase.com/changelog.md) and [upcoming TLS cipher removal](https://supabase.com/changelog/cbc-tls-ciphers-deprecated)
- [Passwordless email and PKCE](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Server-verified user](https://supabase.com/docs/reference/javascript/auth-getuser)
- [Row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Data API grants](https://supabase.com/docs/guides/api/securing-your-api)
- [Official SDK package](https://registry.npmjs.org/@supabase/supabase-js/2.118.0)
