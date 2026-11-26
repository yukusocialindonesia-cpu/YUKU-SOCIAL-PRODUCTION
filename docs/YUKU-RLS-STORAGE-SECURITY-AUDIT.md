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
