# YUKU Notifications, Chat & Report Moderation Audit

Date: 26 November 2026  
Repository branch: `feat/professional-services-categories`  
Production project: `yukuproduction` (`sbqvltqzzcsqzijgumld`)  
Scope: notifications, Web Push recipient routing, booking chat, Realtime Presence/Broadcast, reports and Admin moderation.

## Executive result

The feature branch contains important fixes for private booking-chat channels, permission-scoped Admin notifications and report-note privacy. However, read-only Production inspection shows these fixes are not yet deployed, and additional Production gaps remain. Treat this area as **P1 launch-blocked** until the forward migrations and negative tests are completed.

Production migration history currently ends at `20261125005419`; branch migrations dated 26–27 Nov are not present in the Production history.

## Verified Production findings

### P1 — Booking chat message read scope is too broad

Production `booking_messages_select_participants` permits `has_admin_permission('booking') OR participant`. A Booking-permission Admin can read message bodies across bookings. The policy also lacks the expected booking-status allowlist for participant reads. Branch migration `20261126200000_restrict_booking_chat_by_status.sql` adds status checks and narrows message writes/read receipts, but it is not applied to Production.

**Required:** remove blanket Admin message-body access; keep only booking participants for visible statuses. If Admin needs operational support, expose a purpose-built summary or a separately authorized case-review path, not unrestricted chat history.

### P1 — Direct report UPDATE bypasses audit RPC

Production grants authenticated users UPDATE on `reports_complaints.status`, `admin_notes`, and `resolved_by_admin_id`. RLS scopes the operation to Support permission, but a Support Admin can bypass `admin_resolve_report()`, its row locking, decision validation and audit log insertion.

**Required:** revoke direct UPDATE privileges on moderation fields from app roles. Keep `admin_resolve_report()` as the only write path, with permission check, valid transition rules, row lock and append-only audit. Verify UI does not write the table directly.

### P1 — Internal moderation notes leak to reporter notifications

Production `notify_on_report_status_change()` includes `NEW.admin_notes` in the notification sent to the reporter. Branch migration `20261127001000_stop_leaking_internal_report_notes.sql` removes it, but the migration is branch-only.

**Required:** apply a forward migration after Staging verification. Inspect notification and push payloads to ensure no internal note appears.

### P1 — Admin queue notifications are broadcast too widely

Production `notify_all_admins()` sends operational queue notifications to all active Admins, regardless of module permission. This can expose payment/payout references and amounts, Talent review activity, and report identifiers to Admins who do not own those workflows.

Branch migration `20261127001100_scope_admin_notifications_and_private_booking_chat.sql` maps known events to Finance/Talent/Support and fails closed for unknown titles. It is not applied to Production. Prefer stable event keys over display-title matching in the long-term design.

### P1 — Realtime private-channel authorization is missing in Production

Production catalog inspection found no policies on `realtime.messages`. The branch migration adds booking-chat Presence/Broadcast policies; the branch frontend also sets `config.private: true`. Neither is in Production migration history. The project-level “Allow public access” setting was not inspected.

**Required:** deploy participant-scoped Realtime policies, confirm client config in the deployed build, inspect the project-level setting, inventory all other topics before disabling public access, and test anon/unrelated/non-participant/suspended users.

### P1 — Chat body can appear in push notification preview

Production `notify_on_booking_message_insert()` copies up to 120 characters of chat text into the notification message. The push sender uses that message as the Web Push body, which may expose private text on a locked or shared phone. Branch migration 43 uses generic notification text.

**Required:** generic push copy only (“Anda menerima pesan baru. Buka YUKU untuk membaca.”); message text must remain inside authenticated chat.

## Branch fixes already present

- `20261126200000_restrict_booking_chat_by_status.sql`: participant/status-gated chat rows and limited message/read-receipt column grants.
- `20261127001000_stop_leaking_internal_report_notes.sql`: report notification excludes internal notes.
- `20261127001100_scope_admin_notifications_and_private_booking_chat.sql`: permission-scoped Admin notifications plus private booking-chat Presence/Broadcast policies.
- `src/components/chat/BookingChatModal.tsx`: private Realtime channel config.

These are source-level changes only. They have not been applied to Production or validated in a live Staging environment.

## Staging negative/positive test matrix

1. Booking Admin, Finance Admin, Talent Admin and Support Admin cannot read chat bodies unless they are actual booking participants; Super Admin access must be explicitly documented and tested.
2. Unrelated Customer/Talent cannot read or send messages for another booking.
3. Participants can read only permitted statuses; cancelled, expired and rejected bookings are closed; completed/disputed remain read-only as intended.
4. Participants cannot forge message sender, booking ID, message ID, timestamp or read state; only recipient read receipt can change.
5. Support Admin cannot directly UPDATE report status, internal notes or reviewer ID; approved RPC records actor, timestamp, old/new state and decision note.
6. Reporter sees their own report/status only; internal Admin notes never appear in report response, notification, metadata or push.
7. Finance/Talent/Support queue notifications reach only matching active Admins and Super Admin; inactive Admins and wrong-module Admins receive none; unknown event key fails closed.
8. Anonymous, unrelated user, non-participant Admin and suspended account cannot join/publish booking Presence/Broadcast; both active participants can.
9. Push payload contains no chat body, exact location, payment proof, internal moderation notes or sensitive booking metadata; test Android Chrome with app closed and device locked.
10. Duplicate report/chat/status events do not create duplicate or misdirected notifications.

## Validation boundary

Production checks were read-only catalog, policy, grant and function-definition inspection. No report, chat, notification, user or device rows were read. No Production DDL/DML, migration, policy, setting, Edge Function deployment, push send, or PR merge was performed. Automated Staging and device-level tests remain outstanding.


## Branch remediation update — 26 Nov 2026

The feature branch now includes additional source-level safeguards:

- Booking chat SELECT no longer has the blanket `is_admin()` bypass; only Customer/Talent participants for the allowed booking states can read message bodies.
- The push sender detects booking-chat notifications from `booking_id + message_id` metadata and sends generic OS notification text instead of the stored message body. This protects lock screens even if an older Production trigger still writes a message preview.
- Push status is now checked against the server-side endpoint owner and current account, rather than treating any local browser subscription as belonging to the currently signed-in user.
- The push toggle refreshes when the authenticated user ID changes.

Still unresolved:
- Production has not received these branch changes.
- Direct UPDATE grants on report moderation columns still require a forward migration to revoke them while preserving the `admin_resolve_report()` RPC's SECURITY DEFINER owner path.
- Staging tests for chat participant isolation, lock-screen payload, account switching and report direct-write denial remain outstanding.
- No build, Deno check, automated test, push send or live Realtime test has been run for this commit.
