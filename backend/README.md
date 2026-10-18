# Deshpath Supabase connection

## Deployment record — 18 October 2026

The owner approved the existing **PestGurd — Development Test** project (`sfzitbasxrpmtmldujbm`, Singapore) for Deshpath. Three new `public.deshpath_` tables and one namespaced journal timestamp trigger were added. Existing application tables, data, roles, functions, email templates and the existing Site URL were not changed. Three exact Deshpath callback URLs were appended to the redirect allowlist on 18 October 2026. No paid project or upgrade was created.

Applied remote migration: `20261018032314_deshpath_private_journal_moderated_text_v1`.
`setup.sql` is the exact additive initial schema. **Do not rerun it**: it deliberately fails on existing object names. Future changes require separate reviewed migrations.

The browser has only a modern publishable key. It has no service key, database password or management credential. The SDK is pinned to official Supabase JS 2.118.0, bundled locally with SRI and MIT licence.

**Current state:** email-link sign-in, explicit private journal save/load and text-only submissions are enabled with `authReady: true`. Gmail SMTP was saved by the owner and real inbox delivery plus a PKCE callback were verified. The owner created and entered the dedicated App Password directly in the dashboards; it is absent from the repository and browser configuration. Empty public feeds show an honest empty state, without demonstration posts or ratings.

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
