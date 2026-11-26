# YUKU Professional Service — Booking Lifecycle & Release Gates

Status: design specification only (2026-11-26). This document does not authorize migrations, RPC changes, checkout activation, or production writes.

## 1. Product rule

Use the existing `public.bookings` aggregate and existing payment/ledger/refund/payout systems. A professional-service booking is a distinct booking kind with a frozen service contract. Never create a second wallet or bypass the existing payment and escrow controls.

Keep the current activity flow unchanged. Professional listings remain discovery-only until every gate in this document and the booking consumer matrix passes.

## 2. Customer-to-provider flow

1. Customer opens a professional provider profile. Show the provider's service price and pricing unit on the profile, not on the directory card.
2. Customer selects one approved active service listing, delivery mode, quantity, date/time or project scope, and location details where relevant.
3. Server re-reads and locks the listing, verifies provider eligibility and service availability, calculates the total, applies the approved fee policy, and stores immutable booking snapshots.
4. Booking is created as `pending_payment`. No chat is opened and no provider acceptance is implied at this point.
5. Customer pays using a payment route that is enabled by YUKU. Server-side settlement validates the exact frozen gross and moves the booking to the existing escrow-held state.
6. Once payment is held in escrow, booking chat opens while the booking is awaiting provider confirmation. Customer and provider can coordinate practical details: exact public meeting point, distance, schedule, access instructions, and agreed service details. They cannot change the paid price or silently expand the scope in chat.
7. Provider confirms or declines through an authorized server-side transition. Confirmation moves the booking to the existing provider-confirmed state. Decline/cancellation follows the existing refund/cancellation case and financial reversal rules; never refund by direct balance edits.
8. When service starts, an authorized transition moves it to `in_progress`. Chat remains available for active coordination.
9. Service completion follows the unit-specific completion policy below. Disputes keep funds held and route to support/admin review.
10. After a valid completion and no blocking dispute, the existing escrow release and payout ledger path can be reused only if the service type's completion event is authoritative.

The chat timing above matches the existing booking-chat access model: paid/escrow-held, provider-confirmed, and in-progress bookings can communicate; terminal/rejected/cancelled/expired states do not retain an active send channel. Completed/disputed conversations are read-only according to the existing chat policy.

## 3. Unit-specific booking contract

| Pricing unit | Quantity | Required booking details | Completion signal |
|---|---|---|---|
| `per_hour` | Integer hours; initial cap 12 | Start/end, timezone, delivery mode, availability interval | Service end plus the approved customer/provider completion rule |
| `per_session` | Exactly one | Agreed start/end or structured duration in minutes, timezone, delivery mode | Session end plus the approved customer/provider completion rule |
| `per_day` | Whole calendar days only in first contract; no partial-day rounding | Start/end dates, timezone, explicitly defined daily working hours | Final booked day completed plus the approved customer/provider completion rule |
| `per_project` | Exactly one fixed-scope project | Deliverables, acceptance criteria, due date, included revisions, evidence and delivery mode | Explicit deliverable acceptance under a separate project state machine |

No unit may be converted into fake hourly duration. No partial hours/days are rounded. All totals are calculated in integer rupiah on the server.

## 4. Project service: do not enable in the first booking release

The current booking completion trigger schedules escrow release immediately when a booking becomes `completed`. Therefore project services must not be allowed to reach the ordinary completed state merely because the due date passes or a file is uploaded.

Before project checkout can be enabled, implement and test:
- deliverable submission with private evidence storage;
- an immutable agreed scope and acceptance criteria;
- included revision count and auditable revision requests;
- customer acceptance window and an explicit timeout outcome;
- a dispute/hold path that blocks escrow release;
- cancellation and partial-work refund rules;
- a separate server-enforced transition into the existing completed/release lifecycle.

Until then, project listings may be displayed and reviewed, but their booking/payment CTA must remain disabled.

## 5. Financial invariants

- Frozen `gross_amount`, `platform_fee_amount`, and `talent_gross_share` must reconcile exactly to the settled payment and ledger rows.
- Fee policy is versioned and chosen by YUKU Product/Finance. Do not assume the legacy 20% platform / 80% provider split automatically applies to every professional category.
- Listing price edits after booking creation do not alter the booking.
- A post-payment change of scope, quantity, time or price requires an auditable amendment accepted by both parties; never overwrite original snapshots.
- Settlement, refund, reversal, referral reward and payout remain idempotent and ledger-driven.
- No direct client-side updates to payment status, escrow release timestamps, provider earnings, or payout balances.

## 6. Safety and coordination rules

- Offline companion/social meetings remain restricted to safe public venues under the existing YUKU safety policy.
- Professional services use the delivery mode and location constraints approved for their taxonomy. Regulated roles (for example nursing/care) require the appropriate credential checks before publication/booking.
- Chat is for coordination, not off-platform payment. Any extra time, additional scope, travel charge, or add-on must be purchased through an approved in-app amendment/order flow; never rely on cash agreement or manual wallet edits.
- If the provider and customer cannot agree on distance, location, timing, or scope before the service begins, use the in-app cancellation/support path.

## 7. Release checklist

### Must pass before any professional booking CTA
- [ ] Additive booking-kind and immutable snapshot schema reviewed.
- [ ] Existing activity rows backfilled as `activity`; legacy category FK remains intact until all consumers migrate.
- [ ] Insert, update, status actor, financial calculation, refund and completion triggers branch safely by booking kind.
- [ ] Dedicated idempotent professional booking RPC validates listing lock, provider/customer eligibility, unit/quantity, timezone, availability/capacity, and server-calculated pricing.
- [ ] All booking consumers updated: customer history, provider dashboard, chat, Admin, finance, payment proof panels, checkout, webhook, ledger, refund, dispute, notification, review, export, referral and payout.
- [ ] RLS tests cover anon, customer, provider, authorized Admin, Super Admin and service role.
- [ ] Payment sandbox tests cover every enabled route, exact amount, replay, expiry and duplicate provider events.
- [ ] Refund, dispute, escrow release and payout allocation reconciliation passes.
- [ ] Regression suite proves existing activity booking totals, states, chat and payouts are unchanged.
- [ ] Mobile UI and Admin operational review complete.

### Additional gate before per-project checkout
- [ ] Deliverable/revision/acceptance/timeout/dispute state machine implemented.
- [ ] Project escrow cannot be released by the ordinary due-date or generic completion path.
- [ ] Project cancellation/refund and partial-work scenarios tested.

## 8. Current non-goals

- No production database changes.
- No change to payment feature flags or payment route configuration.
- No enabling of professional checkout.
- No migration repair or production migration execution.
- No new wallet or parallel ledger.
- No project milestone payments, deposits, split payments, or off-platform payment in the first release.

## 9. Product decisions still requiring explicit approval

1. Professional fee percentage by service class and the fee-policy version.
2. Completion authority for hourly/session/day services (customer confirmation, provider confirmation, or a defined timeout fallback).
3. Cancellation/no-show refund schedule for each pricing unit.
4. Exact meaning of a per-day booking (calendar day versus fixed work-hours block) and timezone boundary.
5. Whether providers may accept multiple concurrent project reservations in a future release.

Until these are approved and implemented, code must not guess these business rules.
