# YUKU SECURITY DEFINER RPC & is_admin() Inventory

Date: 26 November 2026
Branch: `feat/professional-services-categories`
Scope: source-level review of SECURITY DEFINER functions, Admin RPC authorization, public helper exposure, and newer GPS/media RPCs.

## Executive result

The current migration chain contains several classes of SECURITY DEFINER functions. They must not be treated as one category:

1. User-facing RPCs require explicit `auth.uid()`, ownership, and/or module permission checks.
2. Trigger functions are internal database hooks and should have EXECUTE revoked from application roles.
3. Public visibility helpers may intentionally be executable by anon when they disclose only a boolean or approved public media.
4. Trusted backend/cron functions may be service_role-only.

The feature branch contains follow-up hardening for the previously identified broad booking-trigger bypass and generic Admin summary RPCs. This inventory is a source review only; it is not proof of runtime database ACLs or Staging behavior.

## Admin RPC guard classification

Migration `51_admin_rpc_permission_guards.sql` replaces generic `is_admin()` checks in these user-facing RPCs:

| Function | Required authority |
|---|---|
| `admin_process_payout` | Finance |
| `admin_process_refund` | Finance |
| `admin_resolve_customer_cancellation_case` | Finance |
| `admin_resolve_report` | Support |
| `admin_review_talent` | Talent |
| `admin_review_qris_payment` | Finance |
| `admin_update_qris_settings` | Finance |
| `get_admin_dashboard_overview` | Super Admin |
| `review_talent_identity_change` | Talent |
| `review_talent_service` | Talent |

The migration dynamically rewrites the existing function definitions, so a successful migration replay is necessary to prove the resulting definitions. Static source inspection confirms the intended replacements are declared; it does not prove they executed in a particular database.

Super Admin-only account provisioning/permission functions from migration 59 are a separate class and should remain Super Admin-only.

## Remaining is_admin() references — expected categories

The source search finds remaining uses in:

- RLS policies for global configuration and administrative surfaces. Since migration 62 narrows `public.is_admin()` to Super Admin/service_role, these policies intentionally do not grant broad module access unless a later scoped policy replaces them.
- Booking and user integrity triggers, where `is_admin()` is used as a trusted/global-admin exception rather than as a module UI permission.
- Escrow and settlement paths that retain trusted backend/service-role checks. These are not ordinary Admin UI endpoints.
- Historical migration definitions which are subsequently replaced by later migrations. The final definition must be evaluated in migration order, not by reading the first occurrence alone.

Do not mass-replace these references. In particular, trigger guards, payout status integrity, and escrow release need a separate transition/actor analysis.

## Newer RPC and media/GPS checks

### Talent media moderation (migration 65)
- Owner uploads are forced to `pending`; client-supplied review metadata is overwritten.
- Storage paths must begin with the owning Talent UUID.
- Moderation decisions use `admin_review_talent_media`, which requires Super Admin or Talent permission, locks the media row, validates decision/rejection reason, and records an audit row.
- The bucket is made private; object reads are mediated by `can_read_talent_media_object`.
- The client must use short-lived signed URLs for approved media before this migration is deployed. This migration remains staged in Git only.

### Talent service-area GPS (migrations 66–68)
- Exact Talent coordinates are stored in the private schema and direct table access is revoked from application roles.
- Save/activate RPCs require an authenticated, active Talent account.
- The personal-location RPC returns only the caller's own coordinates and settings.
- Nearest search returns Talent IDs and rounded distance, not Talent coordinates.
- Migration 68 narrows nearest search to active Customer callers and active Talent accounts, with approved profiles, offline-capable service mode, active GPS setting, validated input coordinates, and a bounded result limit.
- These RPCs have explicit PUBLIC/anon revokes and authenticated grants in source.

### Public helper functions
- `can_read_talent_media_object(text)` is executable by anon/authenticated so Storage RLS can evaluate public approved media; its query returns only a boolean and grants access only for approved publicly visible media, the owner, or Talent/Super Admin reviewers.
- `is_talent_publicly_visible(uuid)` is a boolean visibility helper intended for public RLS evaluation.
- `has_admin_permission(text)` and `is_super_admin()` have public wrappers used by RLS policies; anonymous callers must resolve to false because there is no authenticated subject. Test this explicitly with anon JWT context.

## Follow-up hardening already committed

- `20261127000500_narrow_scoped_admin_booking_trigger_bypass.sql`: removes blanket Booking/Finance/Support bypasses from booking integrity triggers and adds narrowly scoped Support dispute hold/restore transitions.
- `20261127000600_scope_admin_summary_rpcs.sql`: constrains Admin user, report booking, and Finance label summary RPCs to records associated with the relevant module.
- Related Admin access audit: `docs/YUKU-ADMIN-ROLE-ACCESS-SECURITY-AUDIT.md`.

## Required Staging verification before release

1. Query `pg_proc`, `pg_roles`, `information_schema.routine_privileges` / `has_function_privilege` to inventory every SECURITY DEFINER function, owner, schema, argument signature, and effective EXECUTE grants for PUBLIC, anon, authenticated, and service_role.
2. Verify every public SECURITY DEFINER function has a deliberate grant and an in-body caller/ownership/permission check, except explicitly documented public boolean helpers and trigger-only functions.
3. Verify all trigger-only functions have no EXECUTE for PUBLIC, anon, or authenticated; trigger invocation itself must continue working.
4. Confirm the final definitions of the ten Admin RPCs above after the complete migration chain, including all overloads and the exact grants.
5. Test anon, Customer, Talent, Talent Admin, Booking Admin, Finance Admin, Support Admin, Super Admin, disabled Admin, and service_role separately.
6. Test the GPS nearest search with anon, active Customer, inactive Customer, Talent, inactive Talent, and Super Admin; verify exact coordinates never appear in returned rows.
7. Test media access for pending/rejected/approved media across anon, owner, unrelated Customer, Talent Admin, Super Admin; verify private object URL access cannot bypass Storage policy.
8. Run Supabase Security Advisors and review every finding rather than blanket-revoking EXECUTE.

## Validation boundary

The original inventory section was a Git source audit. A later Production read-only follow-up and Security Advisor snapshot are recorded below. No SQL writes, migrations, function deployments, database data changes, or policy changes were performed. The PR remains a draft and unmerged.

## Production read-only follow-up — 26 November 2026

A further read-only inspection was performed against the connected Production database:

### Effective SECURITY DEFINER execution and caller checks
- Effective grants still show 5 anonymous-callable SECURITY DEFINER functions and 60 authenticated-callable SECURITY DEFINER functions, matching the Security Advisor snapshot.
- The four anonymous boolean helpers (can_read_talent_media_object, has_admin_permission, is_super_admin, is_talent_publicly_visible) are used by RLS/Storage authorization and return only boolean results. Their public grants are intentional, subject to role-matrix tests proving anonymous identity resolves to false and no private row data is returned.
- guard_talent_media_moderation_fields() remains directly executable by anon/authenticated in Production. It is a trigger-only helper and this is a confirmed privilege defect. The branch migration 20261127001200_revoke_talent_media_trigger_helper_execute.sql revokes PUBLIC/anon/authenticated while preserving trigger invocation, but it has NOT been applied to Production. Release blocker until applied through the normal migration process and verified with has_function_privilege.
- Authenticated SECURITY DEFINER functions were checked for obvious in-body auth/permission references. The only non-helper result without a direct auth check was request_talent_services(...); it delegates every item to request_talent_service(...), which checks auth.uid(), Talent role, profile ownership, and category eligibility before writing. This is not currently classified as an access bypass.
- All inspected SECURITY DEFINER functions use an empty search_path except two trigger-only functions (sync_talent_rating_stats, validate_review_insert) with search_path=public; both currently have no app-role EXECUTE grant. Keep them under review if grants or ownership change.

### Exposed public-schema relation check
- Read-only checks of effective anon/authenticated table privileges found no public table/view/materialized view that is both accessible to an app role and lacks RLS.
- The public schema view inventory returned no views. This reduces the risk of a view bypassing table RLS, but does not replace column-level grant review or function result review.

### Production Storage bucket inventory
- Private: ktp-documents, qris-payment-proofs, bank-transfer-payment-proofs, talent-media.
- Public: portfolios, promotions, qris-payment-display, hero-slides, hero, avatars, branding.
- Private KTP/payment evidence and Talent media buckets have owner/authorized-admin or approved-public-media policies. Talent media public-read policy calls the boolean helper; it must be tested with pending/rejected/approved rows and unrelated viewers.
- portfolios is a public bucket with a public SELECT policy. Treat every uploaded object there as intentionally public; do not store private, identity, or customer-only material in it. If portfolios should be selectively visible, migrate to a private bucket with a policy/signed-URL flow.
- avatars, branding, promotions, hero, hero-slides, and QRIS display are public-facing assets by current bucket configuration. Confirm no private content is uploaded to those buckets.
- Storage object RLS policies are permissive and combine with OR. The account-status guard is restrictive only where configured as a restrictive policy; verify its policy mode and behavior under anon/authenticated in Staging. Never assume one narrow policy cancels a broader permissive policy.

### Security Advisor and validation boundary
- Security Advisor was run read-only on Production. It reports 3 private-schema tables with RLS enabled and no policies (private.admin_accounts, private.admin_permissions, private.talent_service_locations), 5 anon-callable SECURITY DEFINER functions, and 60 authenticated-callable SECURITY DEFINER functions. The private tables are not exposed by public-schema grants; they are intentionally accessed through scoped helpers and should not receive broad policies.
- Leaked-password protection remains disabled in Auth project settings; not changed.
- No SQL writes, migrations, policy changes, bucket changes, function deployments, or project setting changes were performed in this follow-up.

### Required before release
1. Apply and verify the trigger-helper EXECUTE revoke migration in Staging, then Production through the approved release process.
2. Role-matrix test all five anon-callable functions and the 60 authenticated-callable functions, including disabled/suspended users and module Admin roles.
3. Test every private bucket with anon, owner, unrelated Customer/Talent, relevant module Admin, and Super Admin. Verify direct object URLs do not bypass authorization.
4. Confirm all content in public portfolios and other public buckets is intended for unrestricted public access.
5. Run Supabase Security Advisor after migration deployment and confirm the trigger-helper warning is gone; retain intentional boolean-helper findings with documented rationale.
6. Enable leaked-password protection in Auth settings after reviewing sign-in impact and rollout communication.
