# Social Experience Exact Service ID Foundation

## Goal

Move Social Experience booking identity from the ambiguous provider/category pair to the stable `talent_services.id`, while preserving the legacy booking API and historical booking rows.

## What this branch changes

### Database migration 110 (after the current provider foundation chain)

`20261127011000_social_experience_service_id_foundation.sql`:
- Adds nullable `bookings.service_id` with a foreign key to `talent_services.id`.
- Adds immutable service title and description snapshots for new bookings.
- Backfills service IDs for legacy bookings only where the existing talent/category pair resolves to a service row.
- Adds a BEFORE INSERT trigger to bind the exact offer and snapshot its display identity.
- Adds a BEFORE UPDATE guard that prevents service identity snapshots from changing.
- Adds `create_booking_for_service(p_service_id, ...)`, which validates and locks an approved/active offer, then delegates established eligibility, KTP, schedule, feature-gate and financial checks to the existing `create_booking()` RPC.
- Keeps the old `create_booking()` signature available for existing clients.
- Keeps `uq_talent_activity` intact. Multiple offers in one category remain disabled until every booking reader and editor is keyed by service ID.

### Frontend

- Marketplace provider mapping carries the stable offer UUID.
- Pending/inactive service rows are no longer included as public activity categories in the main talent discovery mapping.
- Talent detail loads approved/active service IDs and maps the selected category to its exact offer.
- Booking submission now calls `create_booking_for_service` with `p_service_id`, rather than sending only the category.
- Customer/Talent booking history prefers the immutable service title snapshot and falls back to the legacy category label.
- Talent dashboard reads the snapshot fields when migration 110 exists and falls back to the legacy select on environments where those columns are not yet present.
- Booking TypeScript shapes include nullable service identity snapshots for legacy compatibility.

### Tests

`supabase/tests/stage_d_service_id_foundation.sql` checks:
- nullable service ID contract;
- existence of the exact-offer RPC;
- preservation of the legacy RPC;
- snapshot trigger;
- retention of the one-offer-per-category constraint;
- RPC privilege boundary between `anon` and `authenticated`.

## Financial trigger dependency audit

A read-only inspection of the connected production schema confirmed that `trg_calculate_booking_financials` still resolves `custom_rate_override` by `(talent_id, activity_category_id)`, then falls back to the Talent profile hourly/online rate. The production unique constraint `uq_talent_activity UNIQUE (talent_id, activity_category_id)` is therefore a critical invariant today.

The exact-ID RPC validates and locks the selected service, then sets a transaction-local service ID consumed by the BEFORE INSERT snapshot trigger. The legacy financial trigger continues to use the provider/category pair. This is safe only while the unique constraint remains in place and the snapshot trigger verifies that the selected service belongs to that exact pair. Do not remove or relax the unique constraint until the financial trigger itself reads the selected service ID and every legacy booking consumer has been migrated.

The production booking table also has a separate `trg_enforce_approved_talent_service_for_booking` trigger. The new snapshot trigger must remain ordered before the financial trigger; PostgreSQL orders same-timing triggers by trigger name, so `trg_assign_booking_service_snapshot` currently precedes `trg_calculate_booking_financials`. Preserve/verify this ordering in staging.

## Compatibility and safety

- Existing bookings remain readable; unmatched historical rows retain `service_id = NULL`.
- The current category uniqueness constraint remains in place, so the legacy financial trigger continues to resolve a single row.
- Service rows referenced by bookings cannot be deleted; providers/admins should deactivate/archive offers instead.
- Existing payment checkout feature flag remains authoritative and disabled until the gateway flow is approved.
- This migration is not applied to production in this PR.

## Current environment blocker

The connected Supabase project currently lists only its default `main` branch, and that branch reports `MIGRATIONS_FAILED`. No separate healthy staging branch is available in the connected project. Therefore migration 110 and the Stage D SQL checks have not been executed. Do not use the production project as a substitute staging target.

## Required staging acceptance before merge/release

1. Replay all migrations from a clean staging database in order, including taxonomy/custom-service migrations before migration 60.
2. Run the Stage D contract checks.
3. Verify all historical bookings remain unchanged in status, price, payment, refund, earning, payout and review associations.
4. Test an approved active offer and confirm new booking row has the expected `service_id`, title snapshot and description snapshot.
5. Test wrong-owner service ID, pending service, inactive service, unknown service ID, self-booking, KTP/account ineligibility, schedule conflicts and duplicate pending-payment guard.
6. Confirm the payment checkout feature flag remains off and no payment is collected.
7. Run all existing database security/regression suites and frontend typecheck/build.
8. Only then review merge readiness. Production migration/deployment requires a separate explicit release decision.

## Explicitly not included

- Enabling multiple offers in the same category.
- Professional Services booking or payment.
- Merchant Partner schema or vouchers.
- Any production database migration or deployment.


## Payment, refund and payout consumer audit

A follow-up source audit traced the existing financial consumers. The exact service ID is booking identity metadata; it must not become a new pricing or ledger source after booking creation.

- Payment settlement is booking-keyed. The payment aggregate links to `booking_id`; the settlement/ledger path reads the frozen booking amounts rather than recalculating price from a mutable service listing.
- `auto_generate_booking_financial_ledgers()` creates the commission and Talent earning rows from `bookings.gross_amount`, `platform_fee_amount`, and `talent_gross_share`. Referral reward reservation is also tied to the booking. Keep these frozen amount fields as the financial source of truth.
- Refund rows link both `payment_id` and `booking_id`. Finance processing locks the refund/payment, validates the relationship and external provider reference, rejects duplicate refund references, and prevents cumulative processed refunds from exceeding the payment amount.
- `handle_booking_refund_financials()` reverses/adjusts the booking-linked Talent earning and referral reward on cancellation/refund/dispute paths. Payout allocation consumes earning rows and protects already allocated/paid amounts; do not bypass this ledger with direct balance edits.
- No payment, refund, payout, commission, or earning consumer identified in this pass requires a direct join to the mutable service listing to reconstruct the booked amount. The immutable booking financial snapshots remain authoritative.

### Release boundaries found

1. Keep `service_id` nullable for historical bookings that cannot be mapped, but require it for every new booking created through the new exact-offer RPC.
2. Keep the service title/description snapshots and financial snapshots immutable after booking creation. A later service edit must not rewrite an existing booking or its ledger.
3. Preserve the existing one-service-per-Talent/category unique constraint. The current financial trigger still resolves the rate from that pair; removing the constraint can make pricing ambiguous even though the frontend now carries a service UUID.
4. Do not enable Professional Services checkout/payout by reusing the activity flow unchanged. Existing refund reversal is booking-keyed but is not a complete proportional allocation contract for partial refunds across Talent, platform fee, referral, reserved payout and already-paid payout. Project acceptance and partial delivery also need separate lifecycle rules.
5. The payment/refund source audit does not establish successful gateway settlement or runtime behavior. Staging replay and concurrency tests remain mandatory.

### Additional Stage D / pre-release checks

- Assert the exact service ID and service display snapshots are present on all new bookings created through the exact-offer RPC; allow NULL only for historical legacy rows or legacy RPC compatibility during migration.
- Assert service ID and service display snapshots cannot be changed after insert, including by privileged application roles except an explicitly designed repair path.
- Assert edits to the current service title, description or rate do not alter existing booking snapshots or financial amounts.
- Assert payment settlement creates at most one booking-linked payment/commission/Talent earning/referral reward under duplicate callbacks and concurrent retries.
- Assert refund processing is tied to the same booking/payment, is idempotent, and never exceeds the original payment; verify refund reversal cannot spend or reverse already paid payout allocations.
- Re-run cancellation, dispute-hold, escrow-release and payout-allocation regression suites before release.

This audit was source-level/read-only. It did not execute payment/refund/payout flows, apply migrations, alter production data, or deploy any service.


## Refund allocation limitation confirmed from source

A deeper read of the current cancellation/refund implementation found an important boundary that must not be hidden by the payment-level partial-refund cap:

- `admin_process_refund()` prevents cumulative processed refunds from exceeding the payment amount and only marks the payment fully refunded when processed refunds reach the full payment amount.
- However, `handle_booking_refund_financials()` is driven by booking status (`refunded`, `cancelled_by_customer`, or `cancelled_by_talent`) and creates a reversal for the full `talent_earnings.net_earning` when it first handles that terminal status.
- Therefore a partial refund against a cancelled booking is not currently a proportional allocation contract across Customer refund, Talent earning, platform commission, referral reward, reserved payout and already-paid payout. The refund processor's payment cap alone does not make that distribution correct.
- The existing reversal idempotency check is booking-level (`financial_adjustments_reversals.booking_id`), so it intentionally avoids a second full reversal for the same booking; it does not model multiple proportional refund events.

**Decision:** do not implement or advertise partial-refund support for Social Experience or Professional Services as an end-to-end proportional finance feature until Finance defines the allocation policy and an auditable adjustment ledger covers allocated/paid earnings. Keep current cancellation/refund behavior unchanged in this service-ID foundation PR.

Stage D.2 now checks that the booking financial snapshot guard, booking-keyed settlement ledger trigger/function, booking-linked refund reversal handler, and payout dispute guard remain present. These are catalog/source-contract assertions only; they do not prove runtime idempotency under concurrent provider callbacks or payout/refund races. Those require isolated staging scenario tests.


## Booking lifecycle and escrow transition audit

A source-level review of the canonical activity booking lifecycle confirms the intended path and identifies release boundaries:

`pending_payment → paid_held_in_escrow → confirmed_by_talent → in_progress → completed`

Terminal/exception paths are `cancelled_by_customer`, `cancelled_by_talent`, `expired`, `refunded`, and the temporary `disputed_hold` state. Database transition guards restrict which actor/backend may perform each transition; a scoped Support Admin can hold/restore only through the active-report resolution path.

### Confirmed safeguards in source

- Pending reservations expire only after `payment_expires_at`; the existing expiry worker is scheduled separately from the escrow release worker.
- Completion requires both `customer_completed_at` and `talent_completed_at`. The completion RPC locks the booking row and records one participant's confirmation at a time.
- A booking can enter `disputed_hold` only when a related report is open/investigating; the report workflow preserves the pre-dispute booking and financial states.
- The completion timestamp trigger schedules escrow release when the booking becomes completed. Current product policy is immediate release (not 24-hour delay).
- The escrow worker locks candidate bookings with `FOR UPDATE SKIP LOCKED`, skips bookings with an active report, releases only held Talent earnings/referral rewards/payment rows, and is restricted to trusted backend execution.
- The existing status and financial guards protect the frozen booking amount and prevent arbitrary terminal-state rewrites.

### Important product boundaries

1. Immediate release is acceptable only for a completed time-bound activity whose two-party confirmation is the agreed completion signal. A Professional Services project must not be marked `completed` on upload or due-date alone. It needs explicit deliverable submission, revision/acceptance, dispute and timeout rules before connecting to the release worker.
2. A booking in `disputed_hold` must remain held until every open/investigating report is resolved. Support restoration must restore only the recorded pre-dispute state, not an arbitrary state supplied by a client.
3. Expiry, payment settlement, cancellation and completion can race. Staging must exercise expiry-vs-payment callback, customer-vs-talent cancellation, completion-vs-report insertion, duplicate completion confirmation and release-vs-payout allocation under concurrent transactions.
4. The cron job label `yuku_release_escrow_24h` is historical naming; migration 20 changed the release policy to immediate once completed and scheduled. Do not interpret the job name as a 24-hour delay.
5. The source audit does not prove that the expected cron jobs are actually installed/enabled in the current Supabase environment. Verify job inventory and execution history in the intended staging environment before rollout.

Stage D.3 adds catalog/source-contract checks for the actor guard, status transition allowlist, row-locked two-party completion RPC, completion timestamp trigger, dispute-aware escrow release worker and pending reservation expiry worker. These checks do not execute concurrent state transitions or validate the live cron configuration.

No booking state, payment, escrow, payout, database migration, or production deployment was changed by this audit.


### Scoped Admin dispute restoration check

The follow-up review included the latest trigger-hardening migration. Booking/Finance scoped Admin permissions do not receive a generic bypass of booking actor or transition guards. Support can only:
- place an eligible booking on `disputed_hold` when a related report is active and preserve the exact prior status; or
- restore that exact recorded status after all related reports are no longer open/investigating, while clearing the dispute snapshot.

The Stage D.4 assertions now check that both database guards retain this Support-only, exact-state boundary and do not introduce generic Booking/Finance bypasses. This remains a source/catalog assertion; role-matrix runtime tests with real JWT claims are still required in staging.


## Cancellation, refund and payout allocation audit

The migration chain includes an important later hardening step that supersedes the original booking refund handler. The effective handler in migration 24:
- keeps Talent earnings in a non-payable dispute hold while retained Customer cancellation funds await Admin review;
- refuses automatic cancellation/refund reversal if the Talent earning already has any payout allocation or paid-out amount;
- writes the full earning reversal only when the cancellation/refund path is eligible and no earlier reversal exists;
- prevents Admin retained-fund refund or compensation decisions from proceeding if the associated Talent earning has already been reserved or paid.

The payout allocator locks earning rows, reserves only the unallocated/unpaid balance, and fails if the requested payout cannot be fully covered. Failed/rejected payout releases reservations; provider-confirmed payout settles allocations and increments paid-out totals. A separate guard blocks payout completion when an allocated earning is in dispute hold.

### Confirmed limitations and release gates

1. The current refund processor reconciles cumulative processed refunds against the payment amount under row locks and requires a provider refund reference. That protects the payment aggregate, but does not create proportional earning/commission/referral reversals for partial refunds.
2. Existing booking-level reversal idempotency permits one reversal record per booking. It is not a multi-event proportional refund ledger. Keep partial refunds disabled as an end-to-end feature until refund events, commission adjustments, Talent earning adjustments, referral adjustments, and payout recovery are modelled together.
3. If a Talent earning has already been allocated or paid, cancellation/refund deliberately fails and requires Finance reconciliation. Do not silently claw back paid money or mark a paid earning as reversed.
4. A retained Customer cancellation case can be resolved as refund Customer, compensate Talent (100% of retained amount under current policy), or extend hold. This decision path is distinct from the automatic refund and must be separately audited.
5. These controls were introduced across migrations 21, 24, 26 and 46. Verify the effective function definitions and trigger attachments in the target database after applying the full ordered migration chain; do not infer production state from repository source alone.

Stage D.5 adds catalog/source-contract checks for the cancellation reversal guard, cumulative refund processor, retained-cancellation resolver, payout row-lock allocation, dispute payout guard and release/settlement of payout allocations. It does not replace staging tests for concurrent cancellation-vs-payout, duplicate refund callbacks, refund provider failure, payout failure/retry, or ledger reconciliation.

No production ledger, booking, refund, payout, migration, or deployment was modified by this audit.


## Cross-branch migration ordering

This migration uses version `20261127006000` to avoid the `20261127004000` collision with PR #287's Merchant membership-management migration. When both PRs are released together, merge/integrate the PR #287 migration chain first (including Merchant offers version `05000`), then apply this Social Experience migration version `06000`. Do not merge/apply this branch's migration ahead of the lower-version Merchant migrations. Reconcile the complete canonical migration history in a clean Staging database before release.


## Multi-profile booking authorization

The legacy primary `users.role` must not decide whether an account can act as a Customer or be booked as a Talent. The booking RPC now requires an existing `customer_profiles` row for the booking actor and an approved, publicly visible `talent_profiles` row for the provider, while retaining active-account, 18+, KTP, payment, schedule, availability, and pricing checks. This is required because active Talent accounts may also have Customer profiles. The old `create_booking` signature remains available for legacy clients; the exact-ID RPC delegates to the same hardened implementation.
