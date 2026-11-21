# YUKU Admin Account Management & Role-Based Access Plan

Status: design plan only. No database schema, Auth users, staging, or Production data is changed by this document.

## Goals

- Allow an authorized Super Admin to invite and manage additional Admin accounts.
- Give every operator an individual Supabase Auth account; never share credentials.
- Require verified TOTP MFA (AAL2) before any Admin console or privileged action.
- Enforce permissions in trusted server/database code, not only by hiding frontend tabs.
- Preserve the existing manual provisioning path until a fully tested replacement exists.

## Existing constraints discovered

- The current role enum is `customer | talent | admin`; there are no scoped Admin roles in that enum.
- Existing Admin RPCs and many RLS/Storage policies rely on `public.is_admin()`.
- `public.provision_admin_user(UUID)` is intentionally restricted to trusted database-owner roles and is not callable by `authenticated` users.
- The Admin MFA work is currently isolated on `feature/admin-mandatory-totp-mfa`; its database AAL2 migration is still a draft and must be tested in staging after an Admin factor is enrolled.

## Proposed account lifecycle

1. Super Admin enters an invite email and selects a role/permission set in the Admin dashboard.
2. A trusted server-side endpoint validates the caller's authenticated identity, AAL2, active Super Admin status, and permission to invite.
3. The endpoint creates/invites the Auth user using server-side credentials only. Service-role secrets must never be shipped to the browser.
4. The new user must accept the invite, set their own password, and enroll/verify TOTP before any Admin access.
5. A trusted database function provisions the Admin role and permission assignments only after validating the invitation and authorized actor.
6. Super Admin can suspend or revoke access. Existing sessions must be revoked/invalidated as part of the offboarding workflow.

## Proposed permission model

Use a separate permission model rather than expanding the global `user_role_type` enum with department names.

Initial role templates to review:
- Super Admin: full access, invite/manage Admins, manage permissions.
- Finance Admin: payout, refund, financial review.
- Talent Admin: talent profiles, KTP review, service review.
- Booking Admin: booking operations and disputes.
- Support Admin: reports and customer support.

These templates are starting points only. Before enabling them, map every Admin UI action, RPC, RLS policy, Storage policy, and Edge Function to explicit permissions. Existing `is_admin()` checks cannot simply be replaced with frontend role checks.

## Security requirements

- Deny by default; each privileged action checks a named permission server-side.
- Require AAL2 for all Admin operations, not just dashboard entry.
- Never trust user-editable `user_metadata` for roles or permissions.
- Never expose Supabase service-role keys to the client.
- Keep the existing database-owner-only provisioning function restricted.
- Prevent deleting, suspending, or demoting the last active Super Admin.
- Record invite, role/permission changes, suspension, revocation, and sensitive Admin actions in an append-only audit trail.
- Use individual accounts and avoid shared passwords or shared authenticator secrets.
- Provide a recovery process (for example, a second enrolled authenticator on a separate device) before production rollout.

## Safe implementation order

1. Finish and validate mandatory Admin TOTP on a dedicated staging Worker and Supabase Staging.
2. Confirm the current Admin account and designate it as the initial Super Admin.
3. Design and test permission tables and server-side permission-check helpers in staging.
4. Build the Admin management UI and a trusted invite/provision endpoint.
5. Test privilege escalation, revoked sessions, last-Super-Admin protection, and every affected RPC/RLS/Storage path.
6. Only after a separate explicit approval, plan a Production rollout.

## Explicit non-goals for this phase

- Do not modify Production.
- Do not merge the draft PR.
- Do not create or promote any Admin account automatically.
- Do not apply a database migration until staging isolation, initial Super Admin identity, and the complete permission map are confirmed.
