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

## Validation boundary

The NotificationBell fix was committed and its source will be re-fetched for static verification. The chat/message and notification policies were inspected in the final migration chain. No Realtime Settings were changed, no private-channel migration was applied, no database was queried or modified, no functions were deployed, and no live WebSocket or cross-account tests were performed. Staging tests and a project-level Realtime configuration review remain required.
