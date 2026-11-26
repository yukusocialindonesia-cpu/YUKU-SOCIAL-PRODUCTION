# Implementation Plan: Independent Professional Provider Identity

Branch: `feat/independent-professional-provider-identity`  
Base: `fix/yuku-final-service-taxonomy`  
Scope: architecture and implementation contract for Professional-only provider accounts.  
Status: Phase A–H are committed to this feature branch only: independent identity, independent applications/review/publication, independent public queries, server-derived profile completeness, non-recursive public RLS eligibility, independent private-document upload access, and Super Admin profile-read parity. Automated build/test and full regression verification remain outstanding. No database migration has been applied; no production data or deployment changed.

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
**Implementation checkpoint:** Additive profile table, owner/admin RLS, public-approved-listing read gate, and legacy presentation backfill are committed in `20261127004000_create_independent_professional_provider_profiles.sql`. The migration is not applied to any database.

1. Create `professional_provider_profiles` with RLS enabled and narrowly scoped owner-write/admin-read/public-approved-read policies.
2. Backfill one professional profile for every existing professional listing provider and application applicant, copying only presentation fields from `talent_profiles` where present. Existing provider IDs are already user IDs; do not mint new identities.
3. For legacy providers without a Talent profile, create a minimal profile only from existing application data and require the provider to complete presentation fields before publication.
4. Add the new FK to listings as a staged constraint (initially nullable or NOT VALID as appropriate); validate backfill before switching ownership.
5. Preserve the old FK/compatibility read path until all application, admin, public discovery, and profile consumers are switched. This FK transition is intentionally deferred until the dependent code and RPCs can move together.

### Phase B — provider application
**Implementation checkpoint:** The application page now reads/saves `professional_provider_profiles` and no longer checks for `talent_profiles`. Migration `20261127005000_allow_professional_only_applications.sql` replaces application INSERT/revision policies with active-account, complete-professional-profile, category/mode, and private-document ownership checks. These changes are branch-only and not deployed.

1. Replace `hasTalentProfile` with a professional-provider-profile state in `ProfessionalServiceApplicationPage`.
2. Let a signed-in account create/edit its own professional presentation profile independently.
3. Remove the Companion-profile existence requirement from the application INSERT policy, but retain `applicant_id = auth.uid()`, pending-only status, immutable review fields, and private-document path ownership checks.
4. Keep document upload private and category-specific credential/reference requirements unchanged.
5. Keep duplicate/open-application controls and status history intact.

### Phase C — admin review and publication
**Implementation checkpoint:** Migration `20261127006000_decouple_professional_review_and_publication.sql` switches the listing FK, review RPC, publication guard, and public listing policy to the independent provider identity. `AdminProfessionalServicesPage.tsx` hydrates applicant details from `professional_provider_profiles`. Super Admin read parity is added in `20261127010000_allow_super_admin_professional_profile_review.sql`.

1. Update the admin queue to hydrate applicant presentation from `professional_provider_profiles`, not `talent_profiles`.
2. Update the transactional review RPC to validate account status and professional profile readiness; do not require Companion approval.
3. Keep admin permission checks, document ownership/existence checks, credential gates, audit history, and atomic listing publication.
4. Update the listing FK and publication trigger to require an eligible professional provider profile and active account, plus active category and allowed delivery modes.
5. Public RLS must expose only approved, active listings with approved/active professional profiles and active accounts.

### Phase D — public discovery/profile
**Implementation checkpoint:** `ProfessionalServicesPage.tsx` and `ProfessionalProviderProfilePage.tsx` now query the independent professional profile relation and no longer require `talent_profiles`. Public eligibility is finalized by the non-recursive RLS helper in migration `20261127008000_prevent_professional_public_rls_recursion.sql`.

1. Update `ProfessionalServicesPage` provider joins and card data to use `professional_provider_profiles`.
2. Update `ProfessionalProviderProfilePage` to read the independent profile and its approved active listings.
3. Do not query or require `talent_profiles` for professional public identity.
4. Ensure a Professional-only provider never appears in Social Experience unless they separately create and pass Companion onboarding.

### Phase E — compatibility cleanup
**Implementation checkpoint:** `20261127007000_derive_professional_profile_completeness.sql` now derives `is_profile_complete` in a database trigger from display name, city, headline, and bio. This prevents a client from setting the boolean to `true` while leaving required presentation fields blank. Existing rows are recalculated by the same rule.

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

## Functional boundary after Phase A–H

The independent provider flow is implemented in this feature branch at the code level, including application, Admin review, publication, public discovery/profile, RLS eligibility, and private evidence upload. It is **not yet verified as an end-to-end release**: migrations have not been executed against staging, and build/typecheck plus role-based regression tests are still outstanding. Do not apply the migrations independently or treat the feature as production-ready.

## Release and safety boundary

This branch contains an implementation draft and a draft pull request for review/CI. Do not run migrations against Production, merge, deploy, enable professional checkout, or change payment behavior without separate explicit approval. Before release, require migration review, successful type/build checks, RLS/storage tests, and a documented rollback/compatibility plan.


## Additional security audit checkpoints

### Phase F — public RLS recursion
- Finding: the initial independent-profile public SELECT policy queried professional listings while the professional listing public SELECT policy queried provider profiles. Under RLS this can recursively evaluate the two policies.
- Fix: migration `20261127008000_prevent_professional_public_rls_recursion.sql` introduces a narrowly scoped SECURITY DEFINER eligibility helper and makes both public policies call that helper.
- Verification still required: execute against staging with RLS enabled for anon, owner, and admin roles; confirm public approved listings and profiles resolve without recursion and pending/inactive/disabled accounts remain hidden.

### Phase G — private evidence upload
- Finding: the pre-existing storage upload policy `20261127000200_restrict_professional_document_uploads.sql` requires a `talent_profiles` row. That blocks Professional-only providers from uploading required credentials despite the independent application form.
- Fix: migration `20261127009000_allow_independent_professional_document_uploads.sql` replaces the policy with active-account + complete independent provider profile + owner-folder checks. The bucket remains private and existing MIME/size restrictions remain.
- Verification still required: test owner upload/read/delete, other-user denial, admin read, anonymous denial, and confirm the bucket is private.

## Outstanding validation gate
- Run `npm ci`, `npm run lint`, and `npm run build` on this exact branch head.
- Execute all new migrations in order on a disposable/staging database built from the matching baseline.
- Run role-based RLS/storage tests for anon, customer, Professional-only provider, Companion-only provider, dual provider, and Talent Admin.
- Confirm no booking/payment action becomes available; Professional Services remains display/application-only until a separate booking contract is approved and implemented.
- No production migration, merge, or deploy is authorized by this implementation checkpoint.


### Phase H — Super Admin review visibility
- Finding: application and private-document review policies explicitly allow Super Admin, but the new independent provider profile SELECT policy initially allowed only owner and Talent-permission admins. A Super Admin without the Talent grant could see the application but not hydrate its provider profile in the review UI.
- Fix: migration `20261127010000_allow_super_admin_professional_profile_review.sql` adds the same explicit Super Admin allowance to independent profile reads.
- Verification still required: test both a Super Admin without Talent permission and a Talent-permission admin in staging.

### CI wiring
- The existing build workflow now includes the feature branch in push triggers and watches Supabase migrations. The workflow runs `npm ci`, `npm run lint`, and `npm run build`.
- A successful run for the current branch head has not yet been observed. Do not treat CI as passed until GitHub reports a completed successful run.
