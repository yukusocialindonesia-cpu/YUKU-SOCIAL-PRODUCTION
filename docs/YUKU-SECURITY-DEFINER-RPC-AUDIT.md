# YUKU SECURITY DEFINER RPC Security Audit

Date: 2026-11-26
Production project: `yukuproduction` (PostgreSQL 17)
Scope: read-only inspection of public-schema SECURITY DEFINER functions, execute ACLs, function configuration, selected function definitions and related triggers.

## Executive result

The inspected public SECURITY DEFINER inventory does not show an unauthenticated route to Admin mutation functions. Admin RPCs checked require the relevant module permission or Super Admin status. All inspected functions have an explicit function-level `search_path`; the few using `search_path=public` are trigger-only functions whose EXECUTE ACL is restricted to the database owner.

The audit did identify one operational audit-trail gap in KTP review and several public helper functions whose exposure is intentional and should remain narrow.

## Confirmed findings

### P2 — KTP review decisions are not written to admin_audit_logs

Production `admin_review_ktp(uuid, ktp_status_type, text)`:
- Routes Talent KTP review to Talent permission and Customer KTP review to Support permission.
- Locks the identity row and only accepts `pending_review` to `verified` or `rejected`.
- Updates verification metadata and account verification state.
- Does **not** insert an `admin_audit_logs` record in its function body. The inspected trigger list does not show a separate audit trigger on `user_identities`.

Impact: the verification decision and actor are stored on the identity row for approval, but rejection reason and a durable before/after moderation audit event are not captured in the same standard Admin audit log used by other review RPCs.

Remediation: add an audit-log insert to the KTP review function in a new forward migration, capturing actor, target user, prior status, new status, decision, and normalized reason. Avoid copying KTP number, document paths, or other sensitive identity evidence into audit JSON. Verify both Customer/Support and Talent review paths, including rejection and retry behavior.

### P2 — unnecessary service_role EXECUTE grant on admin_review_ktp

The function is granted to `service_role` as well as `authenticated`. Its body does not provide a service-role bypass; it calls `public.has_admin_permission(...)`, which resolves the permission for `auth.uid()`. A normal service-role request has no user UID and therefore fails the permission check. This is fail-closed, not a demonstrated privilege escalation, but the extra grant is unnecessary and confusing.

Remediation: revoke service_role EXECUTE unless a documented trusted backend use case is added with a separate explicit authorization contract.

## SECURITY DEFINER exposure review

### Admin and financial mutations

The inspected functions below require the expected module permission:
- Finance: payout processing, refund processing, cancellation-case resolution, bank-transfer review, QRIS Finance wrappers, bank/QRIS settings updates and finance label/status helpers.
- Talent: KTP review, Talent review, media review, identity-change review, service review and Talent-scoped summary helpers.
- Support: report resolution and report/booking summary helpers.
- Booking: Admin booking list.
- Super Admin: Admin account listing and permission/status management, dashboard overview, and legacy payment-checkout feature toggle.

These functions are granted to authenticated callers where the UI needs RPC access, but their function bodies perform authorization checks. UI tab visibility is not relied upon as the security boundary.

### User-owned operations

The inspected customer/Talent operations derive ownership from `auth.uid()` or delegate to a lower-level function that does:
- booking creation/completion and payment-route claim,
- cancellation requests, payout requests and payment-proof submission,
- Talent onboarding/profile/service changes and service-location changes,
- referral-code and referral-network operations,
- bank-transfer instructions retrieval.

`request_talent_services(text[], bigint)` does not contain its own direct UID check, but delegates each category to `request_talent_service`, which checks authenticated caller and Talent role before creating a service. This is not a confirmed bypass; add a negative test for anonymous and Customer callers to protect the delegation contract.

### Intentionally public read helpers

- `is_talent_publicly_visible(uuid)` is callable publicly and returns only whether a supplied Talent ID satisfies the public visibility conditions: active account, age/KTP verification, approved profile and at least one approved active service.
- `can_read_talent_media_object(text)` is callable by anon/authenticated and returns a boolean for a storage object path. It permits approved media for publicly visible Talent, the owner, Super Admin or Talent Admin. The Storage policy should continue to call this helper rather than exposing the private media table.
- `get_current_user_role()`, `has_admin_permission(text)` and `is_super_admin()` are read helpers. They derive values from the current request identity; they do not accept a caller-supplied user ID for the public wrapper.

These functions are expected to be callable for their documented use. Do not remove access without checking the associated RLS/Storage policy dependencies.

### Trigger-only functions and function search_path

- The inspected public SECURITY DEFINER functions all have an explicit `search_path` configuration.
- The functions with `search_path=public` in the reviewed set (`sync_talent_rating_stats` and `validate_review_insert`) are trigger functions and their EXECUTE privilege is restricted to `postgres`.
- `guard_talent_media_moderation_fields` appears with a PUBLIC EXECUTE ACL, but its return type is `trigger`; it is attached as a table trigger and is not callable as an ordinary PostgREST RPC. Keep it attached only to the intended trigger.
- Other trigger functions inspected use an empty search path and schema-qualified object references.

## Related existing P1 items

This RPC audit does not close previously confirmed Production findings:
1. Direct authenticated UPDATE on `reports_complaints.status`, `admin_notes`, and `resolved_by_admin_id` still bypasses the Support moderation RPC/audit path until a forward migration revokes those column privileges.
2. Production report-status notifications previously included internal Admin notes; the branch has a source-level fix, but it has not been deployed to Production.
3. Production chat and notification privacy fixes on the feature branch still require Staging tests and controlled rollout.

## Validation and boundaries

- Read-only Production catalog/function/ACL/trigger inspection only; no user, identity-document, booking, payment or payout rows were read.
- No Production DDL/DML, grants, policies, function replacement, migration, settings, deployment, or push send was performed.
- No Staging negative tests or automated test run was available in this pass.
- Any remediation must be a new forward migration generated with `supabase migration new`, then tested on a healthy Staging database before Production release.
