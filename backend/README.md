# Deshpath optional cloud backend

**Status: prepared, disabled, not deployed or verified end to end.** Deshpath currently runs in local browser mode. The selected Supabase organisation already uses its free project allowance, so a dedicated project could not be created. No existing project was paused, repurposed or changed, and no paid upgrade was made.

The files here prepare a future integration. They do not make login, cloud synchronisation, public community submissions, photo uploads or moderation operational by themselves. `setup.sql` has **not** been executed against a live database and is an initial setup script, not an applied migration.

## What is prepared

- Email code authentication through the official Supabase JavaScript SDK; server-verified `getUser()`, automatic foreground token refresh, explicit refresh and local-device sign-out.
- One private journal snapshot per user, protected by owner row-level security. Save and load are separate, explicit user actions. A save replaces the user's previous cloud snapshot; it does not merge devices or resolve concurrent edits.
- Text-only district stories and destination reviews, inserted as `pending`. Public queries return only `approved` records. A signed-in owner can also read their own pending or rejected records.
- No frontend moderation privileges, no user-controlled metadata roles, no service key in browser code, and no public leaderboard based on self-reported game scores.
- Browser data remains separate. Signing in does not upload it, and loading a cloud snapshot must be reviewed before the interface replaces local choices.

## Activation, when a dedicated project is available

1. Create a dedicated Deshpath project only after the owner has selected an available free slot or explicitly approved any additional cost. Do not reuse another application's database.
2. Review `setup.sql`, then run it once against that new project. It deliberately fails if these object names already exist. Keep the deployment record and generate real migration history during subsequent database work; do not label this unapplied script as a migration.
3. Enable the Data API for the `public` schema. The script explicitly grants table/column privileges and enables RLS on all three tables, independent of a project's default grants.
4. In Auth settings, use email authentication with anonymous sign-ins disabled. Configure the production Site URL and allowed development origins. The adapter uses an entered code rather than URL-based session detection.
5. Configure the Magic Link email template to contain `{{ .Token }}` so the user actually receives a six-digit OTP. A successful `signInWithOtp()` request alone does not prove email delivery. Configure and test the project's email provider, sender, expiry, Auth rate limits and abuse protection; default email limits may not suit a public launch.
6. Put **only** the project URL and modern **publishable** key in `cloud-config.js`, then set `enabled: true`. Never put a `service_role`, secret key, database password or management token in any frontend file.
7. Test with two distinct email accounts and a signed-out browser before declaring cloud features live. See the verification matrix below.

Load `cloud-config.js` before `cloud.js`. The SDK is lazy-loaded from `assets/vendor/supabase-js-2.118.0.js` only when enabled cloud functionality is used. No npm build step or third-party CDN is required at runtime. The pinned bundle, package hash and source are recorded in the adjacent metadata JSON; its MIT licence is also included.

## Browser adapter contract

`window.DESH_CLOUD` exposes:

| Method | Result |
| --- | --- |
| `enabled` | Boolean; false with the committed configuration |
| `getStatus()` | `{ enabled, mode, reason }` |
| `getUser()` | Server-verified `{ id, email }`, or `null` when no session exists |
| `requestOtp(email)` | `{ accepted: true, email }`; call only after the visitor explicitly requests a code |
| `verifyOtp(email, token)` | Verified user after the code is accepted |
| `refreshSession()` | Refreshed, server-verified user |
| `signOut()` | `{ signedOut: true }`, for this device; does not erase local journals |
| `onAuthChange(callback)` | Returns unsubscribe; callback receives `(event, user)`, with no session tokens |
| `saveJournal(snapshot)` | `{ snapshot, updatedAt }`; replaces that user's one snapshot |
| `loadJournal()` | `{ snapshot, updatedAt }` or `null`; does not alter local storage |
| `submitContribution({ districtId, title, body })` | New pending story |
| `submitReview({ placeId, rating, body })` | New pending review; one review per user per place |
| `listApprovedContributions()` | Up to 100 newest approved stories |
| `listApprovedReviews(placeId?)` | Up to 100 newest approved reviews, optionally filtered |
| `listMySubmissions()` | `{ contributions, reviews }`, up to 100 of each owned type |

Methods reject a `DeshpathCloudError` with a short `code`, including `cloud-disabled`, `sign-in-required`, `invalid-input`, `invalid-email`, `invalid-otp`, `already-submitted`, `journal-too-large`, `invalid-journal`, `sdk-unavailable` or `cloud-request-failed`. Surface errors as text and escape all community content on rendering. A disabled mode must say it is local, rather than displaying a simulated signed-in account or successful upload.

Journal snapshots must be JSON objects under 256 KiB. Session credentials and embedded `data:` images are rejected. Files stay outside the snapshot. The SDK's own auth session is stored separately under `deshpath.cloud.auth`; it must never be added to exported journals.

## Database access and moderation

`deshpath_journals` has owner-only `SELECT`, `INSERT` and `UPDATE` policies, including both `USING` and `WITH CHECK`. The timestamp is server-controlled. Anonymous Auth users are rejected by the private/write policies.

Community tables expose approved content to visitors and owned rows to their author. Authenticated inserts are restricted to the allowed content columns, the current user's ID, `pending` status and a null publication time. Browser roles have **no** update/delete grants or moderation RPC, so they cannot approve themselves, rewrite an approved review or change ownership. Authenticated readers can see user UUIDs on approved rows if they query the underlying tables; public display queries deliberately omit these identifiers and never expose an email address. Anonymous readers receive only explicitly granted content columns.

Moderation must happen through a trusted operational process outside the public application, using an authorised administrator's dashboard or a later secured server service. An administrator checks the content, then sets `status='approved'` and `published_at=now()` together; a rejected row has `status='rejected'` and `published_at=null`. Never add a browser-supplied `isAdmin` flag or use editable `user_metadata` to grant this permission.

Before a public cloud launch, add operational rate limiting/abuse controls and a documented removal/correction process. This initial adapter deliberately offers no public admin screen or client edit/delete endpoint. Server-side retention and account-deletion procedures also need to be established by the project owner.

## Photos are not uploaded

Local photo drafts can remain in the browser's IndexedDB gallery. The current adapter handles **text only**. Cloud photo uploads need a separate reviewed Storage setup: a private bucket for originals, user-owned paths and RLS, limits on MIME type/file size, sanitised metadata, publication consent/licensing checks, moderation, and approved public derivatives. Creating a public bucket or exposing every pending original would bypass the moderation model, so this script creates no bucket or upload policy.

## Required live verification

These checks remain **pending** until a real project exists:

| Actor/action | Required result |
| --- | --- |
| Signed-out visitor reads approved stories/reviews | Allowed; pending and rejected content absent |
| Signed-out visitor reads journals or inserts content | Denied |
| User A reads/updates User B's journal | Denied |
| User A inserts a journal with User B's ID | Denied |
| User A changes their journal owner ID | Denied |
| User A saves then loads their own snapshot | Matches, with a server timestamp |
| User A submits text with `status='approved'` or a publication time | Denied by column privileges/RLS |
| User A tries to update or approve a pending row | Denied |
| User B reads User A's pending/rejected row | Denied |
| Anonymous Auth user attempts a private write | Denied |
| Email OTP, expiry, refresh, reload and device sign-out | Genuine session behaviour; no email sent by automated preparation |
| Security/performance advisors | Run and resolve findings before activation |

Local mock tests verify adapter calls, disabled-mode network inactivity, payload validation and session verification. Static checks review grants and RLS. They cannot prove live database enforcement, email delivery or deployment configuration. No SQL test query could be run because the project was not created.

## Primary references checked 18 October 2026

- [Supabase changelog](https://supabase.com/changelog.md), including the [TLS cipher deprecation](https://supabase.com/changelog/cbc-tls-ciphers-deprecated). Use a current browser with modern TLS support. The September PostgreSQL extension/index changes do not affect this new schema, which introduces none of those indexes or legacy encrypted data.
- [Email OTP authentication](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Server-verified getUser](https://supabase.com/docs/reference/javascript/auth-getuser)
- [Session refresh](https://supabase.com/docs/reference/javascript/auth-refreshsession) and [automatic refresh](https://supabase.com/docs/reference/javascript/auth-startautorefresh)
- [Row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Data API grants and exposure](https://supabase.com/docs/guides/api/securing-your-api)
- [Official pinned SDK metadata](https://registry.npmjs.org/@supabase/supabase-js/2.118.0)
