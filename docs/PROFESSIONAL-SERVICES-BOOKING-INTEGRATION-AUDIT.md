# Professional Services Booking — Integration Audit

## Scope and safety
This audit is based on read-only inspection of the production Supabase schema and function definitions. No SQL was executed against production except SELECT queries. No production rows, policies, functions, or schema were changed.

Professional-service listings remain browseable only. Do not enable booking/payment actions until all integration gates below pass.

## Confirmed legacy booking contract

The current `public.bookings` table requires all of the following:
- `activity_category_id` is NOT NULL and belongs to the legacy activity taxonomy.
- `booking_mode`, `start_time`, `end_time`, and `duration_hours` are required.
- `hourly_rate_snapshot`, `gross_amount`, `platform_fee_amount`, and `talent_gross_share` are required.
- Payment expiry, lifecycle timestamps, dispute state, and payment route are stored on the booking.

The current `public.create_booking` RPC:
- Requires an authenticated active customer, verified-18 flag, and verified KTP.
- Requires an active, verified-18 Talent user, approved Talent profile, and public visibility.
- Requires an active legacy activity category and an approved/active `talent_services` row.
- Derives online/offline mode from the legacy category and Talent profile.
- Uses hourly pricing, calculates a 20% YUKU fee / 80% Talent share, and accepts a maximum duration of five hours.
- Requires a start time at least two hours in the future.
- Uses Asia/Jakarta daily availability slots; configured schedules cannot cross midnight.
- Rejects creation if the customer already has any unexpired pending-payment booking.

These rules cannot represent professional service units such as per-session, per-day, or per-project without changing the booking contract.

## Financial and lifecycle dependency map

| Component | Current dependency | Professional-service requirement |
|---|---|---|
| `calculate_booking_financials` trigger | Reads legacy `talent_services`, profile hourly rates and `duration_hours`; writes financial snapshots | Branch by booking kind; never overwrite or reinterpret legacy hourly fields |
| `enforce_approved_talent_service_for_booking` trigger | Requires approved legacy service and active legacy category | Add professional listing validation while preserving legacy checks |
| `auto_generate_booking_financial_ledgers` | On payment settlement, writes `commission_records`, `talent_earnings`, and optional referral rewards | Continue using the same ledger with immutable professional price snapshots |
| `claim_booking_payment_route` | Locks one of Xendit/manual QRIS/manual bank transfer for a pending booking | Reuse only after the booking row can unambiguously identify its service kind |
| QRIS/bank proof RPCs | Require exact equality to `bookings.gross_amount`, pending state, and private proof object | Keep the same booking gross amount as the authoritative snapshot |
| `settle_booking_payment` | Server-only settlement; writes `payments` and changes booking to escrow-held | Keep server-only settlement and idempotency; validate professional booking kind and amount |
| `handle_booking_refund_financials` | Reverses or holds Talent earnings and referral rewards on dispute/cancel/refund | Preserve payout-allocation safeguards and referral behavior |
| Completion and payout | Booking completion and escrow release feed Talent earnings/payout allocations | Professional delivery acceptance must use the same completion and escrow safeguards |
| Status, notifications, chat, reviews | Multiple triggers and pages assume `public.bookings` | Audit every status consumer and UI label for service kind and pricing unit |

Other confirmed database functions in the booking lifecycle include:
- `expire_stale_booking_reservations`
- `confirm_booking_completion`
- `guard_booking_insert_status`
- `guard_booking_status_actor`
- `validate_booking_update`
- `log_booking_status_change`
- `close_qris_submissions_on_booking_inactive`
- `notify_admin_on_new_booking`
- `notify_on_booking_status_change`
- `guard_payout_completion_during_dispute`
- `admin_process_refund`
- `admin_review_qris_payment`
- `admin_review_bank_transfer_payment`

## Additional frontend dependency findings (branch audit)

The booking-history UI is not currently polymorphic:
- `src/pages/BookingHistoryPage.tsx` types `activity_category_id` as a required string.
- It builds `categoryIds` directly from every booking and queries `activity_categories` using those IDs.
- It renders `activityTitle`, `booking_mode`, `start_time`, and `duration_hours` as if every booking were an hourly activity.
- The same activity title and duration are passed into the booking chat context.
- The history page also owns customer payment panels, cancellation/report/review actions and status-specific UI. These must remain available for legacy activity bookings while professional service cards use their own snapshot label and unit/quantity.

Consequences:
- Making `activity_category_id` nullable before updating the history query and render model can produce invalid category lookups, blank labels, or incorrect activity assumptions.
- A professional booking cannot be represented safely by setting `duration_hours = 1` as a placeholder for a session/day/project. That would corrupt the booking display and can mislead finance/support.
- Do not expose a professional booking CTA merely because a professional listing is approved. The current public page correctly states that booking and payment are not open.

## Required frontend compatibility work

Before enabling professional booking:
1. Introduce a discriminated booking view model (`activity` vs `professional_service`) with a safe label and price-unit snapshot.
2. Make category enrichment conditional: only activity rows query `activity_categories`; professional rows enrich from immutable booking snapshots, not the current listing.
3. Update Booking History, chat context, customer/talent details, payment panels, cancellation/report/review UI, admin booking views, exports and finance summaries to render the correct kind.
4. Preserve legacy activity labels, rates, durations, payment instructions and state actions exactly.
5. Ensure customer and Talent views both resolve the provider/customer and service title without requiring a legacy activity category.

## Newly confirmed release blockers

- `bookings.activity_category_id` is a NOT NULL foreign key, and the legacy booking history currently assumes it is always populated.
- `calculate_booking_financials()` recalculates every inserted booking from legacy `talent_services` and profile hourly rates. It must branch by booking kind before any professional row can be inserted.
- The current `create_booking()` RPC only accepts a legacy activity category and hourly duration, with a five-hour cap. It must not be overloaded with fake category IDs or placeholder durations.
- The settlement ledger reads the booking's stored gross, platform fee and Talent share. This is reusable only after the professional booking RPC has frozen those values and the payment amount is checked against the same snapshot.
- The existing booking-history category lookup and chat payload must be migrated together with the database contract; changing only the database will leave frontend assumptions behind.

## Required additive data model

Preferred direction: extend the existing booking aggregate, not a parallel payment system.

Add a booking discriminator such as `booking_kind` with values `activity` and `professional_service`, plus a nullable `professional_talent_service_id` foreign key. Add a check constraint so each row has exactly one valid service reference:
- activity: legacy `activity_category_id` required, professional service ID null;
- professional service: professional service ID required, legacy category ID null.

Only after all dependent functions, constraints, policies, views, generated types, and clients have been updated should the legacy category column become nullable. Existing rows must be backfilled as `activity` and retain all original values.

Add immutable professional booking snapshots:
- service title and subcategory label;
- provider and customer IDs;
- pricing unit and unit rate;
- quantity and total gross;
- platform fee and provider share;
- selected delivery mode;
- service scope/description snapshot;
- start/end or agreed delivery deadline;
- cancellation and acceptance policy version.

Never calculate a historical professional booking from the provider's current listing price.

## Pricing semantics

- `per_hour`: quantity is hours, with an explicit maximum and time-slot conflict check.
- `per_session`: quantity is one session. Define duration or an agreed time window before accepting payment.
- `per_day`: quantity is whole/partial days under a documented rule. Support multi-day date ranges and overlap checks.
- `per_project`: quantity is one project or explicitly defined milestone. Store scope, deliverables, revisions, acceptance evidence and deadline before payment.

The provider must not be able to alter a booking's price, scope, delivery mode or deadline after payment. Any post-payment changes need an auditable amendment/consent flow.

## Mandatory implementation sequence

1. Inventory all foreign keys, check constraints, RLS policies, triggers, views, RPCs, Edge Functions, frontend queries, admin pages, finance reports and generated TypeScript types that reference `bookings` or legacy activity columns.
2. Design the additive schema and data backfill; do not apply it to production.
3. Refactor booking validation and financial snapshot calculation to branch on booking kind while preserving the exact activity path.
4. Add a dedicated professional booking RPC with row locks, customer eligibility checks, provider/listing/category approval checks, mode validation, schedule rules, duplicate pending-payment protection and server-calculated totals.
5. Update all payment, proof review, settlement, escrow, completion, cancellation, refund, dispute, commission, referral, payout, notification, chat, review, history, reporting and admin consumers.
6. Add automated tests for anonymous/customer/provider/admin/service-role actors and all four pricing units.
7. Run regression tests for every existing activity booking and payment route, including historical records.
8. Perform staging end-to-end testing and finance reconciliation before enabling any professional-service booking CTA.

## Release gate

No professional-service booking or payment CTA may be enabled until:
- Migration is validated in a disposable Supabase project.
- Existing activity booking regression suite passes.
- New pricing-unit calculations reconcile exactly across booking, payment, commission and earnings ledgers.
- Refund, dispute, cancellation and payout-allocation tests pass.
- RLS, RPC grants, SECURITY DEFINER search paths and server-only settlement permissions are reviewed.
- Mobile, Talent, customer, Admin and Finance workflows are signed off.

## Current state
Professional-service taxonomy, provider applications, private document handling, admin review and public approved listings are in the feature branch. Booking/payment remains intentionally disabled. The production database has not been modified for this feature.
