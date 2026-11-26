# YUKU Payment Attempts & Provider Receipt Design

Date: 27 November 2026
Status: design and release-gate proposal; not a production migration.

## Scope

Harden the existing Activity payment path for manual QRIS, manual bank transfer, and Xendit without changing current settlement, refund, escrow, or payout behavior. Professional Services checkout remains disabled until its separate booking/finance contract is complete.

## Current verified boundaries

- `bookings.payment_route` and `claim_booking_payment_route()` serialize route selection for a booking.
- Production currently rejects selecting Xendit for a new booking when `payment_route` is null. Keep this fail-closed guard.
- `create-checkout` reads the amount from the booking and claims Xendit before calling the provider.
- `xendit-webhook` validates callback token, external booking ID format, PAID/SETTLED status, invoice ID, IDR currency, positive safe integer amount, and exact DB gross amount.
- Callback still does not independently retrieve the invoice from Xendit and there is no durable provider receipt/event ledger in the reviewed flow.
- Existing booking-level payment/ledger idempotency is not a substitute for attempt-level and provider-event audit.
- Xendit Edge Functions state sandbox verification has not been completed.

## Target data model (proposal only)

### payment_attempts

One row per attempt, never overwrite a prior attempt's provider identity.

- id UUID primary key
- booking_id UUID not null FK bookings
- attempt_no integer, unique per booking
- route enum/text constrained to `manual_qris`, `manual_bank_transfer`, `xendit`
- provider text constrained to known provider identifiers
- status: `created`, `initiating`, `pending_provider`, `submitted_for_review`, `settled`, `failed`, `expired`, `cancelled`, `needs_reconciliation`
- amount BIGINT > 0; currency fixed to IDR for current Indonesia checkout
- idempotency_key text; unique within provider/customer scope
- provider_invoice_id / provider_reference nullable; unique partial index per provider when non-null
- checkout_url nullable; avoid storing sensitive provider credentials
- created_at, updated_at, expires_at, settled_at
- failure_code/failure_summary bounded and redacted

Do not store card data, API secrets, callback tokens, or unnecessary raw personal data.

### provider_webhook_receipts

One durable row per received provider event/invoice notification.

- id UUID primary key
- provider text
- provider_event_id nullable (only if provider guarantees a stable event ID)
- provider_invoice_id text not null
- event_type/status text
- payload_sha256 text not null
- payload_redacted JSONB with explicit allowlist and size cap
- received_at, processed_at
- processing_status: `received`, `processing`, `processed`, `retryable_failure`, `rejected`
- attempt_id nullable FK payment_attempts
- result_code and bounded result_summary

Unique identity should use provider + stable event ID when guaranteed. If provider has no stable event ID, use provider + invoice ID + normalized event type/status + payload hash; do not assume invoice ID alone uniquely identifies every event. Duplicate receipt insertion must be harmless.

## Required invariants

1. Booking has at most one active payment route and route remains immutable after a payment attempt is externally initiated, unless a trusted reconciliation/cancellation workflow proves the attempt is terminal.
2. One payment attempt belongs to exactly one booking and snapshots amount/currency from the server-side booking.
3. Provider invoice identity is unique per provider; never reuse an invoice ID across bookings.
4. Client-supplied amount, provider, owner, or settlement status is never authoritative.
5. Only trusted server functions may mark an attempt settled.
6. Settlement requires booking ID, attempt ID, route/provider, invoice/reference, amount, currency, and final provider status to match.
7. Callback receipt is persisted before processing; retries resume from durable receipt state.
8. A duplicate event returns success only after confirming the same event has already been processed or safely queued.
9. A callback for a terminal/expired/cancelled booking is recorded and reconciled; it must not silently create a second payment or incorrectly settle.
10. Payment ledger generation remains idempotent and is transactionally linked to successful settlement.
11. Manual QRIS/bank-transfer approval references the exact attempt and proof/instructions record; Finance review is row-locked and idempotent.
12. No route lock is released merely because an HTTP request timed out. Provider state must first be queried/reconciled.

## Xendit callback verification sequence

1. Validate method, callback authentication, body size, schema, and canonical external ID.
2. Resolve booking and payment attempt by immutable external reference; reject ambiguous or missing mapping.
3. Persist a redacted receipt with a deterministic dedupe key.
4. Retrieve invoice from Xendit using server-side credentials, with bounded timeout and retry.
5. Compare provider invoice ID, external ID, status, currency, amount, and expected booking/attempt identity.
6. Lock booking and attempt rows in a single database transaction.
7. Re-check route, booking state, attempt state, expiry policy, and exact amount.
8. Call the settlement operation with the attempt ID and verified provider facts.
9. Mark receipt processed only after settlement transaction commits; on transient failure retain retryable state and return 5xx.
10. Run periodic reconciliation for provider invoices stuck pending/unknown or provider-paid but locally unsettled.

Never trust a browser redirect as payment proof. A callback token is authentication of the sender, not independent proof that a particular invoice is the correct invoice for a booking.

## Checkout creation and failure recovery

- Create a durable attempt before calling the provider, with a stable idempotency key.
- Use the same provider idempotency key on retry where supported.
- Persist provider invoice ID/URL as soon as returned.
- If provider creation times out, mark attempt `needs_reconciliation`; query provider by stable external ID before creating another invoice.
- Do not unlock or switch route while provider state is unknown.
- Permit route recovery only after a trusted job confirms the old attempt is terminal and no paid invoice exists.
- Return an existing valid pending checkout URL for an exact idempotent retry.

## Manual QRIS and bank transfer

- Create attempt when route is claimed; store the exact QRIS configuration version or bank instruction snapshot used for that booking.
- Proof submission references attempt ID, not just booking ID.
- Finance approval/rejection locks attempt and booking, checks amount, reference uniqueness, expiry, route, and current state.
- Duplicate approval must be a harmless no-op; approval after expiry/cancellation requires explicit reconciliation and must not silently settle.
- Store proof in private storage with owner/Finance-only access, strict size/type controls, and audit trail.

## Staging acceptance matrix

| Scenario | Expected result |
|---|---|
| Two routes claimed concurrently | Exactly one route/attempt wins |
| Duplicate checkout request, same idempotency key | Same attempt/invoice returned |
| Same key with changed booking/amount/provider | Rejected |
| Provider create timeout after invoice creation | Attempt becomes reconcilable; no duplicate invoice |
| Duplicate callback | One receipt identity; one settlement/ledger |
| Callback wrong invoice ID or external ID | Rejected and audited |
| Callback wrong currency/amount/status | Rejected and audited |
| Callback database transient failure | 5xx/retry; receipt remains recoverable |
| Provider invoice lookup timeout | Retryable; no settlement |
| Provider says paid but booking expired/cancelled | Reconciliation queue; no silent settlement |
| Callback races QRIS/bank approval | Exactly one settlement |
| Duplicate Finance approval | One settlement |
| QRIS/bank proof for another booking/attempt | Denied |
| Payment provider paid, local settlement failed | Reconciliation repairs exactly once |
| Refund/payout/dispute races | Existing ledger and reservation guards remain consistent |

## Rollout gates

- Confirm exact Xendit invoice retrieval endpoint/response contract and authentication from current provider documentation.
- Implement additive schema and RPCs in an isolated branch; do not alter Production directly.
- Replay the complete ordered migration chain on a clean Staging project.
- Run executable SQL concurrency tests and Edge Function tests with mocked provider responses.
- Run Xendit sandbox tests including duplicate, delayed, mismatched, timeout, and retry cases.
- Reconcile provider settlement reports against payment attempts, payments, refunds, escrow, commission, Talent earnings, referral, and payout allocations.
- Only after approval, deliberately enable Xendit route selection in Staging; Production enablement is a separate explicit release decision.

## Explicit non-goals

- No Production schema/data/configuration change.
- No Edge Function deployment or Xendit API call.
- No enabling Xendit checkout.
- No change to commission, cancellation, refund, escrow, payout, or manual payment policy.
- No Professional Services checkout enablement.
