# YUKU End-to-End Transaction Audit

Tanggal: 26 November 2026  
Branch: `feat/professional-services-categories`  
Scope: booking creation, Xendit checkout/callback, manual QRIS, settlement, financial ledger, escrow release, dispute/refund and payout hand-off.

## Executive summary

The existing activity-booking payment path has several sound controls: the booking amount is read from the database, Xendit and manual QRIS compete for one locked payment route, settlement locks the booking row, the financial ledger is generated idempotently, and escrow release skips bookings with open/investigating reports.

This does **not** mean the end-to-end payment path is production-validated. Xendit functions explicitly state that they have not been tested against the Xendit sandbox. There is no durable provider-event/invoice receipt ledger in the reviewed flow, and the SQL file named as a payment-route test contains scenario comments rather than executable assertions.

## Branch-only code fixes made in this audit

1. `supabase/functions/create-checkout/index.ts`
   - Checkout now requires `account_status = active`; previously it also allowed `pending_verification`.
   - The minimum remaining invoice lifetime is checked before claiming the Xendit payment route. A request with less than 60 seconds remaining no longer locks the route before returning an error.
   - Invalid/non-finite remaining time is rejected.
2. `supabase/functions/xendit-webhook/index.ts`
   - Validates canonical UUID format in `external_id`.
   - Requires a non-empty invoice ID, IDR currency, and a positive safe-integer callback amount before settlement.
   - Passes the validated invoice ID as the provider charge reference instead of silently accepting a missing ID.

These are source changes on the feature branch only. No function deployment or Production configuration change occurred.

## Flow review

### 1. Booking creation
- `create_booking` calculates the amount server-side and creates `pending_payment`; the booking RPC does not collect money.
- It enforces customer/Talent eligibility, activity/talent service availability, schedule constraints, duration cap, booking lead time, and one pending payment booking guard.
- The legacy contract is hourly/activity-shaped and cannot safely represent professional service units per session/day/project without a new shared booking snapshot contract.

### 2. Checkout and payment route
- Xendit checkout obtains caller identity from the JWT and reads the booking with service role, then verifies ownership, pending status, feature flag and DB-derived amount.
- `claim_booking_payment_route` locks the booking row and prevents Xendit/manual QRIS route switching.
- Fixes in this audit close two checkout defects: pending-verification accounts were allowed to initiate checkout, and the route could be claimed before the minimum invoice lifetime check.
- Remaining gap: checkout does not persist a durable invoice intent/receipt row before calling Xendit. A provider invoice may exist while the client receives a network error. Duplicate external_id recovery helps, but should be backed by a persisted invoice record and reconciliation job.

### 3. Xendit callback
- Callback token is compared in constant time.
- Only PAID/SETTLED statuses proceed.
- Booking amount is authoritative and settlement is delegated to a service-role RPC.
- Fixes now reject non-IDR, missing invoice ID, missing/non-numeric/unsafe amount and malformed booking external ID.
- **P0 follow-up:** no separate provider event/invoice receipt table with unique provider + invoice/event identity was found. Booking-level idempotency prevents duplicate ledger rows, but it is not a complete payment-attempt audit trail. Add a receipt table with unique provider invoice/event IDs, payload hash or redacted payload, received/processed timestamps, processing result, and retry state. Do not store callback secrets.
- **P0 follow-up:** callback currently trusts the callback's `external_id`, status and amount after token verification; it does not fetch the invoice from Xendit to independently confirm final status, invoice ID, external ID and currency. Add provider-side invoice verification or document an approved signed-callback verification model with tests.
- Preserve raw callback data only as needed for audit; review access, redaction, retention and size limits.

### 4. Settlement and ledger
- `settle_booking_payment` locks the booking row and rejects expired or invalid states.
- It uses a unique booking payment row and upserts `settled_held`; the financial trigger creates commission, Talent earning and referral rows with independent `ON CONFLICT DO NOTHING` inserts.
- The route lock prevents Xendit and manual QRIS from both becoming the selected route.
- A duplicate callback after the booking has already settled returns success without creating another ledger row. This is useful idempotency, but provider event identity still needs its own receipt ledger.
- Add integration tests for callback/manual approval race, duplicate callback, late callback after expiry, mismatched route, amount/currency mismatch, and payment row already present in failed/pending states.

### 5. Manual QRIS
- Submission locks the booking, checks claimed amount against database gross amount and claims the manual QRIS route.
- Finance approval locks submission and booking, verifies route, and updates the payment row to `settled_held`, which triggers ledger generation.
- Existing branch hardening limits proof uploads to pending manual QRIS bookings and prevents another pending proof from being created.
- Add tests for concurrent Finance approvals, duplicate transfer reference, proof replacement after rejection, late approval after expiry/cancellation, and callback/manual approval races.

### 6. Escrow release and disputes
- Migration 20 is the effective policy in the ordered chain: escrow becomes available immediately after completion, not 24 hours later.
- Migration 33 schedules `process_escrow_release()` every minute.
- Release locks eligible completed bookings with `SKIP LOCKED` and excludes bookings with open/investigating reports. It updates Talent earning, referral reward and payment status together.
- Migration 21's completion RPC requires both Customer and Talent confirmations. This is appropriate for a completed time-bound session, but does not define acceptance for a deliverable/project.
- Migration 10 still contains older 24-hour comments/logic. Update stale comments and notification copy so the policy is unambiguous. Do not change the effective immediate-release policy without Product/Finance approval.
- For project work, do not reuse generic `completed` until deliverable submission, review window, revision, acceptance and dispute rules are implemented.

### 7. Refund and reconciliation
- Refund records are not directly insertable by authenticated clients; trusted workflows create them.
- Customer cancellation and Talent cancellation are tied to start-time/hour thresholds and current full-refund assumptions.
- Financial reversal logic is booking-keyed and protects allocated/paid earnings. Partial refund allocation across Talent share, platform commission, referral, reserved payout and already-paid payout remains incomplete.
- No professional-service partial refund or project cancellation should be enabled until Finance approves a deterministic ledger allocation and reconciliation design.

## Test coverage reality

- `supabase/tests/stage_d_payment_route_lock_tests.sql` currently contains expected invariants and references to execution notes; it is not a self-contained executable test suite.
- Xendit Edge Function source comments state sandbox testing has not been completed.
- Source review does not establish migration replay success, provider contract compatibility, cron execution, or real payment settlement.
- Required Staging tests: route race, duplicate checkout, duplicate callback, wrong currency, wrong/missing amount, callback invoice mismatch, expired booking callback, QRIS duplicate review, callback/manual race, ledger uniqueness, dispute hold, immediate release, payout allocation and refund reconciliation.

## Required release gates

1. Run Xendit sandbox end-to-end tests and record provider callback payload schema/version.
2. Add durable payment attempt/provider receipt records and reconciliation for invoice-created-but-client-failed cases.
3. Add executable Staging tests for all concurrency and failure scenarios above.
4. Verify the complete ordered migration chain and cron job in Staging; compare Staging/Production function definitions and RLS before any Production change.
5. Keep professional checkout disabled until shared booking snapshots, unit-aware completion, cancellation/refund, escrow acceptance and finance reconciliation are approved and tested.

## Safety boundary

This is a branch source audit and two branch-only Edge Function changes. It did not call Xendit, deploy Edge Functions, run SQL, alter Supabase, enable payment flags, merge the PR, or write Production data.


## Booking privacy, participant access & communication follow-up — 26 November 2026

Scope: static review of branch migrations and React client code. No live RLS queries or Realtime session tests were run.

### P1 — Reporter can potentially read internal Admin report notes

- Migration 49 scopes `reports_select_reporter_or_admin` to `auth.uid() = reporter_id OR has_admin_permission('support')`.
- This is row-level filtering only. It does not hide individual columns from the reporter.
- `reports_complaints.admin_notes` is an internal moderation field, but `BookingHistoryPage.tsx` directly selects `admin_notes` along with the reporter's own report row.
- Therefore, unless a separate column-level privilege restriction exists in the effective database (not established by this source review), the reporter can read the internal Admin note through the Data API. The prior migration `20261127001000_stop_leaking_internal_report_notes.sql` removes notes from status-change notifications, but does not itself prevent direct table SELECT.
- Treat as a P1 privacy issue. Verify effective column grants in Staging/Production before claiming exploitability.
- Safe remediation direction: revoke authenticated table-wide SELECT and grant only explicit user-safe columns; provide Support Admin notes through a narrowly permission-checked Admin RPC or a private schema function. Update BookingHistoryPage to stop selecting `admin_notes`. Preserve Support Admin workflow through the scoped RPC. Do not rely on UI hiding.

### Booking and meeting-location visibility

- `bookings` RLS in migration 54 allows the Customer and Talent parties to select their booking row; Super Admin is separately allowed. Booking Admin receives a minimal scoped summary RPC, not unrestricted booking-table SELECT.
- Booking rows include `meeting_location_name` and `meeting_location_address`. Both participants can therefore read the stored meeting location while the booking row is visible, including pending-payment states. This is consistent with the current product goal of letting both parties coordinate distance/location before finalizing an offline arrangement, but it means users must not put private home/access details in the location field before they are ready to share them.
- No phone number is included in the `bookings` table definition inspected. Direct contact details may still exist in user/profile records; verify those separately before claiming no contact-data exposure.
- The client displays the meeting location in the booking chat header. Keep exact GPS Talent coordinates separate from this user-entered meeting location.

### Booking chat protections found in branch source

- Chat message SELECT is restricted to booking participants and allowed conversation states; terminal cancelled/expired states are not readable. Completed/disputed conversations remain readable.
- INSERT requires sender_id = auth.uid(), participant membership, and a writable paid/active status.
- Authenticated clients cannot insert forged id/read-state/timestamp columns; column grants permit only booking_id, sender_id, message.
- Participants cannot edit message content; UPDATE is limited to the `is_read` receipt field and only for the other participant's messages.
- The client uses a private Realtime channel `booking-chat:<booking UUID>`. The UUID is a lookup key, not an authorization secret. Migration `20261127001100_scope_admin_notifications_and_private_booking_chat.sql` adds participant/account/status checks for Broadcast and Presence.
- Production previously had zero policies on `realtime.messages` in the read-only snapshot. These branch policies must be deployed and tested before private Presence/typing features can be considered protected in Production. Also verify project-level Realtime public access is disabled after inventorying all channels.

### Financial row access

- Migration 49 scopes payment rows to booking participants or Finance Admin; refunds to the Customer or Finance Admin. Talent does not receive direct refund row access.
- `BookingHistoryPage.tsx` reads refunds by booking IDs, but RLS remains the effective boundary. It also reads payment-method settings only to determine which payment UI is available.
- Do not expose provider webhook payload history, provider charge IDs, or full payment records to general profile pages. Current client query shown in this page reads only refund amount/status/provider_refund_id for the Customer's own booking set.

### Required verification and remediation

1. Query effective `information_schema.column_privileges` / `has_column_privilege` for `reports_complaints.admin_notes` as anon, authenticated, Support Admin, and Super Admin. Then test reporter direct SELECT and Admin notes RPC.
2. Remove `admin_notes` from BookingHistoryPage query and user-facing type/model.
3. Add a Support-scoped Admin RPC to read internal notes only if the Admin UI needs them; keep function SECURITY DEFINER narrowly scoped, fixed search_path, authenticated caller check, active Support permission, and explicit grants.
4. Test two unrelated booking participants cannot read each other's booking, messages, payment/refund rows, reports, or meeting location.
5. Test the two participants can read their own booking location and messages only in intended statuses; verify chat closes after cancellation/expiry and is read-only after completion/dispute.
6. Test Realtime private topic authorization as anon, unrelated Customer, booking Customer, booking Talent, disabled account, Booking Admin, Support Admin, and Super Admin.
7. Verify private Realtime project setting and inspect all channels before disabling public access globally.
8. Verify no phone/email/precise GPS is included in participant chat metadata or booking summaries unless explicitly needed.

### Validation boundary

This is a source-level finding. No live column privilege query, RLS test, Realtime authorization test, database migration, project setting change, or Production data change was performed. Do not state that the `admin_notes` exposure is confirmed in Production until effective column grants and a reporter-session SELECT are tested.


## Booking approval, pre-confirmation chat, schedule/location changes & extra duration — 26 November 2026

### Confirmed current lifecycle

1. Customer creates a booking using `create_booking`. Server validates active/eligible Customer and Talent, approved active legacy service, booking mode, schedule/availability, rate, duration, and slot conflict rules.
2. New booking is `pending_payment`; current legacy flow requires start time at least 2 hours ahead and duration > 0 up to 5 hours. The payment route/checkout is a separate step.
3. After payment settlement the booking moves to `paid_held_in_escrow`.
4. In `paid_held_in_escrow`, both participants can already open the booking chat. Talent can discuss distance, meeting point, and readiness with the Customer before accepting the booking.
5. Talent acceptance is a guarded transition to `confirmed_by_talent`; the Talent dashboard updates only the matching booking owned by that Talent and currently in `paid_held_in_escrow`.
6. Talent starts the session by transitioning `confirmed_by_talent` to `in_progress`.
7. Either participant can submit their completion confirmation; the booking completes only after both have confirmed.
8. Customer cancellation is through `request_customer_cancellation`, not direct table mutation. It is allowed in pending_payment, paid_held_in_escrow, or confirmed_by_talent, before session start. Talent cancellation uses its own RPC and requires a full refund request.

### What works for the user's coordination requirement

- Chat is available before Talent approval, specifically in `paid_held_in_escrow`. This gives both parties a channel to clarify distance/location before Talent confirms.
- Chat remains writable in `paid_held_in_escrow`, `confirmed_by_talent`, and `in_progress`; after completion or dispute it is read-only.
- The client UI and database policy both enforce the relevant state rules. The UI alone is not the security boundary.

### P1 product/flow limitation — no safe booking edit or extra-time flow

- No supported booking extension/additional-duration RPC or UI action was found in the inspected source. The original booking snapshots duration, end time, hourly rate, gross, platform fee, and Talent share.
- Direct authenticated booking INSERT is revoked; creation is through the server RPC. Authenticated UPDATE grants are restricted to status/cancellation fields, not schedule/location/price.
- Once paid, database trigger guards prevent changes to start/end time, duration, and meeting location/address. This is correct protection against unilateral post-payment edits.
- Consequence: if the parties agree in chat to move the meeting point, change the schedule, or extend the session, the agreement is not yet represented in a new authoritative booking/payment record. They must not settle an extra amount outside YUKU.
- Pending-payment bookings also do not expose a supported edit action. Current safe workaround is cancel (where allowed) and create a new booking with the corrected schedule/location; verify payment-route/refund state before any retry.
- Do not implement a simple `duration_hours += x` update or accept cash/direct transfer for extra time. That would leave escrow, fees, Talent earnings, availability, cancellation policy, and dispute snapshots inconsistent.

### Recommended target flow (design only; not implemented)

1. In the paid-held stage, Customer and Talent use the existing chat to discuss whether the distance and meeting point work.
2. Talent chooses Confirm or Decline/Request Customer cancellation using explicit in-app actions. Do not interpret chat messages as approval.
3. If the location/time needs a change, create a structured change request with old/new values, actor, timestamp, reason, and both-party consent. Revalidate availability and price before it becomes effective.
4. If additional time is requested, create an add-on linked to the original booking with quantity, rate snapshot, platform fee, Talent share, availability extension, payment route, and idempotency key. Both parties accept it and Customer pays through YUKU before the added time begins.
5. Never overwrite the original booking's financial snapshot. Keep original and add-on ledgers separately linked to one booking aggregate.
6. If the current financial/escrow implementation cannot safely support changes/add-ons, decline the change in-app and ask the parties to cancel/rebook through the existing supported workflow.

### Further tests before enabling/expanding

- Verify the chat is usable for both participants in paid_held_in_escrow before Talent approval; unrelated users and inactive accounts must be denied at both Data API and Realtime layers.
- Verify Talent can accept only own paid-held bookings; duplicate/late acceptance and Customer/Talent races must be harmless.
- Verify Customer can cancel before session start under the policy and cannot use cancellation after start; Talent cancellation must atomically create the required full refund request.
- Verify booking schedule/location/rate/fee/share cannot be modified by either participant, including through direct REST requests.
- Verify no route allows additional hours or location changes to be paid outside the YUKU checkout.
- Test expiry, late payment callback, cancellation race, and acceptance race in Staging.

### Validation boundary

Source review only. No Staging runtime tests, payment provider tests, database migrations, Production data/config changes, or deployments were performed. The recommended change-request and add-on flows are design recommendations, not implemented functionality.


## Production catalog validation — payment, refund and payout controls — 26 Nov 2026

This section adds read-only inspection of live Production function definitions, function ACLs, table privileges, RLS policies, triggers and unique indexes. No financial/user rows were queried.

### Positive controls confirmed in Production

- `request_talent_payout(p_amount, bank details, idempotency key)` exists in Production. It derives Talent ID from `auth.uid()`, requires Talent role + active account + 18+ + verified KTP + approved Talent profile, enforces minimum Rp100,000, validates bank-field lengths, and returns the original request on an exact same-key retry. Reuse of the same key with different owner/amount/bank details fails.
- The payout INSERT trigger locks the Talent profile and eligible earning rows, calculates available balance from booking + affiliate ledgers, and rejects overdraw. Allocation trigger reserves the exact requested amount; transaction rollback protects partial allocation failure.
- Payout provider reference has a unique index. Refund provider reference has a unique partial unique index. Payment booking ID, payment idempotency key, and provider charge ID are unique.
- `admin_process_payout()` is Finance-permission scoped, row-locks the payout request, enforces requested → processing → provider-confirmed completion, requires a non-empty provider reference, and writes an Admin audit event. Database trigger guards payout completion while any reserved earning is disputed.
- `admin_process_refund()` is Finance-permission scoped, locks refund/payment/booking rows, restricts refund to requested/approved, requires a provider reference, prevents cumulative refund exceeding payment amount, applies the customer-cancellation automatic-refund cap, and writes an Admin audit event.
- Direct authenticated table privileges are denied for INSERT/UPDATE on `payout_requests`, `refunds`, and `payments`; direct update of payout status/provider reference columns is also denied. RLS further limits SELECT to the relevant Talent/booking participants or Finance Admin.

### P1 — Provider callback still lacks independent invoice verification and durable receipt ledger

- Existing webhook validates callback token, canonical booking UUID, PAID/SETTLED state, invoice ID presence, IDR currency and safe integer amount; it compares the amount to the booking's DB gross amount.
- The webhook still trusts callback invoice identity/status/amount after token validation and does not independently retrieve the invoice from Xendit. There is also no durable provider-event/invoice receipt table with unique provider identity, payload hash, processing state and retry record.
- Booking-level payment uniqueness prevents duplicate ledger generation, but it does not provide a complete audit trail for multiple payment attempts or robust recovery after provider success + client/network failure.
- Keep Xendit unavailable for new checkout until the provider verification/receipt design and sandbox race/retry tests pass.

### P2 — Xendit new-route lock is deliberately disabled in the live booking RPC

- Production `claim_booking_payment_route()` rejects selecting `xendit` when a booking has no previously locked route, while allowing an already Xendit-locked legacy booking to re-claim the same route.
- The `create-checkout` Edge Function still calls this RPC with `xendit`. Therefore a direct attempt to start a new Xendit checkout fails at the database route-claim step. This is a fail-closed disablement, not a bypass.
- Align the product flag/checkout messaging and remove stale entry points, or deliberately re-enable only after sandbox verification and independent callback reconciliation. Do not remove the DB guard as a quick fix.

### P2 — Bank destination ownership is not verified by the payout RPC

- The payout RPC snapshots bank name, account number and account holder name supplied in the request and checks only field length/shape. It does not prove the destination account holder matches the verified Talent identity or an independently verified bank destination.
- Because payout is manually transferred, Finance must verify destination ownership before transfer and the UI should clearly warn that the payout destination is the Talent's responsibility. Prefer a verified bank-destination workflow before automating payouts.

### Remaining Staging acceptance tests

1. Concurrent payout requests, exact idempotent retry, conflicting same key, and two distinct keys competing for the same balance.
2. Payout rejection/failure releases each reservation once; provider-confirmed completion settles each allocation once; duplicate provider reference fails.
3. Dispute/cancellation races with payout request, processing, and provider-confirmed completion.
4. Concurrent refund processing for the same payment; cumulative partial refunds never exceed payment; duplicate provider reference fails.
5. Direct REST INSERT/UPDATE attempts on payments, refunds and payouts fail for authenticated users; authorized RPC role matrix passes.
6. Xendit new checkout remains unavailable until explicitly re-enabled; when enabled, test invoice-created/network-failure recovery, callback replay, wrong invoice ID/external ID, currency, amount, status and late callback.
7. Confirm bank account ownership review and audit of changed payout destination before any manual transfer.

### Validation boundary

Read-only Production catalog inspection only: function definitions/ACLs, RLS policies, table/column privileges, triggers and indexes. No financial, payout, refund, payment, bank-account or user rows were read. No SQL mutation, provider request, deployment, feature flag change, or Production data change occurred.
