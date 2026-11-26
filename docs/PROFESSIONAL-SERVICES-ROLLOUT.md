# YUKU Professional Services — rollout notes

## Scope
This is an additive taxonomy for professional and daily services. The existing six rows in `public.activity_categories` and the current booking foreign key remain unchanged.

## New taxonomy
- Travel & Tourism: tour guide, travel companion, travel interpreter.
- Caregiving & Childcare: nurse, elderly caregiver, patient companion, babysitter.
- Personal Assistance: personal assistant, personal shopper.
- Transportation: private driver, chauffeur.
- Home Services: housekeeper/ART, cleaning, garden maintenance.
- Business & Consulting: business, legal, and tax consultants.
- Creative & Digital: graphic design, photography, videography/editing.
- Events & Hospitality: MC/host, event crew/usher.
- Beauty & Wellness: makeup artist, personal trainer.
- Pet Services: pet sitter, dog walker.
- Technical & Repairs: AC and electronics technicians.
- Language & Education: private tutor, translator.

## Verification levels
- `identity`: identity check.
- `reference`: identity plus reference/portfolio checks.
- `credential`: verify relevant training, certificates, or professional experience.
- `license`: verify current statutory/professional license where the service requires one.

A label in this taxonomy is not itself proof of qualification. Do not publish or enable regulated services until the relevant verification workflow, reviewer permissions, document storage, expiry/revalidation, and audit trail are implemented.

## Important implementation boundary
The existing `talent_services.activity_category_id` and `bookings.activity_category_id` are NOT repointed by this migration. Do not create production bookings for these new service types until a separate compatibility change is designed and tested end-to-end across service listing, checkout, payment, booking snapshots, cancellation, payout, disputes, and admin review.

## Rollout
1. Review and apply the SQL migration in a non-production Supabase environment.
2. Add read-only category browsing to the app.
3. Design talent-service and booking compatibility before enabling booking.
4. Add credential verification workflows and admin tooling.
5. Run RLS, authorization, integration, and mobile UI tests.
