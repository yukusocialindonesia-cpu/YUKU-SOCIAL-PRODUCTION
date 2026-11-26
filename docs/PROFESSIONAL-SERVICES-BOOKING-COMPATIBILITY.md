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
