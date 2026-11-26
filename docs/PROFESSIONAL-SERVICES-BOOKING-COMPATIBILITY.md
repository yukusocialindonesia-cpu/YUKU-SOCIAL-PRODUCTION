# YUKU Professional Services — booking compatibility design

## Decision

Do not route professional-service listings through the current activity booking RPC as-is. Keep professional services discoverable and reviewable, but do not expose a booking or payment CTA until a dedicated compatibility migration is designed, tested, and reviewed.

## Why the current booking path is not compatible

The production schema and current `public.create_booking` function were inspected read-only. The legacy path is built around:
- A mandatory `bookings.activity_category_id` foreign key to `activity_categories`.
- A mandatory hourly duration model (`duration_hours`) with a maximum five-hour booking window.
- Rates resolved from `talent_services.custom_rate_override`, `talent_profiles.hourly_rate`, and `online_chat_rate`.
- A booking-mode rule derived from the legacy activity category.
- Existing availability slots interpreted as daily time windows.
- Payment, settlement, escrow, commissions, earnings, cancellation/refund, disputes, chat, and review workflows that all reference `public.bookings`.

Professional services use a separate taxonomy and can be priced per hour, session, day, or project. Inserting a synthetic legacy activity category or mapping a day/project price to an hourly amount would corrupt product semantics and could cause incorrect billing.

## Recommended direction

Extend the existing booking aggregate additively rather than creating a disconnected second payment system:
1. Add an explicit booking kind (legacy activity vs professional service) and a nullable `professional_talent_service_id` reference.
2. Make the legacy category relationship nullable only after adding a database check that requires exactly one valid service reference for each booking kind. Existing rows remain legacy activity bookings.
3. Add immutable pricing snapshots for professional service title, pricing unit, unit rate, quantity, and selected service mode. Do not reinterpret or overwrite legacy hourly snapshots.
4. Add a dedicated `create_professional_service_booking` RPC. It must lock and validate the approved/active listing, active Talent account and approved profile, active category/subcategory, selected delivery mode, price snapshot, customer eligibility/KTP/age checks, schedule rules, and duplicate pending-payment guard.
5. Branch financial calculation and validation triggers by booking kind. Keep the same gross, platform fee, Talent share, payment, escrow, and ledger invariants.
6. Audit every booking-dependent workflow before enabling the new kind: payment-route claim, QRIS and bank-transfer proof submission/review, settlement, payment expiry, booking status transitions, cancellation/refunds, disputes, earnings/commission ledgers, notifications, chat, reviews, customer history, Talent dashboard, and admin finance/support views.
7. Add regression tests proving all existing activity booking flows and financial snapshots remain unchanged.

## Pricing and scheduling rules to settle before implementation

- `per_hour`: quantity is hours; retain a maximum session length and schedule-slot validation.
- `per_session`: one agreed session; define duration and rescheduling/cancellation rules explicitly.
- `per_day`: quantity is days; define start/end dates and multi-day availability.
- `per_project`: quantity is one project or a milestone-based amount; define scope, acceptance, revision, cancellation, and dispute evidence.

A service's taxonomy delivery modes must constrain the booking mode. A provider cannot change a listing's price after a booking is created; the booking snapshot is authoritative.

## Rollout gates

- Migrations validated in a disposable Supabase project.
- RLS and RPC authorization tests for customer, Talent, admin, and anonymous actors.
- Financial invariants tested for every pricing unit and payment route.
- Cancellation, refund, dispute, escrow, and payout regressions pass.
- Mobile booking UX and admin operations are reviewed.
- Only then should professional-service booking and payment CTAs be enabled.

No schema or production data was changed as part of this compatibility audit.


## Proposed migration sequence — design only (2026-11-26)

This sequence is intentionally **not executable SQL**. It is the review contract for the future migration PR. No migration is authorized or applied by this document.

### Phase A — additive identification (no behavior change)
- Add `booking_kind` with values `activity` and `professional_service`, default `activity`, and NOT NULL. Backfill/verify all existing rows as `activity` before any later schema relaxation.
- Add nullable `professional_talent_service_id` FK to `professional_talent_services(id)`.
- Add a check constraint requiring exactly one service reference by kind: activity rows require the existing activity category and no professional listing; professional rows require a professional listing and no activity category. **Do not make `activity_category_id` nullable in this phase.**
- Add nullable professional snapshot columns (service title, category/subcategory labels and IDs, pricing unit, unit rate, quantity, currency, service mode, timezone, schedule/scope JSON with typed fields, fee-policy version, cancellation/acceptance policy version). Add checks that reject invalid unit/quantity combinations and non-positive rupiah values.
- Snapshot columns are write-once after insert for customer/Talent roles. Admin correction, if ever required, must use a separately audited amendment path; never silently rewrite a paid booking.

### Phase B — safe RPC and isolation
- Add a dedicated `create_professional_service_booking` RPC. Do not add a branch to the existing `create_booking` RPC until the old activity regression suite demonstrates no behavior change.
- RPC locks the professional listing row, verifies current provider eligibility and active taxonomy, validates mode and structured schedule/scope, calculates gross/fee/provider share server-side, and inserts a pending booking with an idempotency key.
- Preserve the existing activity RPC and its current global pending-payment guard for the first release. Do not quietly narrow that guard to per-kind; changing it is a separate product decision.
- Enforce one active project reservation per provider/listing until provider capacity is explicitly modelled. For timed units, reject overlapping intervals using a database-safe locking/constraint strategy, not only a client-side availability check.
- Reuse the existing financial columns as the canonical gross/fee/provider-share values, but ensure the professional RPC populates them consistently with the immutable professional snapshots.

### Phase C — consumer compatibility before any production data
- Update generated database types and all booking consumers to branch on `booking_kind`: customer history, Talent dashboard, Talent detail, chat, admin booking queue, payment proof panels, finance exports, notifications, reports, reviews, cancellation, dispute, refund, and payout views.
- Keep category enrichment conditional: only activity rows may query `activity_categories`; professional rows render their frozen professional category/service snapshots.
- Payment panels continue to submit booking IDs only as identifiers; server-side proof/checkout functions read the authoritative booking gross. Client amounts remain display-only claims.
- Payment route claims remain subject to the existing route-lock feature gate. No frontend change may bypass the server gate.

### Phase D — escrow and project acceptance (separate release gate)
- Existing completion trigger schedules escrow release immediately at completion, and the scheduled worker releases held earnings when there is no open/investigating report. This is acceptable only if the existing completion signal is authoritative for the service type.
- For `per_project`, do not transition to the existing `completed` state merely because the Talent uploads a deliverable or the due date passes. Add a reviewed deliverable-submission/acceptance state machine, a bounded included-revision counter, explicit customer acceptance, timeout rules, and dispute hold before connecting project completion to the existing release worker.
- Do not change the global escrow worker to infer project acceptance from a generic status or nullable timestamp. Any project-specific hold must be explicit, server-enforced, idempotent, and covered by payout/reversal tests.
- For hourly/session/day services, define the completion authority and auto-completion fallback before reusing the existing immediate-release policy.

### Phase E — validation and rollout
- Build a disposable Supabase project from the repository's full migration history; validate the migration chain from a clean database before considering production.
- Test RLS/RPC with anon, customer, Talent, authorized admin, super admin, and service role. Verify direct table writes cannot forge booking kind, financial snapshots, payment status, completion, or acceptance.
- Add tests for integer arithmetic, fee rounding, price tampering, listing price changes after booking, idempotent retries, duplicate pending payment, schedule overlap under concurrency, timezone/day boundaries, project capacity, expired payment, proof amount mismatch, duplicate webhook, refund reversal, payout allocation, active dispute, and escrow release.
- Run an activity regression fixture suite against representative legacy rows before and after every migration. Assert activity booking gross, fee, Talent share, status transitions, payment behavior, and UI labels remain unchanged.
- Only after all tests and visual review pass may a separate release decision enable professional booking. Checkout/payment route activation remains a separate decision from listing publication.

### Unresolved product decisions (must not be guessed in code)
1. Whether customer must confirm all professional service completions, and the timeout/auto-completion period for hourly/session/day.
2. Project acceptance window, number and timing of included revisions, evidence requirements, and what happens when the customer is unresponsive.
3. Whether per-day means calendar day or fixed working-hours block, and how multi-day schedules/timezones are interpreted.
4. Cancellation fee/refund schedule by unit and how provider/customer no-show is evidenced.
5. Commission policy by service class; the legacy 20%/80% split must not be assumed without explicit approval.
6. Project capacity and whether one provider can accept parallel projects.

### Current implementation status
- This is an architecture plan only. No booking schema migration, RPC, trigger, frontend booking action, payment route, or escrow behavior has been changed for professional services.
- The existing legacy `create_booking` RPC still gates on `system_feature_flags.payment_checkout`; professional listings remain discovery-only.
- Existing immediate escrow release policy is a specific blocker for project services until acceptance semantics are implemented.
