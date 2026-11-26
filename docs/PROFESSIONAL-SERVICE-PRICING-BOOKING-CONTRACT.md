# YUKU Professional Service — Pricing & Booking Contract

Status: design specification only. No booking CTA, schema migration, RPC, payment path, or production data change is authorized by this document.

## Product decision

Professional services must use the existing YUKU booking, payment, escrow, commission, refund, dispute, payout, notification, and support lifecycle. Do not create a parallel wallet, payment ledger, commission table, or settlement path.

Keep the existing activity booking path behaviorally unchanged. Professional services are a second booking kind with their own validated pricing and immutable snapshots.

## Pricing units (MVP contract)

| Unit | Customer quantity | Required scheduling/scope data | Amount |
|---|---|---|---|
| `per_hour` | Whole hours only; minimum 1; maximum 12 per booking in the initial professional flow | Start/end, timezone, selected delivery mode, provider availability; end derived from quantity | unit rate × hours |
| `per_session` | Exactly 1 session | Agreed start and end (or an explicit duration in minutes), timezone, delivery mode | fixed session rate |
| `per_day` | Whole calendar days only in MVP; minimum 1; maximum 30 | Start date, end date, timezone, delivery mode; define day boundary in provider/customer locale before launch | daily rate × days |
| `per_project` | Exactly 1 fixed-scope project in MVP | Scope, deliverables, included revisions, due date, acceptance criteria, delivery mode | fixed project price |

Do not silently round partial hours/days or represent sessions/projects as fake hours. If partial-day or milestone billing is later required, add a separately reviewed contract version rather than changing the meaning of existing bookings.

## Snapshot contract

At booking creation, the server must copy and freeze:
- booking kind and professional listing ID;
- provider and customer IDs;
- category and subcategory IDs plus their display labels;
- service title and description/scope shown at checkout;
- pricing unit, unit rate, quantity, currency, and gross amount;
- platform fee, provider share, and fee-policy version;
- delivery mode, service location/meeting details where applicable;
- start/end or due date, timezone, and agreed duration;
- cancellation, reschedule, completion/acceptance policy versions;
- project deliverables, included revisions, and acceptance criteria for projects.

Historical booking display and financial reporting must use these snapshots, never current listing text, current category labels, or current provider rates.

## Server-side booking validation

A dedicated professional booking RPC must:
1. Require authenticated, eligible customer and approved/active provider, consistent with current YUKU trust requirements.
2. Lock the selected listing and relevant availability rows while validating.
3. Confirm listing approval/active state, active subcategory and parent category, selected delivery mode, and required verification state.
4. Validate pricing unit and quantity exactly as defined above; compute every amount server-side using integer rupiah values.
5. Check availability overlap using the actual time interval for hourly/session bookings and date interval for daily bookings. Project bookings require an agreed due date and must use a provider-defined capacity rule; MVP should permit only one active project reservation per provider/listing unless capacity is explicitly modelled.
6. Enforce the existing pending-payment reservation policy without accidentally blocking unrelated booking kinds unless that is the documented global rule.
7. Create a booking with an idempotency key and immutable snapshots. Repeated requests with the same key must return the same booking, not duplicate it.
8. Never accept client-supplied gross, fee, provider share, approval state, or payment status as authoritative.

## Financial invariants

- The existing financial ledger remains the single source of truth.
- The booking row's frozen gross, platform fee, and provider share must reconcile exactly to the payment amount and ledger entries.
- Fee calculation must use a versioned policy. The currently documented 20% platform / 80% provider split must not be assumed for all future service classes without product approval.
- Settlement remains server-only and idempotent.
- Refund, cancellation, dispute, chargeback, and payout holds must operate on the same booking aggregate and reverse/hold the correct frozen allocations.
- Provider listing edits after booking creation must not change any existing booking amount or scope.
- Any post-payment scope, price, or deadline change requires an auditable amendment accepted by both parties; do not update the original snapshots in place.

## Completion and acceptance

- Hourly/session/day bookings need a clear service-completed signal and customer confirmation or the existing YUKU fallback/auto-completion policy.
- Project bookings need deliverable submission evidence, an acceptance window, a revision path limited to the agreed included revisions, and a dispute path.
- Do not auto-release project escrow solely because a due date elapsed. Define a reviewed acceptance/timeout policy first.
- Keep evidence and identity documents in private storage; never place them in public buckets.

## Frontend contract

Use a discriminated booking view model: `activity` or `professional_service`.

- Activity rows continue to use legacy activity category, hourly rate, duration, and existing UI behavior.
- Professional rows use snapshot title, unit, quantity, scope, and delivery dates.
- Category enrichment for activity rows only; professional history must not query legacy `activity_categories` for a null category.
- Update customer, provider, chat, booking history, admin, finance/export, payment, cancellation, review, dispute, and notification surfaces together.
- The provider's current profile/listing is not the source for historical booking labels or prices.

## Implementation gates (in order)

1. Inventory all constraints, triggers, RLS policies, views, RPCs, Edge Functions, generated types, and frontend consumers of `bookings`.
2. Implement additive schema and backfill existing rows as `activity`; do not make legacy `activity_category_id` nullable until every dependent object is migrated and tested.
3. Add database tests for the four units, invalid quantities, price tampering, concurrent slot booking, idempotency, and listing suspension during checkout.
4. Refactor financial snapshot calculation to branch by booking kind while preserving byte-for-byte equivalent legacy activity calculations where practical.
5. Implement a dedicated professional booking RPC with row locks and server-side calculations.
6. Update payment, proof review, settlement, escrow, completion, cancellation, refund, dispute, commission, referral, payout, chat, notification, review, admin, finance, and history consumers.
7. Test legacy activity bookings and every payment route against historical fixtures.
8. Run full end-to-end and reconciliation tests in disposable/staging Supabase before any production rollout.

## Explicit non-goals for the first release

- No partial-day billing.
- No multi-milestone project payments.
- No provider-entered custom quote negotiation.
- No split payments or deposits.
- No off-platform payment.
- No professional-service booking/payment CTA until all release gates pass.
