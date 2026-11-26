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
