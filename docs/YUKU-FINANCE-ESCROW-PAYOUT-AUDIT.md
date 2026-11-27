# YUKU Finance, Escrow & Payout Audit

Tanggal audit: 26 November 2026  
Branch: `feat/professional-services-categories`  
Scope: source-level review of booking financial ledgers, escrow release, cancellation/refund effects, payout reservation and settlement, affiliate ledger, Talent dashboard balance. This is not a production database validation.

## Executive decision

**Do not enable professional-service checkout or professional payouts yet.** The existing financial model is activity-booking/hour-based and can be reused only after a shared booking contract writes immutable, server-calculated financial snapshots and every consumer is made booking-kind aware.

The existing booking and affiliate payout ledgers have useful safeguards: integer rupiah, one earning per booking, partial payout allocations, per-Talent row locking, minimum Rp100,000 payout, and a provider transfer reference before payout completion. Those safeguards do not solve professional-service partial refunds, project acceptance, or legacy cancellation timing.

## What is present in source

1. `bookings` stores gross amount, platform fee and Talent share as integer rupiah snapshots. `commission_records` and `talent_earnings` are unique by booking ID. Booking financials are therefore designed around one canonical booking record.
2. `talent_earnings` tracks `allocated_payout_amount` and `paid_out_amount`; the constraint prevents their sum exceeding `net_earning`.
3. Payout requests have a Rp100,000 minimum, bank destination snapshot, unique idempotency key, status state machine, and provider reference. Migration 18 requires a non-empty transfer reference before `completed_provider_confirmed`.
4. Migration 46 adds a separate affiliate earning ledger. Its allocation trigger reserves booking earnings first and affiliate earnings second, updates allocation counters, and releases reservations on rejected/failed payouts. Completion moves reserved amounts to paid-out amounts.
5. Migration 46 locks the Talent profile and eligible earning rows during payout validation, then checks the combined booking + affiliate available balance. This serializes concurrent payout requests for the same Talent when they go through the intended insert workflow.
6. Migration 20261126190000 revokes direct authenticated INSERT on `payout_requests` and the legacy insert policy, intending `request_talent_payout(...)` to be the only authenticated request path.
7. Migration 51 scopes payout/refund Admin RPCs to the Finance permission. UI balance is derived from both booking and affiliate ledgers and subtracts reserved and paid amounts.
8. Migration 24 prevents automatic reversal of an earning that has already been reserved or paid out. It holds earnings while a customer cancellation retention amount awaits Finance review; cancellation fails safely if money has already been allocated or paid.

## Findings / required work

### P0 — Verify the sole payout request RPC definition and deployment parity
The Talent dashboard calls `request_talent_payout`, and migration 20261126190000 grants it as the sole authenticated entry point. In the migration files inspected for this audit, the complete function definition was not located. Before release, locate the authoritative definition and confirm it is included in the ordered migration chain and matches the current grant/signature. Test that it:
- derives Talent identity from `auth.uid()`, never trusts a client-supplied Talent ID;
- checks active account, age/KTP verification, approved Talent profile and valid bank destination;
- validates idempotency key ownership and returns the original request on safe retry;
- serializes same-Talent concurrent requests and rejects duplicate/overdrawn reservations;
- snapshots bank details and amount without allowing client-set status/provider fields.

This is a release blocker until source and Staging/Production parity are confirmed.

### P0 — Professional-service refunds and cancellation are not supported by the current financial allocation model
Existing customer cancellation rules are based on `start_time` and hourly session thresholds. Talent cancellation assumes a full refund. Partial refunds are not yet allocated proportionally between Talent earning, platform commission, referral reward, reserved payouts, paid payouts, and any retained amount. Do not apply these rules to per-day/per-project services and do not enable partial professional refunds until Finance signs off on a complete allocation/reconciliation design.

### P0 — Professional completion must not automatically release escrow on an unaccepted deliverable
The completion trigger schedules escrow release immediately when a booking becomes `completed`. Generic two-party completion confirmation may be suitable for a time-bound session, but a project needs a deliverable, review window, acceptance/revision/dispute states, and an authoritative acceptance event before funds become available. Do not mark project work completed merely because a scheduled date passed.

### P1 — Reconcile payout reservations with dispute transitions
Migration 46 blocks payout completion when any reserved allocation points to an earning in `disputed_hold`. Migration 24 also refuses cancellation reversal if an earning is already allocated or paid. Preserve these fail-closed behaviours. Add regression tests for a dispute/cancellation racing with payout request, payout processing, rejection, and provider-confirmed completion. Define the operational Finance recovery path when a payout is already processing and its reserved earning becomes disputed.

### P1 — Admin payout state machine needs negative permission tests
Migration 51 scopes the Admin RPC to Finance. Verify in Staging that:
- Talent/Booking/Support Admin cannot process payouts;
- Finance Admin can process payouts but cannot edit booking service details or financial snapshots;
- Super Admin can perform the permitted Finance action;
- direct table updates cannot bypass the RPC/trigger state machine;
- a duplicate provider reference cannot complete two payout requests;
- only `processing` can transition to provider-confirmed completion, and a non-empty reference is mandatory.

### P1 — Dashboard totals need explicit labels and reconciliation
Talent dashboard calculates available balance from booking and affiliate ledgers and subtracts reserved/paid amounts. This matches the payout validation formula. Keep the two sources itemized in a future statement/history view so Talent can distinguish service income from affiliate bonus. Ensure the displayed “total paid out” reconciles to settled payout allocations, not merely a potentially inconsistent aggregate of payout request rows. Add a Finance reconciliation query that compares each payout amount with the sum of its settled/reserved/released allocations according to payout status.

### P1 — Affiliate reversal and payout concurrency tests
Affiliate earnings are separate from booking earnings and are included in the same payout request. The referral reward trigger refuses cancellation if affiliate earnings have already been reserved or paid. Test backfill, duplicate reward credit, dispute hold/restore, cancelled reward, payout rejection, partial payout and concurrent requests. The ledger must never create a second affiliate earning for one referral reward.

### P2 — Observability and audit trail
Maintain immutable audit evidence for Admin status changes, provider reference, bank-destination snapshot, request idempotency key, allocation rows and timestamps. Do not store unnecessary payment secrets or expose bank account details in broad Admin/Support views. Add a daily reconciliation report for:
- payout request amount vs allocation totals;
- reserved allocations attached to rejected/failed/completed payouts;
- negative or over-allocated ledger balances;
- completed payouts missing provider reference or confirmation timestamp;
- earnings marked available while booking/payment remains held or disputed.

## Professional-service financial contract required before checkout

A professional booking must persist server-calculated, immutable snapshots in the shared booking aggregate:
- service/listing ID and service title/category snapshot;
- pricing unit (`per_hour`, `per_session`, `per_day`, `per_project`) and quantity;
- rate, gross, platform fee, Talent share, referral basis and rounding policy;
- payment route/provider and settlement references;
- delivery scope, scheduled window/deadline, acceptance/revision state;
- cancellation/refund policy version and calculated allocation outcomes.

Only after the shared booking contract and every booking consumer are migrated should the existing canonical ledger create commission, Talent earning and referral reward entries. Do not map day/session/project prices into fake hourly values.

## Minimum Staging regression matrix

- Two concurrent payout requests for one Talent; one balance reservation must win without overdraw.
- Same idempotency key retried; exactly one payout request and one allocation set.
- Different idempotency keys racing for the same remaining balance.
- Partial payout; remainder stays available and can be withdrawn later.
- Payout rejected/failed; all reserved amounts return to available exactly once.
- Payout provider-confirmed; allocation moves from reserved to paid exactly once.
- Duplicate provider reference; second completion is rejected.
- Earning disputed before request, after request, during processing, and before completion.
- Refund/cancellation before payout, after reservation, and after payout; no silent negative balance.
- Affiliate reward credited twice, held, restored, cancelled, partially paid and retried.
- Finance/Admin permission matrix and direct-table bypass attempts.
- Booking and affiliate ledgers reconcile exactly to Talent dashboard and Finance reports.

## Validation boundary

This audit inspected committed source files only. It did not execute SQL, replay migrations, mutate Supabase, run payout simulations, or verify Staging/Production schema parity. No Production data or settings were changed. PR #263 remains the review boundary; no merge or deployment is authorized by this audit.


## Production catalog verification addendum — 26 Nov 2026

The previously unresolved payout RPC definition has now been located and inspected in Production (read-only). `request_talent_payout()` derives the actor from `auth.uid()`, checks active/verified/approved Talent status, validates minimum amount and bank-field lengths, enforces exact idempotent retry semantics, and inserts only the server-derived Talent ID. The payout INSERT trigger locks eligible earning rows, validates combined booking + affiliate balance, and the allocation trigger reserves exact amounts. This resolves the source-definition discovery gap, but Staging concurrency tests and deployment-parity checks remain mandatory.

Production also confirms:
- Authenticated users have no direct INSERT/UPDATE table privilege on payout requests, refunds or payments, and cannot directly update payout status/provider reference columns.
- Unique indexes protect payout idempotency keys, payout provider references, refund provider references, payment booking IDs, payment idempotency keys and provider charge IDs.
- Finance Admin RPCs row-lock payout/refund records and audit status transitions. Disputed reserved earnings block payout completion.
- Payout RPC validates bank destination fields syntactically, not ownership against verified identity. Manual Finance verification remains required.
- New Xendit route selection is currently blocked by `claim_booking_payment_route()`; the Edge Function's Xendit path will fail closed for a new route. Keep it disabled until callback verification/receipt ledger and sandbox tests are complete.

This is catalog-only validation, not a live payout/refund simulation. No financial rows or bank details were read and no Production changes were made.


## Cancellation and refund RPC verification addendum — 26 Nov 2026

Production function definitions were inspected read-only:
- Customer cancellation is owner-scoped and row-locks booking/payment; server calculates full/partial/no automatic refund based on time before start, with retained funds sent to a Finance case.
- Talent cancellation is owner-scoped and only available before the session starts, while escrow is held; it creates a full refund request.
- Finance case resolution supports Customer refund, Talent compensation or extending the hold; it requires notes and, for an actual refund, a provider reference. Case decisions and Admin audit events are recorded.
- Refund processing locks the payment and prevents cumulative refund from exceeding the paid amount. Unique provider-refund index protects duplicate references.
- In-progress Talent cancellation is not available through the Talent cancellation RPC; users must use the incident/report workflow.

The logic is appropriate for current time-bound activity sessions only. Professional per-day/per-project services still require their own delivery acceptance and cancellation/refund policy. Staging must prove cutoff boundaries, concurrent cancellation, replay, retained amount decisions, payout/dispute races and overdue hold operations. No Production transaction rows or RPC writes were performed.


## Xendit retirement update — 27 Nov 2026
Xendit is retired from new YUKU checkout. New payment-route claims and server settlement are limited to manual QRIS and bank transfer. Historical provider enum values and booking/payment records remain readable for compatibility. Legacy pending bookings must be handled through YUKU Support; old payment links must not be reused. The guarded migration `20261127190000_retire_xendit_booking_checkout.sql` is prepared in the canonical branch but has not been applied. Staging replay, payment regression tests, operational secret/callback retirement, and explicit release approval remain required. No Production state was changed.