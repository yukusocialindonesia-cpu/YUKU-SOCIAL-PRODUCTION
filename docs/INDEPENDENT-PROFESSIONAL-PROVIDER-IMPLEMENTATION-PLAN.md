# Implementation Plan: Independent Professional Provider Identity

Branch: `feat/independent-professional-provider-identity`  
Base: `fix/yuku-final-service-taxonomy`  
Scope: architecture and implementation contract for Professional-only provider accounts.  
Status: planning checkpoint; no application code, schema, production data, or deployment changed.

## Product requirement

A YUKU account may be:
- Social Experience / Companion only.
- Professional Services provider only.
- Both, using one login and account.

Professional Services must not require a Companion `talent_profiles` row, Companion approval, or a public Companion listing. Existing Companion accounts and historical professional applications/listings must continue to work.

## Current blockers verified in code

1. `professional_talent_services.provider_id` references `public.talent_profiles(id)`.
2. Public listing RLS and `guard_professional_talent_service_publication()` require an approved `talent_profiles` row.
3. `ProfessionalServiceApplicationPage` checks `talent_profiles` and blocks users without it.
4. The application INSERT policy in `20261126160000_harden_professional_service_application_security.sql` requires a matching Talent profile.
5. `admin_review_professional_service_application()` checks Companion approval before publishing a professional listing.
6. `ProfessionalProviderProfilePage` joins `talent_profiles` for provider presentation.
7. `AdminProfessionalServicesPage` hydrates applicants from `talent_profiles`.

Removing only the page-level gate would not produce an independent provider flow.

## Target identity model

Introduce `public.professional_provider_profiles`, keyed by the authenticated account ID:
- `user_id uuid primary key references auth.users(id)`
- public presentation fields owned by this service line: `display_name`, `avatar_url`, `city`, `headline`, `bio`
- optional public contact/preferences only if separately approved; never expose private identity documents
- timestamps and profile completeness/status fields as needed

Keep `talent_profiles` unchanged and optional. Do not create a Companion profile automatically.

Professional applications already use `applicant_id references auth.users(id)`; retain that identity. Professional listing ownership should resolve to the same account ID, but its FK must reference the independent professional profile rather than `talent_profiles`.

## Safe migration sequence

### Phase A — additive identity and compatibility
1. Create `professional_provider_profiles` with RLS enabled and narrowly scoped owner-write/admin-read/public-approved-read policies.
2. Backfill one professional profile for every existing professional listing provider and application applicant, copying only presentation fields from `talent_profiles` where present. Existing provider IDs are already user IDs; do not mint new identities.
3. For legacy providers without a Talent profile, create a minimal profile only from existing application data and require the provider to complete presentation fields before publication.
4. Add the new FK to listings as a staged constraint (initially nullable or NOT VALID as appropriate); validate backfill before switching ownership.
5. Preserve the old FK/compatibility read path until all application, admin, public discovery, and profile consumers are switched.

### Phase B — provider application
1. Replace `hasTalentProfile` with a professional-provider-profile state in `ProfessionalServiceApplicationPage`.
2. Let a signed-in account create/edit its own professional presentation profile independently.
3. Remove the Companion-profile existence requirement from the application INSERT policy, but retain `applicant_id = auth.uid()`, pending-only status, immutable review fields, and private-document path ownership checks.
4. Keep document upload private and category-specific credential/reference requirements unchanged.
5. Keep duplicate/open-application controls and status history intact.

### Phase C — admin review and publication
1. Update the admin queue to hydrate applicant presentation from `professional_provider_profiles`, not `talent_profiles`.
2. Update the transactional review RPC to validate account status and professional profile readiness; do not require Companion approval.
3. Keep admin permission checks, document ownership/existence checks, credential gates, audit history, and atomic listing publication.
4. Update the listing FK and publication trigger to require an eligible professional provider profile and active account, plus active category and allowed delivery modes.
5. Public RLS must expose only approved, active listings with approved/active professional profiles and active accounts.

### Phase D — public discovery/profile
1. Update `ProfessionalServicesPage` provider joins and card data to use `professional_provider_profiles`.
2. Update `ProfessionalProviderProfilePage` to read the independent profile and its approved active listings.
3. Do not query or require `talent_profiles` for professional public identity.
4. Ensure a Professional-only provider never appears in Social Experience unless they separately create and pass Companion onboarding.

### Phase E — compatibility cleanup
1. Verify all consumers no longer depend on the old provider FK or Talent-profile join.
2. Validate the new FK and remove old compatibility constraints only in a later migration.
3. Keep existing application IDs, listing IDs, provider user IDs, review history, and storage paths stable.
4. Do not alter booking/payment activation; Professional Services checkout remains disabled until its separate lifecycle is approved.

## Required regression matrix

- Companion-only account can continue using Social Experience.
- Professional-only account can create a professional profile, submit an application, and appear publicly only after approval.
- Dual-line account can use both service lines without duplicate account/login.
- Professional-only account does not receive an implicit Companion profile/listing.
- Existing approved professional listings remain visible after backfill.
- Existing pending/revision/rejected applications remain accessible and reviewable.
- Applicant cannot read another applicant's private documents or alter review fields.
- Suspended/banned accounts cannot publish or retain public active listings.
- Admin review still enforces credential/license and reference evidence requirements.
- Unapproved, inactive, or deleted professional profiles do not leak public listings.

## Release and safety boundary

This branch is a code-planning checkpoint only. Do not run migrations against Production, merge, deploy, enable professional checkout, or change payment behavior without separate explicit approval. A future implementation PR must include migration review, type/build checks, RLS tests, and a documented rollback/compatibility plan.
