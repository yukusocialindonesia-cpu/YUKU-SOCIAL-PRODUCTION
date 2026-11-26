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


## 5. Professional-only provider onboarding is also blocked

The current Professional Services application is not independent of the Companion provider identity:

- `professional_talent_services.provider_id` has a foreign key to `public.talent_profiles(id)`.
- `ProfessionalServiceApplicationPage` checks for a `talent_profiles` row before it can treat the user as an eligible provider.
- `ProfessionalProviderProfilePage` reads provider presentation fields by joining `talent_profiles`.
- The professional application approval workflow creates/updates a listing whose provider identity is still the Talent profile.

Removing only the frontend check would therefore leave database foreign keys, approval, public profile rendering, and provider eligibility inconsistent.

### Required architecture change

Create an independent professional-provider identity/profile linked directly to `public.users(id)`. Keep Companion `talent_profiles` optional. Then migrate the professional application/listing ownership, Admin review, public discovery/profile query, account eligibility helper, and RLS policies to that identity. Preserve existing professional listings by backfilling their provider identity from the current `talent_profiles.id` to the corresponding user ID, and retain a compatibility path until all consumers are switched.

Do not auto-create a public Companion listing merely to satisfy the current foreign key. A Professional-only provider must not appear in Social Experience unless they separately apply and are approved for that service line.

## 6. Professional Services also currently limits one listing per subcategory

The `professional_talent_services` table has `UNIQUE(provider_id, subcategory_id)`. Multiple distinct professional offers under one subcategory will need the same exact-listing identity discipline as Social Experience: each listing needs its own stable ID in the provider editor, Admin queue, public profile, and (when professional checkout is separately approved) booking snapshot. Do not drop the uniqueness constraint until listing edits/revisions and Admin decisions are keyed to an individual listing ID.

## 7. Updated safe implementation order

1. Establish independent provider identity for Professional Services while preserving existing providers/listings.
2. Complete exact-offer IDs and booking compatibility for Social Experience before enabling multiple same-category offers.
3. Add multi-listing professional submissions keyed by listing ID, retaining qualification/document review rules.
4. Update public profile and Admin review to operate on individual listing IDs.
5. Add regression tests for Companion-only, Professional-only, dual-line accounts, historical bookings, repeated same-category listings, and all approval states.
6. Keep professional checkout disabled until the separate booking lifecycle, fee, cancellation, and completion policies are approved and tested.

This section is an implementation audit only; it does not change schema, application behavior, production data, or release state.
