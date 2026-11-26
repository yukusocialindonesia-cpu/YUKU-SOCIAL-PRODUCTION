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


## Additive shared-booking data contract (design gate; not yet a migration)

The existing `public.bookings` table is activity-first: `activity_category_id`, `start_time`, `end_time`, `duration_hours`, and `hourly_rate_snapshot` are NOT NULL and its exclusion constraint reserves a time range. Professional services must not be forced into fake hourly/activity values.

### Proposed additive fields

| Field | Type / rule | Purpose |
|---|---|---|
| `booking_kind` | text/enum, default `activity`, NOT NULL | Discriminates existing activity bookings from `professional_service`. Existing rows backfill to `activity`. |
| `professional_listing_id` | uuid nullable FK to approved professional listing | Links the listing selected at checkout; historical snapshot remains authoritative. |
| `service_title_snapshot` | text nullable | Frozen service title at checkout. |
| `service_category_snapshot` | text nullable | Frozen category/subcategory labels. |
| `pricing_unit_snapshot` | text nullable; `per_hour`, `per_session`, `per_day`, `per_project` | Defines the actual price unit. |
| `unit_rate_snapshot` | bigint nullable, positive | Frozen unit price in integer rupiah. |
| `quantity_snapshot` | numeric nullable, positive | Number of units, with precision/range bounded by unit. |
| `delivery_mode_snapshot` | text nullable; `online`, `offline`, `hybrid` | Frozen delivery mode for professional service. |
| `service_scope_snapshot` | jsonb nullable | Structured deliverables, inclusions, exclusions, and agreed notes. |
| `service_due_at` | timestamptz nullable | Deadline for day/project services where applicable. |
| `cancellation_policy_snapshot` | jsonb nullable | Frozen cancellation/refund policy and relevant cutoff values. |

### Required invariants

- For `booking_kind='activity'`, current legacy fields and existing behavior remain required and unchanged.
- For `booking_kind='professional_service'`, professional listing and service/pricing snapshots are required; legacy activity category/hourly fields must not be fabricated.
- `gross_amount`, `platform_fee_amount`, and `talent_gross_share` remain the canonical immutable financial snapshots consumed by payments, commissions, earning ledger, refund and payout systems.
- Server RPC calculates every amount from the active listing and validated quantity. Client-submitted rates, fee, share, totals, service labels, or provider identity are never trusted.
- A booking keeps the agreed snapshot even if the provider edits or deactivates their listing later.
- Activity time-range exclusion remains activity-only. Professional capacity/availability must use a separate validated rule; do not insert arbitrary placeholder time ranges.
- Existing RPC `create_booking()` and existing Admin `get_admin_bookings()` remain unchanged for compatibility. Add dedicated professional checkout RPC and `get_admin_bookings_v2()`; migrate consumers before deprecating legacy contracts.
- The professional checkout RPC must be idempotent, lock the listing/provider availability rows, re-check account/KTP/profile eligibility, enforce service unit and quantity bounds, and create the shared booking/payment aggregate in one transaction.

### Important decision still required before SQL

The current service taxonomy supports four units, but quantity and scheduling semantics need explicit constraints:
- `per_hour`: quantity in hours, start/end and capacity lock required.
- `per_session`: quantity in sessions; decide whether one booking may contain multiple sessions and how each session is scheduled.
- `per_day`: quantity in calendar days, with timezone and inclusive/exclusive end-date rule.
- `per_project`: scope and deliverables must be accepted before checkout; checkout remains disabled until acceptance, revision limits, milestones, cancellation, partial-work refund and dispute rules are approved.

### Safe rollout sequence

1. Add nullable/additive columns and backfill existing rows to `booking_kind='activity'`; do not relax legacy NOT NULL fields yet.
2. Add constraints that validate professional rows without changing activity rows. Validate existing production rows before adding strict constraints.
3. Add dedicated professional checkout RPC and idempotency tests; do not call legacy `create_booking()`.
4. Add v2 read RPCs and migrate Customer history, Talent dashboard, Admin booking, finance, refund, payout, notification and report consumers.
5. Implement unit-specific availability, cancellation, refund and completion rules.
6. Run staging migrations and regression/security tests for both booking kinds.
7. Only after all consumers and finance paths pass, consider relaxing activity-only NOT NULL constraints and enabling the professional checkout feature flag.

No schema change or production mutation is included in this design document. This contract is intentionally additive so the existing activity checkout remains operational during rollout.


## Schedule changes, lateness, extensions and off-platform payment — audit gate (2026-11-26)

### Existing behavior verified

- Booking creation snapshots the agreed start time, end time, duration, location, rate and total on the server. Legacy activity checkout requires at least 2 hours' lead time, a duration up to 5 hours, and checks the Talent availability window in Asia/Jakarta.
- Once a booking is paid/escrow-held or confirmed, the booking update validator rejects unilateral changes to start/end time, duration and meeting location. This is an important protection against either party silently changing the paid contract.
- There is no dedicated Customer/Talent reschedule request-and-accept RPC or UI flow in the inspected pages. Therefore, the current product should not imply that a booking can be rescheduled in chat.
- Customer cancellation is allowed only before the booked start time; the server RPC locks the booking, checks ownership/status, and snapshots a cancellation policy based on time before `start_time`. Talent cancellation is available only while paid funds are held in escrow or Talent-confirmed; it creates a full-payment refund request and cancels the booking.
- The Customer cancellation policy currently uses >24 hours (full automatic refund request), 6–24 hours (50% refund request and 50% retained for Admin decision), and <6 hours (no automatic refund and full amount retained for Admin decision). Actual refunds are manually executed by Finance and require an external provider/bank reference before being marked processed.
- Customer cancellation after the start time is rejected by the RPC and directs the user to report the issue to Admin. The current booking UI only offers cancellation for future start times.
- No separate booking extension / add-hours / add-day / add-scope RPC or UI was found in the inspected Customer history and Talent dashboard flows. Chat is communication, not a payment or contract amendment mechanism.

### Product/security decision

1. **Never settle extra time or scope privately.** If Customer and Talent agree in chat to add time, an extra day, a changed location with extra travel cost, or additional deliverables, that agreement must not create an off-platform cash obligation. Chat agreement alone must not modify the paid booking or escrow amount.
2. **No unilateral schedule edit after payment.** Preserve the current immutable booking snapshot. A future reschedule flow must be an explicit request by one party and acceptance by the other, with both parties seeing old and proposed time/location, expiry, cancellation consequence and any price difference before acceptance.
3. **Reschedule must re-check availability atomically.** The server must lock the booking and relevant Talent availability/capacity rows, verify booking state and lead time, reject overlap, and write an immutable before/after audit record. Never trust a client-side availability check.
4. **Paid price changes need a first-class amendment.** If a change adds cost, create a separate amendment/add-on record linked to the booking, calculate the amount server-side, collect payment through YUKU's existing payment rails, and hold it in escrow before the extra work begins. Do not overwrite the original gross/fee/share snapshots or reuse the original payment as if the extra amount were paid.
5. **If no add-on checkout exists, do not allow paid extensions.** Offer only the originally purchased duration/scope. For a request beyond it, require a new booking or wait until a proper in-app add-on flow exists. Clearly tell both parties that cash/transfer outside YUKU is not protected by YUKU escrow.
6. **No-show, lateness and waiting time need an explicit policy.** Define grace period, how either party records arrival, evidence requirements, who can report no-show, when a session can start/complete, and whether unused time is refunded/compensated. Until defined, do not automatically mark a booking completed merely because the scheduled end time passes.
7. **Project scope must be accepted before checkout.** Per-project booking requires a versioned scope/deliverables, milestones, revision limits, due date, acceptance window, evidence, late delivery, cancellation and partial-refund rules. It must not use the hourly activity cancellation calculation.
8. **Cancellation policy must be versioned and unit-aware.** Keep the existing activity policy unchanged. Professional per-hour/per-session/per-day/per-project services need their own policy snapshots and timezone-aware anchors; the current fixed activity 24h/6h formula must not be inherited.
9. **Support path after start time.** When cancellation is no longer available, provide a booking-specific report/support route for late Talent, Customer no-show, unsafe meeting point, service mismatch or inability to contact. Evidence and timestamps must be retained and visible only to authorized Support/Admin reviewers.
10. **User-facing terms must be explicit before payment.** Show booked duration/scope, start/end, location or delivery mode, what is included, what counts as extra work, cancellation/no-show rules, and a warning that extra payment outside YUKU is not escrow-protected.

### Required regression tests

- Paid/confirmed booking: Customer and Talent direct UPDATE attempts to start/end/duration/location are rejected; only an authorized amendment workflow can change schedule.
- Reschedule request: one party proposes; other party rejects/accepts; expired proposal cannot be accepted; two concurrent proposals cannot both win; availability overlap is rejected under row lock; old schedule remains on rejection.
- Add-on: price is server-calculated; one payment route per add-on; add-on payment is held before extra work; duplicate checkout/webhook does not double charge or double-credit; refund/dispute reconciles original booking and add-on separately.
- No add-on feature: UI does not expose an “extend” action or promise additional time; chat cannot change the amount or booking duration.
- No-show/late: test both parties late, no-show, arrival evidence, grace-period expiry, report during/after scheduled window, and prevent automatic completion/release without valid completion.
- Cancellation: test unpaid, >24h, 6–24h, <6h, after start, Talent cancellation, duplicate requests, payment route variants, Finance provider reference, partial refund, active dispute and payout already allocated.
- Professional units: verify per-hour/per-session/per-day/per-project use their own cancellation, scheduling and completion rules; project remains checkout-disabled until acceptance/partial-refund lifecycle is approved.

No reschedule, extension, pricing, cancellation, or production behavior was changed by this audit.
