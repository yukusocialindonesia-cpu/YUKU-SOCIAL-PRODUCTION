# YUKU Storage, RLS & Private Document Audit

Date: 2026-11-26
Production scope: read-only inspection of Storage buckets, Storage object policies, selected public-table RLS policies and helper function access. No object contents or user records were read.

## Executive summary

- `ktp-documents` is a private bucket (5 MB; JPEG/PNG/WebP allowlist). Read access is limited by Storage RLS to the owner or `can_admin_access_ktp(owner_id)`. Upload is restricted to the matching user's first-level folder. No direct KTP object UPDATE or DELETE policy was found.
- Bank-transfer and QRIS payment-proof buckets are private. Read access is limited to the submitting Customer or Finance permission.
- `talent-media` is private; public reads are policy-gated through `can_read_talent_media_object(name)`, which only returns true for approved media belonging to a publicly visible Talent, or owner/authorized Admin.
- Public asset buckets (avatars, branding, hero, hero-slides, portfolios, promotions, QRIS display) are configured public. Their object policies still restrict writes to owners or Admin roles as appropriate.
- One tightening opportunity was found in the Production QRIS Storage upload policy: it checks booking ownership and `pending_payment`, but does not itself check payment route, expiry, or an existing pending proof. The submission RPC applies additional validation; direct object upload can therefore create an orphaned proof object that is not accepted as a payment submission.

## Findings

### P2 — QRIS Storage upload policy is looser than the payment workflow

Production policy `qris_proof_upload_own_booking` requires:
- bucket `qris-payment-proofs`,
- a booking whose ID matches the first folder segment,
- caller is the booking Customer,
- booking status is `pending_payment`.

It does not independently require:
- `payment_route = 'manual_qris'`,
- payment has not expired,
- no existing pending QRIS proof for the booking.

The `submit_qris_payment_proof` RPC and related server logic perform additional checks, so this audit does not establish that an invalid proof can be approved or settle a booking. The gap is at the Storage object layer: an authenticated owner may upload an orphaned file for a pending booking even when the QRIS route is not the active route, or after expiry.

Remediation: tighten the Storage INSERT policy to match the RPC's route, expiry and duplicate-pending-proof conditions. Keep the RPC as the authoritative submission gate. Add negative tests for wrong route, expired booking, duplicate pending proof and cross-customer path. Clean up orphaned objects through a controlled retention process, not broad user DELETE rights.

### P2 — KTP upload policy relies on folder ownership, not account status

Production `ktp_documents_owner_insert` requires the object path's first folder to equal `auth.uid()`. It does not call the active-account guard used on several public tables.

This may be intentional: users in `pending_verification` need to upload identity evidence to complete onboarding. Do not simply add an active-account-only condition. Confirm whether suspended/banned accounts should be prevented from adding new identity files, while preserving the pending-verification onboarding flow. If required, add a narrowly scoped eligibility helper that allows pending verification but blocks suspended/banned accounts.

### P2 — Storage policy role declarations use PUBLIC in several places

Several owner/public-asset policies are declared `TO public` (including owner upload and public read policies). Their expressions still constrain access using `auth.uid()`, owner folder checks, bucket ID or Admin permission; this does not by itself prove anonymous access to private objects. However, declaring write policies for PUBLIC makes the intended trust boundary less explicit.

Remediation: migrate authenticated owner/Admin writes to `TO authenticated`; keep `TO public` only for deliberately public object reads. This is a hardening/clarity change, not a confirmed bypass.

## Bucket-by-bucket result

| Bucket | Public | Main access model |
|---|---:|---|
| ktp-documents | No | Owner upload; owner or role-routed Admin read |
| bank-transfer-payment-proofs | No | Customer upload/read; Finance read; upload constrained to pending bank-transfer booking |
| qris-payment-proofs | No | Customer upload/read; Finance read; Storage upload policy needs route/expiry/duplicate tightening |
| talent-media | No | Owner upload; approved-public/owner/Talent Admin read |
| avatars | Yes | Public read; owner-folder writes |
| portfolios | Yes | Public read; owner-folder writes |
| branding | Yes | Public read; Super Admin writes |
| hero | Yes | Super Admin writes; Admin read |
| hero-slides | Yes | Public read; Super Admin-gated writes via `is_admin()` |
| promotions | Yes | Public read; Super Admin-gated writes |
| qris-payment-display | Yes | Public read; Finance upload/update |

All inspected buckets had file size and MIME restrictions configured. This catalog review did not inspect actual stored object contents.

## Related RLS checks

- `user_identities`: RLS enabled; owner insert/read/update is constrained to own ID; KTP reads additionally route through `can_admin_access_ktp`. A trigger protects verification metadata and validates age/identity conditions.
- `talent_media`: RLS enabled; owner insert/update, owner or Talent Admin delete, and read constrained to approved-public/owner/Talent Admin.
- `talent_profiles`: RLS enabled; public select goes through public-visibility helper; owner or Talent Admin update.
- `reports_complaints`: existing direct authenticated UPDATE privilege on moderation columns remains the previously confirmed P1 bypass; Storage review does not close it.
- `community_reports`: member insert and reporter/moderator read are scoped; moderator action uses its dedicated moderation path.

## Release blockers and next steps

1. Generate a forward migration tightening `qris_proof_upload_own_booking` to match route, expiry and duplicate-proof conditions; verify on healthy Staging.
2. Decide explicit KTP upload behavior for suspended/banned users without blocking pending-verification onboarding.
3. Change non-public Storage write policies from `TO public` to `TO authenticated` where supported by the actual client flow.
4. Add negative Storage tests for cross-user folder paths, anonymous upload, wrong payment route, expired booking, duplicate proof, and non-authorized Admin reads.
5. Preserve the existing private bucket configuration for KTP, payment proofs and Talent media.

## Change boundary

No Production schema, Storage bucket, object, policy, grant, file, user record, or payment record was modified. No upload/download test or Staging test was performed. Findings are based on Production catalog/policy definitions only.
