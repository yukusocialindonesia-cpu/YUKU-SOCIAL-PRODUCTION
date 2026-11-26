# YUKU Account, Role & Navigation — Audit and Target Model

Audit date: 2026-11-27
Branch: `design/beranda-brand-promise-v2`
Status: source-level audit and product recommendation. No role, permission, route, database, or production behavior changed.

## Executive finding

The product direction is multi-role: one person may be a Customer and also operate one or more provider/business profiles. The current authorization foundation is still primarily a single-role account model. Professional Services has a separate provider profile/listing concept, but the application and publication gates still require the account to be a Talent. Merchant Partner has no account or management route yet.

This is a product/architecture gap, not a visual navigation issue.

## Current implementation observed in this branch

### Account roles and session

- `AuthContext` defines `UserRole = admin | talent | customer`; there is no Professional Provider or Merchant role.
- The session owner loads one role from `public.users.role`; navigation and post-login destinations branch on that single role.
- The auth audit documents a controlled Customer-to-Talent transition through `become_talent()`; the user cannot freely assign privileged roles from signup metadata.
- Admin access is separately permission-scoped and must remain separate from public marketplace/provider roles.

### Professional Services

- Professional provider profile/listing and application records are separate from the Talent profile UI.
- However, the application INSERT policy requires a matching `talent_profiles` row for the applicant.
- The review RPC checks that the linked Talent profile is approved before publication.
- The public visibility helper requires `users.role = talent`, an active account, verified age/KTP, and an approved Talent profile.
- Therefore a Customer who wants to offer only Professional Services cannot currently complete the full application-to-public-listing path without becoming a Talent first. A separate profile table alone does not make the account role independent.

### Merchant Partner

- No Merchant Center route, merchant onboarding route, merchant business role, or merchant account-management UI is registered in `App.tsx` / `AppRoute`.
- The homepage Merchant Partner card is explicitly a staged concept introduction, not an active feature.
- Existing `promotions` is a banner CMS and is not a merchant identity, merchant catalogue, or offer-redemption system.

### Navigation

- Existing routes include Talent discovery/dashboard, Professional Services discovery/application/admin review, Community, booking history, customer profile, and Admin.
- There is no distinct merchant discovery or Merchant Center route.
- A single role-driven navbar can hide or mislabel features when one account is expected to act as Customer plus provider. Navigation should eventually derive available workspaces from verified memberships/permissions, not a single exclusive role string.

## Target account model

Keep one authenticated human identity, but separate that identity from the profiles and capabilities they operate.

- **Customer capability:** available to every eligible signed-in account by default; browse, book, pay, manage own orders and profile.
- **Social Experience provider profile (Talent):** a separately reviewed profile for paid companionship and activities.
- **Professional Provider profile:** a separately reviewed profile for defined professional services, qualifications and service listings. It must not require a Talent profile as a prerequisite.
- **Merchant business profile:** a separately verified business entity with owner/member relationships, locations and offers. It is not a Talent or Professional Provider profile.
- **Admin permissions:** remain a privileged, separately provisioned permission system; never self-selectable during registration.

A person may hold Customer + Talent, Customer + Professional Provider, Customer + Merchant owner/staff, or several of these at once. The same login can switch between workspaces without merging their profile data or permissions.

## Target navigation

- **Beranda:** public/home discovery.
- **Jelajah:** three distinct destinations — Social Experience, Professional Services, Merchant Partner.
- **Community:** community participation.
- **Pesanan:** customer-side bookings/orders and history.
- **Workspace switcher / Profil:** show only workspaces the account actually has access to:
  - Customer
  - Talent Center (only when Talent profile exists / is eligible)
  - Professional Center (only when professional provider profile exists / is eligible)
  - Merchant Center (only when a verified merchant membership exists)
- **Admin:** visible only when the server-confirmed Admin permission allows it.

Do not show empty or nonfunctional Center links as if the feature were live. Pending applications should have a clear application-status entry, not an active provider dashboard.

## Required architecture changes before enabling multi-role onboarding

1. Define whether `users.role` remains a coarse account class or is retired from marketplace workspace selection. Do not repurpose it casually; existing RLS and RPCs depend on it.
2. Add explicit, server-managed capability/profile membership records or an equivalent normalized model for Talent, Professional Provider, and Merchant owner/staff memberships.
3. Update Professional Service application ownership and approval rules to reference the Professional Provider identity, not `talent_profiles` or the Talent role.
4. Rebuild professional public visibility checks around active account + age/identity eligibility + approved Professional Provider profile + approved active service listing. Keep credential/license checks service-specific.
5. Preserve Talent-specific booking and profile permissions only for Social Experience; do not grant Talent capabilities to Professional-only providers.
6. Add merchant business and membership models separately, with branch-scoped staff access and verified business lifecycle.
7. Update AuthContext to load server-confirmed capabilities/memberships and expose them as separate booleans/objects. Never trust user-editable metadata or client-provided role arrays.
8. Update Navbar, mobile navigation, login redirect, route guards and dashboard entry points to use those capabilities consistently.
9. Audit every RLS policy, SECURITY DEFINER RPC, Edge Function, Storage policy, Admin query and payment/booking path that currently assumes `users.role = talent`.
10. Provide a safe migration/backfill plan for existing Customers, Talents and Admins; preserve existing account access and avoid privilege escalation.

## Non-negotiable security boundaries

- A user may create/request their own provider or merchant profile, but cannot self-approve, self-verify, assign Admin, or set membership permissions.
- Provider profile ownership must be checked server-side on every write and private-file read.
- Merchant staff must be scoped to their own business and assigned locations; one business must never read another business's customer or operational records.
- Public discovery returns only approved/active public fields.
- Customer capability must not imply provider privileges; owning a provider profile must not imply Admin permissions.
- Professional Provider identity must not grant Talent booking, earnings, escrow, or payout permissions.
- Merchant membership must not grant access to Talent bookings, escrow, or financial records.
- Existing payment/booking behavior must remain unchanged while this identity foundation is migrated and tested.

## Release gates

Do not enable Professional-only registration or Merchant onboarding until:
- The schema and server-side authorization model support independent profiles/memberships.
- RLS and RPC tests cover Customer-only, Talent-only, Professional-only, combined-role, Merchant owner, Merchant staff, Admin and Super Admin accounts.
- Public visibility, private document access, account suspension, role revocation and workspace switching are tested.
- Existing Talent onboarding, booking, escrow, refunds, earnings and Admin permissions pass regression tests.
- All relevant migrations are validated in a disposable/staging Supabase project and CI is green.

## Immediate product conclusion

Keep the current Merchant Partner card as a clearly labelled planned partner program. Keep Professional Services discovery/application routes as currently implemented, but do not claim Professional-only onboarding is ready. The next engineering foundation should be an additive multi-profile/membership design, followed by migration of Professional Provider eligibility away from Talent-only dependencies. Merchant Center can then use the same secure membership pattern without being folded into Talent.
