# Audit: Talent-Defined Services

## Current state

The draft branch includes a first version of custom Social Experience offerings:
- Talent can submit a title, description, category, and optional rate.
- New submissions are pending until Admin review.
- Public marketplace mapping includes approved and active custom offerings only.
- Admin can approve or reject submissions.
- Existing category IDs and legacy service rows are preserved.

## Confirmed architectural blockers

### 1. One service row per category

The original `talent_services` table has the constraint `uq_talent_activity UNIQUE (talent_id, activity_category_id)` in migration `02_services_and_availability.sql`. The current custom-service RPC also looks up an existing row by talent and category. As a result, one Talent cannot yet submit multiple distinct offerings inside the same category.

Do not simply drop this constraint: booking currently identifies the requested service through `bookings.activity_category_id`, and the booking guard checks approval by talent plus category. Multiple offerings in one category would be ambiguous for booking, rate selection, cancellation, and order history.

### 2. Booking must identify the exact offering

Before allowing multiple offerings per category, introduce a stable service-offering ID and carry it end-to-end:
- Talent service record and Admin approval queue.
- Public profile and Jelajah selection.
- Booking creation and server-side validation.
- Price/rate snapshot and order history.
- Payment, cancellation, refund, and review association.
- Existing bookings must remain readable and retain their legacy category-based meaning.

A safe migration should add a nullable service ID to bookings first, keep legacy rows valid, then update all booking creation paths and database guards before enabling multiple offerings. Do not make the new service ID mandatory for historical bookings.

### 3. Professional Services is a separate workflow

The custom offering RPC in this branch targets `talent_services` / Social Experience only. Professional Services uses `professional_talent_services` and its application/review workflow. It must not be presented as if this custom Social Experience form already supports arbitrary Professional Services listings. A matching professional custom-service proposal needs its own qualification/document rules and Admin review, without bypassing the existing verification gates.

### 4. Display identity

The current profile renderer keys custom offers by category ID. That is only unique while there is at most one offer per category. When offering IDs are introduced, the renderer must key by offering ID and display the exact category plus offer title.

## Safe implementation sequence

1. Keep the current one-offer-per-category behavior until booking can identify an exact offer.
2. Design the offering-ID migration and update booking creation, validation, pricing snapshots, and history in a dedicated branch/PR.
3. Add multi-offer submission and per-offer edit/resubmit/disable controls after the end-to-end booking path is ready.
4. Extend Professional Services separately through its existing application and verification model.
5. Test legacy bookings, pending/rejected/approved states, inactive categories, multiple offers in one category, and Admin authorization.
6. Keep production migrations and deployment gated behind explicit approval.

## Release boundary

This audit is documentation only. It does not run migrations, modify production data, enable bookings/payments, merge a PR, or deploy the production application.
