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


## Provider listings and profile page
A second additive migration creates `public.professional_talent_services`, linking an existing approved Talent profile to a professional-service subcategory with service description, experience, service location, delivery modes, rate, and pricing unit. Public SELECT is limited to active/approved listings whose linked Talent profile is approved. No client INSERT/UPDATE policy is granted yet; provider onboarding and admin review must be implemented before creating listings.

Frontend additions:
- `/jasa-profesional` shows approved provider cards when any are available.
- `/jasa-profesional/:id` displays the provider's public profile, approved services, price, service mode, experience, and verification requirements.
- The profile intentionally has no booking/payment action. A YUKU profile approval badge is not a substitute for regulated professional license verification.

The new provider-listing migration is also not applied to production. Validate both migrations in a disposable Supabase project before any production rollout.


## Provider application intake
The `professional_service_applications` migration adds a private application workflow. Signed-in users must first have a YUKU Talent profile, then submit one service per application with description, experience, service area, delivery mode, proposed rate, and applicable credentials. Applicants can read only their own submissions; users cannot set review outcomes. Admin read/review access is restricted to the existing Talent permission scope.

Credential and supporting files are stored in a dedicated private Storage bucket (`professional-service-documents`), with a 10 MB limit and PDF/JPG/PNG/WebP MIME allowlist. The owner can access their own files; authorized Talent admins can read documents for review. No public bucket or public document URL is used.

The application route is `/daftar-jasa-profesional`, linked from the professional-services discovery page. Approval is still a review state only; the next implementation step is the admin review UI and a controlled publication step that creates an approved listing. No booking/payment action is available.


## Admin review and publication
The `/admin/jasa-profesional` page is available to admins with the existing Talent permission. It displays applicant profile details, service description, proposed rate and mode, verification requirements, and short-lived signed links to private credential files. Admin actions are handled by `admin_review_professional_service_application`, a transactional SECURITY DEFINER function that checks the Talent permission, locks the application row, and publishes an approved listing only if the associated Talent profile is approved and any required credential path is present. Other decisions can mark an application under review, rejected, or needing revision.

The RPC does not make a regulated professional credential valid by itself: an authorized reviewer must inspect the actual document and applicable professional authorization before choosing approval. No booking or payment integration is included.


## Security hardening and applicant revisions
A follow-up migration removes direct admin table updates, requires a Talent profile for application inserts, scopes all document paths to the applicant's own folder, checks that referenced evidence exists in the private bucket before publication, and prevents deletion of documents while an application references them. It also limits each applicant to one open application per service type.

When an admin requests revisions, the applicant can edit and resubmit that same application. The database update policy permits only the transition from `needs_revision` back to `pending`, and clears reviewer metadata; applicants cannot directly change an application to an approved or rejected state.
