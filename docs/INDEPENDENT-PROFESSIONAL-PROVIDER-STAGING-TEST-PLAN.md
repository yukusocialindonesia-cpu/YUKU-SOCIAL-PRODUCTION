# Independent Professional Provider — Staging Test Plan

This checklist is required before merging or applying the feature migrations to production. It is a test plan, not evidence that tests have passed.

## 1. Migration rehearsal
- Create a disposable Supabase project from the same schema/migration baseline as the target environment.
- Apply all migrations in chronological order, including the new migrations 04000, 05000, 06000, 07000, 08000, 09000, and 10000.
- Confirm no migration errors, duplicate policy/function signatures, invalid FK rows, or trigger errors.
- Confirm every existing professional listing provider has a row in professional_provider_profiles before the FK switch.
- Confirm existing application IDs, listing IDs, provider UUIDs, status history, and private document paths are unchanged.

## 2. Account-type regression matrix
Test with separate authenticated users:
- Companion-only: can continue Companion workflows; no professional profile is created implicitly.
- Professional-only: can create a professional profile and submit an application without a talent_profiles row.
- Dual-line: can use both service lines under one account; each profile remains independent.
- Customer-only: cannot publish professional listings or submit provider applications without completing provider onboarding.
- Suspended/disabled: cannot submit, upload evidence, or retain public professional listings.

## 3. Profile and application security
- Owner can create/update only their own professional_provider_profiles row.
- Attempt to submit is_profile_complete=true with incomplete fields; database trigger must store false.
- Complete profile with active account can submit an application.
- Incomplete profile, inactive account, inactive category/subcategory, or unsupported delivery mode must be rejected.
- Applicant cannot edit reviewer fields, review notes, verification attestations, or another applicant's application.
- Duplicate open applications for the same provider/subcategory remain blocked.
- Revision workflow can update only the owner's needs_revision application.

## 4. Admin review and publication
- Talent-permission admin can review and hydrate the independent provider profile.
- Super Admin without a separate Talent grant can review and hydrate the same profile.
- Non-admin cannot call the review RPC successfully.
- Approval requires a complete profile, active account, active category/subcategory, valid delivery modes, required evidence, and a verification note of at least 20 characters.
- Verify document paths belong to the applicant and referenced objects exist in the private bucket.
- Rejected/revision/pending applications never create a public listing.
- Re-run approval on an already finalized application; it must be rejected without duplicate publication.

## 5. Public RLS isolation
- Anonymous and authenticated visitors can see only approved, active listings from complete profiles and active accounts.
- A provider with two listings (one valid and one whose category is inactive or delivery mode is incompatible) exposes only the valid listing.
- A provider with no valid public listing has no publicly readable provider profile.
- Pending, rejected, suspended, inactive, incomplete, or disabled-account providers remain hidden.
- Confirm profile/listing queries do not trigger recursive RLS errors.

## 6. Private evidence storage
- Bucket professional-service-documents remains private.
- Active Professional-only provider with complete profile can upload allowed PDF/JPG/PNG/WebP files within the configured 10 MB limit.
- Other users cannot upload into the provider's folder.
- Anonymous users cannot read documents.
- Owner can access only their own evidence; admin review can verify referenced object existence.
- Evidence referenced by an application cannot be deleted; replaced/unreferenced evidence can be removed according to policy.
- Verify MIME/size enforcement is also configured at bucket level; client validation is not a security boundary.

## 7. Release guard
- Run npm ci, npm run lint, and npm run build on the exact PR head.
- Run all tests above in staging and attach the results to PR #281.
- Confirm Professional Services booking, payment, cancellation, refund, and reviews are still not activated by this branch.
- Do not merge, deploy, or apply migrations to production until the owner explicitly approves after reviewing the results.
