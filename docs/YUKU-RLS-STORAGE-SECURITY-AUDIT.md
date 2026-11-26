# YUKU RLS & Storage Security Audit

Date: 26 November 2026
Branch: `feat/professional-services-categories`
Scope: migration-chain review of public-table RLS, Admin-scoped policies, Storage object policies, and policy composition.

## Executive summary

Two policy-composition defects were found and fixed in feature-branch migrations:

1. `talent_services_select_public` from migration 06 used `USING (TRUE)`. Migration 41 added a scoped policy but did not remove the old permissive policy. Because PostgreSQL combines permissive policies with OR, the old policy continued exposing pending, rejected, inactive, and otherwise non-public Talent service rows.
2. Migration 64 recreated Talent availability SELECT for `authenticated` only, despite the intended public-discovery rule in migration 20261124150000 allowing `anon, authenticated`. This unintentionally removed anonymous visitor access to availability for publicly visible Talents.

## Implemented fixes

### A. Remove unrestricted Talent service read policy

Migration: `20261127000700_remove_legacy_public_talent_services_policy.sql`  
Commit: `faecc345181b3714827667f68470f1c450097949`

- Drops `talent_services_select_public`, the original broad policy from migration 06.
- Retains `talent_services_select_scoped` from migration 41 and its later refinement in migration 49.
- Effective intended read boundary: approved + active + publicly visible services for visitors; owner access for the Talent; Talent Admin/Super Admin access through the permission helper.
- The old policy was permissive and therefore widened access even though the newer scoped policy was correct.

### B. Restore anonymous read for publicly visible availability

Migration: `20261127000800_restore_scoped_public_talent_availability_read.sql`  
Commit: `dbe1ffff5e67d57171a336c8758bcea1727b1068`

- Recreates `talent_availability_select_visible` for `anon, authenticated`.
- Preserves owner and authorized Talent Admin access.
- Anonymous visitors can only read schedules for Talents that pass `is_talent_publicly_visible`.
- This restores the intended discovery behavior without restoring the legacy unrestricted `USING (TRUE)` policy.
- The permission helper is deliberately executable by anon in migration 20261125014500; it derives the subject from `auth.uid()` and returns false for anonymous users.

## Other reviewed policy areas

### User identity and KTP

- `user_identities` owner SELECT/UPDATE is restricted to the matching user; administrative SELECT uses `can_admin_access_ktp`.
- `can_admin_access_ktp` maps Talent KTP review to Talent permission and Customer KTP review to Support permission. Super Admin is included by the private permission helper.
- KTP Storage SELECT requires the owner folder or the same role-scoped KTP permission check.
- KTP and professional evidence buckets are private; no public object-read policy was found in the reviewed migrations.

### Professional-service evidence

- Upload requires the authenticated owner's UUID folder, active account, and an existing Talent profile.
- Bucket is private, 10 MB, with PDF/JPEG/PNG/WebP MIME allowlist.
- Read is limited to owner, Talent-permission Admin, or Super Admin.
- No authenticated UPDATE/DELETE policy was found for this bucket; this intentionally prevents arbitrary replacement/deletion through the browser API.

### Talent media

- Moderation trigger forces new uploads to pending and protects moderation metadata.
- Public object access is disabled at the bucket level.
- Storage SELECT delegates to `can_read_talent_media_object`, which checks registered media path, Talent folder ownership, approval status, and public Talent visibility, or owner/reviewer access.
- Short-lived signed URLs are required for frontend gallery rendering after this migration is deployed; the migration header explicitly warns not to apply before client compatibility is ready.

### Payment evidence

- QRIS and bank-transfer proof buckets are private.
- Upload is tied to an eligible pending-payment booking owned by the caller.
- Read is limited to the submitting Customer or Finance permission.
- Bank-transfer proof deletion is blocked while the submission is pending review.
- QRIS proof read/upload policies are separated from public QRIS display assets.

### Admin-scoped data

- Talent, Finance, Support, Booking, and Super Admin policies are separated in migrations 48–54.
- `public.is_admin()` is intentionally Super Admin/service-role only after migration 62; module access uses `has_admin_permission`.
- The generic Admin summary RPC exposure was separately narrowed in migration 20261127000600.

## Remaining risks / verification requirements

1. Apply the full migration chain to a disposable/Staging database and query `pg_policies` to confirm there is no remaining permissive `USING (true)` policy on sensitive Talent tables.
2. Run anon and authenticated tests for Talent services: pending/rejected/inactive rows must be invisible to unrelated visitors; approved/active/public rows visible; owners and Talent Admins see their allowed rows.
3. Run anon and authenticated tests for availability: public visible Talent schedules are readable by anon; non-public Talent schedules are not; owner and Talent Admin retain their intended access.
4. Test KTP, professional evidence, Talent media, QRIS proof, and bank-transfer proof with owner, unrelated Customer, Talent Admin, Finance Admin, Support Admin, Super Admin, anon, and service_role.
5. Confirm no old Storage policy remains permissive after the complete migration chain. Storage policies are also permissive by default and must be evaluated as a combined set per bucket/action.
6. Run Supabase Security Advisors and review effective grants, not only migration source.

## Validation boundary

The two fixes were verified by re-fetching the migration source and checking the intended policy names, role targets, and predicates. No PostgreSQL migration replay, live RLS query, Storage object test, Security Advisor, Staging mutation, Production mutation, or deployment has been performed. CI workflows were not triggered by these migration-only commits.

## Production Storage policy follow-up — 26 November 2026

A read-only inspection of the effective Production `storage.objects` policies found a Talent-media integrity issue:

- The deployed policy `talent_media_bucket_owner_update` permits an authenticated owner to UPDATE an existing object in their own Talent folder.
- The media moderation row remains approved when the underlying object bytes are replaced. A caller can bypass the frontend's `upsert: false` by invoking the Storage API directly, potentially replacing a reviewed image/video/audio file without a new moderation decision.
- This is not mitigated by the private bucket or signed URLs: those controls protect object retrieval, not the integrity of the stored bytes.

### Branch remediation

- Migration `20261127001300_make_talent_media_objects_immutable.sql` drops `talent_media_bucket_owner_update`.
- The earlier migration 65 source was also corrected to leave this UPDATE policy absent on fresh database builds.
- The current upload flow uses unique timestamped object paths and `upsert: false`; it inserts a new `talent_media` row whose trigger forces moderation status to `pending`.
- Owners retain INSERT of new media and DELETE of their own media. Replacing content requires a new upload and new moderation review.

### Validation required

- After applying the new migration in Staging, confirm no permissive UPDATE policy remains for bucket `talent-media` (including policies created by older migrations).
- As an owner, test UPDATE/upsert of an existing approved object: it must fail. Test upload to a new unique path: it must succeed and the new row must be pending.
- Verify owner deletion still works and Talent Admin moderation remains functional.
- Production currently still has the owner UPDATE policy until the new migration is applied through the approved release process. No Production write was made in this audit.


## KTP evidence lifecycle finding — 26 November 2026

A source-to-schema comparison found a separate identity-evidence handling defect:

- `VerifyKtpPage.tsx` uploads both the KTP image and a selfie-with-KTP image into private `ktp-documents`.
- The active `public.user_identities` schema contains only `ktp_storage_path`; it has no `selfie_storage_path` column. The client saves only the KTP path.
- Admin KTP review UI generates a signed URL only for `ktp_storage_path`. The selfie is never linked to the identity record or shown in the review flow.
- If one of the parallel uploads fails, or the identity-row lookup/save fails, the successful uploaded object is not cleaned up. Re-submitting a new KTP also leaves the previous KTP object behind because only the latest path is stored.
- The result is orphaned sensitive identity material in the private bucket, and the stated selfie verification step is not actually part of the Admin review decision.

This is a P1 identity workflow/privacy issue. Do not silently discard the selfie requirement or claim it is verified. A complete fix needs a schema field and migration for selfie evidence, typed client/admin review integration, signed-URL access through the same scoped KTP permission, plus failure cleanup and retention/deletion rules for superseded uploads. The existing upload path must also clean up any successfully uploaded object when a sibling upload or database write fails.

No production data was read from object contents, deleted, or changed during this audit.


### Public bucket usage check

- The Production `portfolios` bucket is public with a public SELECT policy and a 5 MB image allowlist.
- A source search of the current branch did not find frontend usage of `storage.from('portfolios')` or an active portfolio upload/read path. This suggests the bucket may be legacy or reserved for future use; it is not proof that no old objects exist.
- Before launch, inventory object names/counts and confirm whether any current profile/media feature depends on this bucket. If unused, plan a controlled archival/private conversion rather than changing bucket visibility without checking existing links.



## Recheck of Talent media overwrite guard — Production still exposed, 26 November 2026

A fresh read-only Production policy query confirms the previous fix is not deployed there yet:
- Production bucket talent-media is private.
- Production storage.objects still has talent_media_bucket_owner_update for authenticated owners, allowing UPDATE of objects in their own Talent folder.
- Production public.talent_media still has talent_media_owner_update for the owner row (the moderation trigger protects moderation fields, but the Storage object UPDATE policy is the critical bypass).
- Production has 5 talent_media rows, all moderation_status=approved and all with a storage_path.

Risk: a Talent can replace bytes of an already-approved object through the Storage API while the corresponding talent_media row remains approved. This bypasses the frontend upsert:false convention and can cause different content to be served through the approved row/signed URL without a new moderation decision.

Branch already contains the intended mitigation in migration 65_talent_media_moderation_and_private_storage.sql and migration 20261127001300_make_talent_media_objects_immutable.sql: drop the Storage owner UPDATE policy; keep unique INSERT and owner DELETE. It has not been applied to Production. Do not describe this as fixed in Production until the migration is applied through the approved release path and the policy is absent in pg_policies.

Required Staging tests: authenticated owner UPDATE/upsert existing approved object must fail; owner INSERT new unique object must succeed and create a pending row; owner DELETE only their own object; Talent Admin moderation must still work; unrelated user access must fail; approved object remains readable only through authorized short-lived access.

No Production policy, bucket, media row, or object was modified in this recheck.


## Production public-profile and cross-user privacy recheck — 26 November 2026

This section records a read-only comparison of effective Production grants/policies against the current feature-branch migrations. The queries inspected catalog metadata only; no customer/Talent row contents, KTP values, exact coordinates, object contents, or user identifiers were read.

### P1 — anonymous table-level SELECT remains on public.talent_profiles

Production ACL inspection shows `public.talent_profiles` still has table-level SELECT granted to `anon` and `authenticated`. The effective public policy limits which Talent rows can be read to the owner, Talent Admin, or publicly visible Talent, but the table-level grant exposes every column of those visible rows to anonymous clients.

The Production column privilege check confirmed anonymous SELECT on fields including `referral_code`, `hourly_rate`, `online_chat_rate`, `gender`, `languages`, `interests`, `completed_hours`, and public profile fields. In particular, `referral_code` is explicitly documented in the branch as intentionally excluded from anonymous catalog access.

The feature branch already contains migration `20261127000300_limit_public_talent_profile_columns.sql`, which revokes table-level SELECT from anon and grants an explicit allowlist. The live Production ACL proves this migration has not yet taken effect there. This is a release blocker for the public profile privacy boundary; do not claim it is fixed in Production until the migration is applied through the approved rollout and `has_column_privilege` confirms `anon` cannot SELECT `referral_code` or other excluded columns.

The current allowlist deliberately includes the existing public hourly/online rates for authenticated/anonymous catalog reads. This does not match the product UI preference to reveal price only after a user opens the Talent profile. It is a product/data-minimization issue rather than a private-credential leak; decide whether rates should remain publicly queryable before the next release and adjust the allowlist/UI contract consistently.

### Other cross-user access checks

The Production catalog/policy snapshot showed:
- `public.users`: anon has no SELECT; authenticated SELECT is constrained by `users_select_self_or_admin`.
- `public.user_identities`: anon has no SELECT; authenticated table SELECT is constrained to owner or the role-scoped KTP reviewer helper. KTP number, legal name, date of birth, emergency contact and storage path are not anonymous-readable.
- `public.customer_profiles`: anon has no SELECT; authenticated rows are limited to the owner, Super Admin, or a Talent who has a booking with that Customer. That booking-linked Talent can read the Customer profile fields (display name, avatar, city, gender, bio) needed by the current post-booking UI. This is a deliberate relationship-based disclosure, but should remain limited to booking counterparties and should not be widened to all authenticated users.
- `public.talent_profiles`: row visibility is still restricted by the live public-visibility helper; the problem above is excessive columns on each visible row, not unrestricted access to all Talent rows.
- `public.talent_services`: visitor SELECT is scoped to approved, active services of publicly visible Talent, plus owner and Talent Admin access.
- `public.talent_availability`: anon SELECT is scoped to the Talent owner, Talent Admin, or public-visibility helper. Exact Talent GPS coordinates are stored in the private schema and have no anon/authenticated direct table SELECT grant.
- `public.bookings`: SELECT is limited to booking Customer/Talent parties or Super Admin. Booking row UPDATE has participant policy, but authenticated column UPDATE grants are limited to `status`, `cancellation_reason`, and `updated_at`; trigger validation remains part of the security boundary. Direct client UPDATE is not the booking creation/payment path.

### P2 — public reviews expose stable Customer and booking identifiers

Production grants SELECT on the entire `public.reviews` table to anon. The `reviews_select_public` RLS policy returns visible reviews, but public columns include `customer_id` and `booking_id` in addition to rating, review text, Talent ID, visibility and timestamps. These are persistent UUID identifiers, not names or contact details, but they permit correlation of a review author across public reviews and expose internal booking identifiers.

Review whether public review cards need raw `customer_id` or `booking_id`. Prefer a public-safe view/RPC that returns a display label and review fields without internal foreign keys; keep the raw table SELECT limited to authenticated roles that need it, and preserve the existing moderation workflow. This is a privacy-minimization finding, not evidence that Customer names, emails, phone numbers, or booking addresses are publicly readable.

### Storage findings reconfirmed

- `ktp-documents`, `qris-payment-proofs`, `bank-transfer-payment-proofs`, and `professional-service-documents` are private buckets with owner/role-scoped read policies.
- `talent-media` is a private bucket, but Production still has the owner UPDATE policy on `storage.objects`. Branch migration `20261127001300_make_talent_media_objects_immutable.sql` removes that policy so an approved media object cannot be replaced without a new moderation row. Production remains exposed until the migration is applied and verified.
- `portfolios` is a public bucket with unconditional public SELECT. Historical implementation documents describe it as the public Talent portfolio gallery, but current branch frontend search did not find an active upload/read path. Inventory old objects and links before changing visibility; do not assume the bucket is empty or unused.
- `avatars`, `hero`, `hero-slides`, `promotions`, `branding`, and `qris-payment-display` are public-facing assets. Public bucket visibility means anyone with an object URL can fetch its contents; never place KTP, private documents, payment evidence, or unapproved media there.

### Required release and Staging checks

1. Apply migration `20261127000300_limit_public_talent_profile_columns.sql` in Staging; confirm anonymous table-level SELECT is false and only the approved column allowlist is readable. Explicitly test `referral_code` denial.
2. Decide whether public anonymous access to Talent rates is intentional given the product's click-to-reveal pricing rule.
3. Test Customer A cannot read Customer B profile, identity, bookings, payment evidence, or private media; a Talent can read only profile fields of Customers with whom they have a booking; unrelated Talent cannot.
4. Test public review access returns only intentionally public review fields; no raw customer or booking identifiers if the safe projection is adopted.
5. Apply the talent-media immutable-object migration in Staging; verify owner UPDATE/upsert fails while new unique upload enters moderation.
6. Inventory legacy `portfolios` objects and all public buckets for private material before any bucket visibility changes.
7. Re-run effective ACL, RLS, Storage policy and role-matrix checks after rollout. Static migration presence on the feature branch is not proof of Production deployment.

No Production grants, policies, buckets, rows, files, users, or settings were changed during this audit.


## Public bucket inventory & lifecycle follow-up — 26 November 2026

Scope: branch migration/client source review, compared with the previously captured read-only Production bucket inventory. No object content or object names were inspected.

### Public buckets and intended purpose

- `avatars`: public profile photos. Current clients in Customer profile, Talent registration, and Talent dashboard upload to this bucket and persist `getPublicUrl`. Public readability is intentional, but users must be told profile photos are public and must not upload KTP/selfies/private images here.
- `promotions`: public Jelajah promo artwork. Admin uploads public URLs and stores them in `public.promotions`. Intended public.
- `hero`: public homepage desktop/mobile slides. `HeroSlidesAdminPanel.tsx` uses versioned unique paths and public URLs. Intended public.
- `branding`: public logo/icon assets referenced by `site_branding`. Intended public.
- `qris-payment-display`: public QRIS display image, required for Customers to scan. Intended public; distinct from private `qris-payment-proofs`.
- `portfolios`: public bucket created by early migration 06 with public SELECT and owner upload/update. No current frontend `storage.from('portfolios')` usage was found in branch source search. Prior Production inventory also listed it as public. Treat as legacy/unused until object/path references and database URLs are inventoried; do not flip it private without checking live references.

### Lifecycle and integrity findings

1. **Avatar replacement leaves old objects behind (P2).**
   - Customer, Talent registration and Talent dashboard use unique paths with `upsert: false`, then save a public URL.
   - When an avatar is replaced, the new URL is saved but the old object is not removed. This accumulates publicly accessible orphan images. Implement a delayed, server-side cleanup based on paths no longer referenced by any profile; do not delete client-supplied arbitrary paths.

2. **Branding upload can orphan a public object (P2).**
   - `BrandingAdminPanel.tsx` uploads a unique object, then updates `site_branding`. If the database update fails, the uploaded object remains publicly readable but unreferenced.
   - Replaced logo/icon paths are not cleaned up. Cleanup must first verify no branding/profile record references the path.

3. **Hero slide upload is not compensating (P2).**
   - Desktop object is uploaded first, then optional mobile object, then the `hero_slides` row. If mobile upload or row INSERT fails, earlier uploaded object(s) remain.
   - Delete removes the row before attempting Storage removal; the returned Storage error is ignored. Public objects may remain reachable by URL after the slide is deleted.
   - Use exact-path cleanup with checked results and a retryable cleanup queue. Do not remove a path while another active slide row references it.

4. **Promotion deletion/upload has similar orphan behavior (P2).**
   - Poster upload precedes database INSERT. Failed INSERT leaves a public object.
   - Delete removes the database row before Storage object; Storage removal errors are ignored.
   - Keep cleanup separate from financial/booking flows and only delete exact unreferenced paths.

5. **QRIS display uses immutable versioned path convention (positive control).**
   - QRIS admin panel uploads unique versioned paths with `upsert: false`; the current settings row points to the selected image.
   - Old versions may remain publicly reachable by design for rollback. Define retention and cleanup after checking that no current/rollback setting references them. Never place customer proof images in this public bucket; proofs belong in private `qris-payment-proofs`.

### Access-control assessment

- Public buckets are intentionally public-read; Storage object RLS does not make a public bucket private. Any person with the object URL can read it. Restrict uploads/updates/deletes independently to owners or the relevant Admin permission.
- Branch migration 53 narrows write controls for `branding`, `hero`, and `promotions` to Super Admin. QRIS display write controls are Finance-scoped in the later manual-transfer migration; confirm product decision because an earlier audit note proposed Super Admin-only.
- Bucket MIME/size limits are defense-in-depth, not content inspection. Client-side MIME checks are not sufficient to prove file bytes are safe. For public uploads, verify magic bytes server-side and consider image re-encoding/metadata stripping.
- No current portfolio frontend consumer found; the legacy bucket remains a risk surface because public object URLs are durable and cannot be revoked merely by hiding a UI reference.

### Required Staging tests / release actions

- Inventory bucket visibility, size/MIME limits, every effective permissive Storage policy (policies OR together), and all current DB references before changing any public bucket.
- Test anonymous download succeeds only for intentionally public asset buckets and fails for all private evidence buckets.
- Test Customer/Talent can upload only to their own avatar folder; cannot update/delete another user's object or upload into `ktp-documents`, `qris-payment-proofs`, or Admin asset buckets.
- Test Admin role matrix for branding/hero/promotion and Finance QRIS display upload/update/delete.
- Simulate failed DB writes after each successful upload and failed Storage removal after DB delete; ensure cleanup is recorded and retried, and no referenced asset is deleted.
- Confirm portfolio object/database references and decide explicitly to retain, migrate, or retire the bucket.
- Add a user-facing warning that avatar images are publicly accessible; keep identity/KTP/selfie evidence in private buckets only.

### Validation boundary

The prior Production snapshot reported public buckets `portfolios`, `promotions`, `qris-payment-display`, `hero-slides`, `hero`, `avatars`, and `branding`; private evidence buckets were `ktp-documents`, `qris-payment-proofs`, `bank-transfer-payment-proofs`, and `talent-media`. This section validates source intent and client lifecycle, not current live object contents or effective live policy composition. No Production or Staging settings, buckets, policies, rows, or objects were changed.
