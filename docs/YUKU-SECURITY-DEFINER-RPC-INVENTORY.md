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

This is a Git source audit. No SQL was executed against Staging or Production, no Supabase advisor was run, no functions were deployed, and no database data or policies were changed. The PR remains a draft and unmerged.