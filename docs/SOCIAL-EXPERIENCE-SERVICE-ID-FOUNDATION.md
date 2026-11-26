# Social Experience Exact Service ID Foundation

## Goal

Move Social Experience booking identity from the ambiguous provider/category pair to the stable `talent_services.id`, while preserving the legacy booking API and historical booking rows.

## What this branch changes

### Database migration 40

`20261127004000_social_experience_service_id_foundation.sql`:
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
- Talent dashboard reads the snapshot fields when migration 40 exists and falls back to the legacy select on environments where those columns are not yet present.
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

The connected Supabase project currently lists only its default `main` branch, and that branch reports `MIGRATIONS_FAILED`. No separate healthy staging branch is available in the connected project. Therefore migration 40 and the Stage D SQL checks have not been executed. Do not use the production project as a substitute staging target.

## Required staging acceptance before merge/release

1. Replay all migrations from a clean staging database in order, including taxonomy/custom-service migrations before migration 40.
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
