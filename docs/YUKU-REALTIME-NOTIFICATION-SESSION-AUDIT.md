# YUKU Realtime, Notification & Session Isolation Audit

Date: 26 November 2026
Branch: `feat/professional-services-categories`

## Summary

The review covered NotificationBell, booking chat, notification and chat RLS, push subscriptions, the push Edge Function, AuthContext, account-status restrictive policies, and Supabase Realtime authorization behavior.

## Implemented: prevent notification data crossing account switches

File: `src/components/common/NotificationBell.tsx`  
Commit: `65f7f6486de28333ecbb825eecf4383b1360b6d3`

Before the fix, a notification query started for account A could finish after the app switched to account B and still write A's rows into the mounted NotificationBell component. This was a shared-device privacy risk under a fast sign-out/sign-in or account-switch race.

The component now:
- Tracks the active user ID and a monotonically increasing request ID.
- Clears the previous account's notification list and seen-ID cache when userId changes.
- Ignores late responses from an older account or superseded request.
- Prevents stale request finalizers from changing the loading state of a newer account.
- Invalidates pending requests when the Realtime subscription is cleaned up.

## Confirmed protections

### In-app notifications

- `notifications_select_user` is narrowed by migration 54 to `auth.uid() = user_id`; the legacy `is_admin()` alternative was removed from the effective policy.
- The notification update trigger permits ordinary users to change only `is_read`; title, body, type, and recipient are immutable to non-Super Admin users.
- The frontend query also filters by the signed-in user ID.
- `notifications` is in the `supabase_realtime` publication. Postgres Changes delivery remains subject to the table's RLS.
- Push subscription records are private: RLS enabled, browser-role privileges revoked, service_role only.
- Push subscribe/unsubscribe verifies the caller's JWT and scopes writes/deletes to that authenticated user. The send action uses a separate webhook secret and resolves the notification row server-side before sending to that recipient's subscriptions.

### Booking chat messages

- Message SELECT/INSERT policies check that the authenticated user is a booking participant and that the booking is in an allowed chat status.
- Message INSERT privileges are limited to `booking_id`, `sender_id`, and `message`.
- UPDATE privileges are limited to `is_read`; participants cannot rewrite message body, sender, booking relation, ID, or timestamp through the read-receipt path.
- Booking chat table is in `supabase_realtime`; Postgres Changes are filtered by booking ID and protected by the message table's RLS.
- The chat UI restricts message sending to paid/live statuses and keeps completed/disputed threads read-only.

### Account/session boundary

- Migration 20261124081950 installs restrictive active-account policies on RLS-enabled public tables and Storage objects; suspended/banned users cannot continue ordinary Data API access with a stale JWT.
- A database write trigger also rejects inactive-account writes, including through SECURITY DEFINER paths.
- AuthContext rechecks account status and Admin permissions on focus and signs out globally when it detects a suspended/banned account.
- Admin Edge Functions verify the token with `auth.getUser` and separately check the actor's active database account and Super Admin permission before privileged actions.

## Remaining Realtime privacy issue — public booking chat channel

The frontend currently creates `booking-chat:<booking UUID>` without `config.private: true`. That channel carries Presence and a `typing` Broadcast payload containing user ID and typing state. The chat message body itself is not sent through this Broadcast; it is sent through the RLS-protected `booking_messages` table.

However, because Presence/Broadcast channel authorization is not configured in the repository, anyone able to join the public topic may be able to observe participant presence/typing metadata if they know or obtain the booking UUID. Booking UUIDs are not a substitute for authorization.

Recommended remediation before treating chat presence as private:
1. Create RLS policies on `realtime.messages` for SELECT and INSERT, restricted to the exact `booking-chat:<booking UUID>` topic, authenticated booking participants, and only the intended `broadcast`/`presence` extensions.
2. Set the frontend channel to `config: { private: true }`.
3. Disable Realtime Settings → Allow public access at the project level, after inventorying every other channel in the app. This is a project-wide setting and cannot be safely inferred or changed by a repository migration alone.
4. Test that an unrelated authenticated user, anonymous visitor, and Admin without a participant role cannot join or send Presence/Broadcast events; both booking participants can.
5. Ensure a channel reconnect after account suspension is rejected. Realtime authorization is evaluated on connect and cached for the connection; it is not a substitute for per-message session revocation.

This item is deliberately left as a release blocker rather than adding a partial private-channel change that could break chat or falsely claim that the project-wide public-access setting has been changed.

## Session revocation considerations

Supabase access tokens are JWTs and remain valid until expiry even after a refresh-token/session revocation. Realtime channel authorization is cached for the duration of a connection and refreshed when the client reconnects or sends a new JWT. Therefore:
- database RLS and write triggers remain the primary guard for normal data operations;
- sensitive RPCs and server-side Edge Functions must check current account status;
- active WebSocket Presence/Broadcast connections need explicit reconnect/revocation handling;
- session lifetime and JWT expiry should be reviewed in Supabase Auth settings, and strict session_id validation should be considered for particularly sensitive operations.



## Fixed: internal report notes were included in user notifications

Finding:
- The original `notify_on_report_status_change()` concatenated `reports_complaints.admin_notes` into the notification message sent to `reporter_id`.
- `admin_notes` is an Admin moderation field written by `admin_resolve_report()`; it must not be exposed as a general user-facing notification.

Branch-only fix:
- Migration `20261127001000_stop_leaking_internal_report_notes.sql` replaces the trigger function.
- The reporter now receives only the report status and report/booking identifiers.
- Internal `admin_notes` are not copied into the notification body or metadata.
- Direct execution of the trigger helper remains revoked from app roles.

Commit: `be5d647315802a4f5ed0c524dd115a5d4f9ee8b5`.

## Additional follow-up

- Push toggle state is currently keyed to `isAuthenticated` rather than `userId`; on a direct account switch where both users remain authenticated, the device subscription status may remain stale until a later refresh. This is a UI correctness issue, not evidence of cross-account subscription access: the Edge Function scopes subscription changes to the JWT user and refuses endpoint reassignment to another account.
- The booking chat Presence/Broadcast public-channel issue remains a release blocker until the project-wide Realtime public-access setting and channel authorization are configured and tested.

## Validation boundary

The NotificationBell fix was committed and its source will be re-fetched for static verification. The chat/message and notification policies were inspected in the final migration chain. No Realtime Settings were changed, no private-channel migration was applied, no database was queried or modified, no functions were deployed, and no live WebSocket or cross-account tests were performed. Staging tests and a project-level Realtime configuration review remain required.


## Fixed: Admin operational notifications now follow module permissions

Finding:
- The legacy `notify_all_admins()` sent Finance, Talent, and Support queue notifications to every active Admin, regardless of their assigned module permission.
- This exposed unnecessary operational metadata (such as booking references, payment amounts, payout identifiers, and report identifiers) to Admins who did not own that workflow.

Branch-only fix:
- Migration `20261127001100_scope_admin_notifications_and_private_booking_chat.sql` maps each known notification title to its required permission:
  - Finance: QRIS, Xendit settlement, payout requests, refunds.
  - Talent: KTP review and Talent service review.
  - Support: incident reports.
- Only active Admins with the matching permission, plus Super Admin, receive the notification.
- Unknown notification titles fail closed instead of broadcasting to all Admins.
- Professional-service application notifications were already limited to active Talent-permission Admins and Super Admin in migration `20261126182000_professional_service_application_notifications.sql`.

## Fixed: booking chat Presence and typing use a private authorized channel

Finding:
- Booking chat previously joined `booking-chat:<booking UUID>` as a public Realtime channel.
- Presence and typing broadcasts were not protected by booking-participant authorization.

Branch-only fix:
- Migration `20261127001100_scope_admin_notifications_and_private_booking_chat.sql` adds SELECT/INSERT policies on the existing `realtime.messages` table.
- Policies require an exact booking-chat topic, authenticated active account, and Customer/Talent participant relationship.
- Presence is allowed only while the chat is visible; typing Broadcast is allowed only while the booking is in a sendable status.
- The frontend now sets `config.private: true` for the booking chat channel.
- Postgres Changes on `booking_messages` continue to rely on that table's own RLS policies; these new policies govern only Broadcast/Presence.

## Validation still required

Static source checks can verify the permission mapping, fail-closed behavior, topic matching, participant checks, status constraints, and private client configuration. They cannot prove the live project's Realtime settings or any pre-existing dashboard-created permissive policies.

Required Staging checks:
1. Confirm no broad permissive policies exist on `realtime.messages` that OR-bypass the new participant policies.
2. Anonymous client cannot join the private booking chat channel.
3. Unrelated Customer/Talent and Admin without a booking-participant role cannot join or publish.
4. Both booking participants can receive Presence; only active-session statuses allow typing Broadcast.
5. Suspended account cannot join after reconnect/token refresh; already-open sockets need a separate revocation/reconnect test.
6. Finance/Talent/Support Admins receive only their own module notifications; Super Admin receives all; disabled Admin receives none.
7. Verify push delivery follows the same scoped in-app notification recipient row.
8. Review the project-level Realtime setting. Disabling public access globally is a separate project setting and was not changed by this repository migration.

No SQL was run against Staging or Production, no project-level Realtime setting was changed, and no Edge Function was deployed.


## Production read-only inspection and Security Advisor snapshot

Read-only checks against the connected Supabase project on 26 November 2026:
- `pg_policies` returned **zero policies** for `realtime.messages`.
- Security Advisor reported 5 anonymous-callable SECURITY DEFINER functions, 60 authenticated-callable SECURITY DEFINER functions, 3 private-schema tables with RLS enabled and no policies, and leaked-password protection disabled.
- The 60 authenticated-callable findings are not all defects: many are intended authenticated RPCs whose function bodies enforce ownership or module permission. They require function-by-function authorization review, not blanket revocation.
- The 5 anonymous-callable findings include narrow boolean helpers used by RLS/Storage policies (`can_read_talent_media_object`, `has_admin_permission`, `is_super_admin`, `is_talent_publicly_visible`). Their exposed return values and call paths need to remain minimal and verified. The fifth finding, `guard_talent_media_moderation_fields()`, is a trigger-only helper and should not be a direct API endpoint.

Branch-only remediation:
- Migration `20261127001200_revoke_talent_media_trigger_helper_execute.sql` revokes direct execution of `guard_talent_media_moderation_fields()` from PUBLIC, anon, and authenticated. The database trigger can still call its trigger function.
- This migration has not been applied to Production.

Other Advisor findings:
- Three tables in the non-exposed `private` schema have RLS enabled without policies: `private.admin_accounts`, `private.admin_permissions`, and `private.talent_service_locations`. This may be intentional defense-in-depth because application access is through tightly scoped SECURITY DEFINER helpers; do not add broad policies without reviewing every call path.
- Leaked-password protection is disabled. This is an Auth project setting and was not changed.
- Advisor snapshot is a point-in-time Production inspection; it is not a substitute for staging role-matrix tests.

The absence of `realtime.messages` policies in Production confirms that the private booking-chat authorization migration remains a deployment blocker. Project-level Realtime public-access configuration was not inspected or changed.


Production privilege verification:
- A read-only `has_function_privilege` query confirmed `anon` and `authenticated` can directly execute `public.guard_talent_media_moderation_fields()` in the connected Production database.
- The same query confirmed `can_read_talent_media_object(text)` is executable by anon/authenticated. That second grant is intentional for Storage RLS evaluation, and the helper returns only a boolean; it is not treated as equivalent to the trigger-helper defect.

Realtime project setting requirement:
- Current Supabase documentation states that project-level Realtime Settings → **Allow public access** must be disabled to enforce private-only channels. The database migration and `private: true` client option do not change that project-level toggle.
- The setting was not inspected or changed in this audit. Production remains unverified until an authorized operator checks it and disables public access after confirming all app Realtime channels are private/authorized.


## Account-session enforcement verification — 26 November 2026

### AuthContext source review correction

The current AuthContext does in fact force a role/account-status reload on both `TOKEN_REFRESHED` and `USER_UPDATED` events, and also rechecks on window focus. The same-user fast path is bypassed for those events. The earlier note that token refresh did not trigger a status recheck would therefore be inaccurate; no AuthContext change is required on that point.

If the user-row lookup fails, AuthContext retains the Supabase identity but clears role/Admin access and account status. This is fail-closed for role-gated UI, while database RLS remains the actual data-access boundary.

### Production read-only checks

A read-only query against Production confirmed:
- `private.is_current_user_active()` exists.
- The account-status write guard trigger is installed on 45 public tables and on `storage.objects`.
- 44 restrictive `account_status_active_guard` policies exist on public tables; the users table is intentionally excluded so the owner can read their own status and AuthContext can detect suspension.
- One restrictive account-status guard exists on Storage objects.
- The snapshot contained 7 non-expired Auth sessions and 0 sessions belonging to Auth users with a currently active `banned_until` timestamp. These are aggregate counts only; no user identifiers or session tokens were queried.

This confirms the database guard is present in Production at the time of inspection. It does not prove that already-open Realtime sockets are immediately disconnected; those remain subject to the previously documented Realtime reconnect/revocation tests.

### Edge Function deployment configuration defect fixed in branch

Finding:
- `xendit-webhook` is an external-provider callback. Its handler authenticates with the Xendit `x-callback-token` using a constant-time comparison and does not receive a Supabase user JWT.
- The source comment instructed deployment with `--no-verify-jwt`, but `supabase/config.toml` had no explicit `[functions.xendit-webhook] verify_jwt = false` entry. The default is `true`, so a normal deployment using the repository config could reject Xendit callbacks before the handler runs.

Branch fix:
- Added `[functions.xendit-webhook]\nverify_jwt = false` with a comment documenting that the handler verifies the provider callback token itself.
- User-facing `create-checkout`, `account-management`, and `admin-management` remain on JWT verification (the default is true; account-management is explicitly true).
- `yuku-push` remains verify_jwt=false because it validates user JWTs itself for subscribe/unsubscribe and a separate webhook secret for send.

The Supabase documentation confirms that `verify_jwt` defaults to true and that external webhooks without a Supabase JWT require it to be disabled while validating the provider's own signature/secret in the handler. See <https://supabase.com/docs/guides/functions/function-configuration> and <https://supabase.com/docs/guides/functions/auth>.

### Validation still required

1. Confirm the deployed Production Edge Function config for `xendit-webhook` matches the branch config; this audit did not inspect or change the deployed function setting.
2. Deploy the branch config only through the approved Staging/Production release flow and test a signed Xendit callback without a Supabase JWT, plus missing/incorrect callback-token rejection.
3. Test account suspension with pre-existing sessions on multiple devices: Data API read/write, Storage, RPCs, Edge Functions, and already-open Realtime channels.
4. Test account-management rollback when Auth ban or audit-log write fails.

No Auth configuration, sessions, database rows, migrations, Edge Functions, or Production settings were changed in this follow-up.
