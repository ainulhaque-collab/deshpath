# Moderated destinations, visitor reviews and administration

This release adds a deliberately separate online community to the private local journal. Nothing from an existing personal photo gallery or backup uploads automatically.

## Publication workflow

Sign in, open **Discoveries**, describe a place and explicitly consent to uploading 1–3 photographs. Each original is at most 5 MB and 24 megapixels. Originals and extracted camera/date/GPS signals remain in the private `deshpath-private` bucket. The server decodes and re-encodes a prepared JPEG before publication. EXIF is a review signal, never proof of ownership or travel.

The owner signs in and opens `/#admin`. Membership is checked by the server on every administrative action using `deshpath_admins`, never editable Auth metadata. The initially approved owner identity is `ainulshalkhuria@gmail.com`. There is no browser self-enrolment or service key.

Admin reviews photographs, metadata and information; edits Bengali/English copy and cover; requests changes, rejects or approves. Approved snapshots join **Explore**, with the original 16 identifiers preserved. A pending revision cannot alter a previously published destination/review. Repeated approval is idempotent; stale moderation is rejected by revision checks. Duplicate proposals may merge into a canonical place ID. Archived content retains its moderation history.

Each place has structured visitor reviews: travel date, rating, own photographs, route/transport, total group cost and number of travellers. Approval is required before publication. An author may revise and resubmit, view reasons/notifications and request withdrawal. Visitors may report published content. Withdrawal requests require an admin decision; they do not instantly erase canonical destinations or other travellers’ reviews.

Public identity is opt-in and separate from the private local profile. Public APIs omit email addresses, Auth user IDs, private object paths and EXIF. Original photographs never become public. An approved public image can be downloaded by visitors; unpublishing does not recall copies they already saved.

## Deployment

The approved shared development project is `sfzitbasxrpmtmldujbm`. Apply additive `community.sql`, then `games.sql` and `storage-guard.sql`; never rerun the v1 `setup.sql`. Run `node backend/build-catalog-seed.cjs` and execute `catalog-seed.sql` to register the existing editorial destinations. Grant the exact confirmed owner Auth identity administratively. Do not change shared Auth hooks, templates or other apps’ records.

Deploy **deshpath-community** with all files under `backend/functions/deshpath-community/`. `verify_jwt=false` is intentional for public catalog/rankings; every private action verifies its user JWT with `Auth.getUser` inside the handler. Secret credentials come only from Edge runtime environment. Browser requests use `apikey` for the publishable key and a verified user JWT for private operations.

Open the admin panel’s **Prepare photo storage** action once to create `deshpath-private` (private) and `deshpath-public` (public approved derivatives only) through the Storage API. There are no browser Storage write policies. The shared project and SMTP service remain subject to their existing quotas; no paid plan was provisioned.

All new tables have RLS enabled and browser grants revoked. They intentionally have no browser policies: access goes through explicit Edge projections. Supabase’s informational “RLS enabled, no policy” notice is expected for this service-only design. Never add permissive policies merely to remove that notice.

`verify-community.sql` checks real DB privileges, nonadmin rejection, photo ownership, publication/revision isolation, idempotency and game result ownership in a rollback-only transaction. It leaves no published fixtures. Unit tests also cover transport, media validation, publication projections and UI handling. Browser checks are recorded separately in the release report.

## Activity and rankings

See `GAMES.md`. Online game sessions/results are necessary server records and visible to administrators. Public leaderboards require public-profile opt-in. Optional practice/export events require a separate usage consent. Guest sessions/active-user counts are estimates. Export preparation, download and print requests are distinct; none proves a successful disk save. Dashboard windows and bounded lists must stay visible.

No booking, payment, automatic verification, email marketing or guaranteed fraud detection is provided by this release. In-app notifications carry moderation results; shared Auth email templates are unchanged.
