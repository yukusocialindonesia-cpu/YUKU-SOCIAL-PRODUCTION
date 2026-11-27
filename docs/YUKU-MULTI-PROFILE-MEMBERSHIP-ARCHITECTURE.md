# YUKU Multi-Profile & Membership Architecture

Status: **Architecture proposal — documentation only**  
Scope: target account identity, provider profiles, merchant workspaces, authorization, migration and release gates.  
Safety: this document does not change the database, RLS, RPCs, routes, or production behavior.

## 1. Product decision

YUKU accounts represent people, not one mutually exclusive business role. A person may use YUKU as a customer and independently activate one or more workspaces:

- **Customer** — default consumer capability; no separate provider approval is needed to browse and request services.
- **Talent** — Social Experience provider profile (paid companionship and shared activities).
- **Professional Provider** — Professional Services provider profile. It must be possible without creating a Talent profile.
- **Merchant** — a business workspace, not a personal Talent category. A person may own or work for multiple merchant businesses.
- **Admin** — privileged staff access managed separately. It is never a self-selected profile or public marketplace identity.

A single person may hold Talent + Professional Provider + Merchant access concurrently. These capabilities must not overwrite each other.

## 2. Current-state constraints confirmed in the codebase

1. `AuthContext` currently normalizes one `public.users.role` value to `admin | talent | customer`; the client has no capability/membership collection.
2. `AppRoute` has Talent and Professional Services routes, but no Merchant Center or merchant onboarding routes.
3. The current professional application INSERT policy requires an existing `talent_profiles` row.
4. The current professional application approval RPC requires an approved Talent profile before publishing a Professional Service.
5. The public professional visibility helper currently requires `users.role = talent`, verified age/KTP, and an approved Talent profile.

Therefore Professional Services is currently coupled to Talent identity, despite being a separate product catalog. Merchant Partner is not yet a live account/workspace capability. These are design findings, not permission to change production.

## 3. Recommended logical model

Keep the authenticated human identity stable and model each business capability as a separate, server-governed profile or membership.

### 3.1 Human identity

- Keep one Supabase Auth user per human.
- Keep `public.users.id` as the stable person identifier and foreign-key anchor.
- Keep account-wide security state (active, suspended, banned), age/identity verification state, and global consent/security metadata attached to the person.
- Customer remains the default consumer capability; do not require a separate customer signup or duplicate auth identity.

### 3.2 Independent personal provider profiles

Retain distinct domain profiles with a shared person ID:

- `talent_profiles.user_id -> users.id` (or preserve current PK/FK `id` during compatibility period).
- New `professional_provider_profiles.user_id -> users.id`.
- Provider profile lifecycle should be explicit: `draft`, `pending_review`, `approved`, `rejected`, `suspended`, `closed`.
- Profile approval is separate per provider type. Approval of Talent must never imply Professional approval, and vice versa.
- Service listings remain separate child records and require their own category, credential, pricing, delivery-mode and moderation checks.

Do not force a generalized provider super-table in the first migration. The current Talent and Professional domains have different evidence, eligibility, booking and financial rules. A shared person ID gives multi-profile behavior without collapsing those domains prematurely.

### 3.3 Merchant business and memberships

Recommended entities:

- `merchant_businesses`: legal/display name, business status, public profile fields, verification state, owner reference and timestamps.
- `merchant_memberships`: `business_id`, `user_id`, membership role (`owner`, `manager`, `staff`), status and audit fields.
- `merchant_locations`: one or more addresses/branches scoped to a business.
- Future `merchant_offers`: informational promotions/vouchers with explicit validity, redemption and moderation rules.

Merchant membership is many-to-many: one person can access multiple businesses and one business can have multiple staff. Do not put merchant access in `public.users.role`. The first Merchant Partner release remains a directory/business profile with customer-to-merchant payment directly; it does not imply YUKU checkout, escrow, talent booking commission, or merchant settlement.

### 3.4 Admin access

Keep Admin permissions in the existing server-managed admin access system. Do not expose Admin as a profile users can add. All admin actions must continue to be checked server-side through permission-aware RPCs/policies, not merely by hiding client navigation.

## 4. Authorization invariants

1. The browser may request onboarding, but cannot grant itself a profile, membership, approval, verification or permission.
2. Profile creation and membership changes must be performed by narrow server-side RPCs or trusted workflows with explicit ownership checks.
3. RLS must scope each provider's private records to the authenticated `user_id`; merchant records must be scoped through an active membership for the exact `business_id`.
4. Public visibility is a boolean eligibility decision derived server-side from account status, required identity/age checks, profile approval, listing approval and active taxonomy.
5. A Professional Provider's public visibility must not query or require a Talent profile or `users.role = talent`.
6. A Talent profile's visibility must not be granted merely because a Professional profile is approved.
7. Suspending the person account blocks all personal provider profiles. Suspending one provider profile blocks only that marketplace capability unless account-level risk requires broader action.
8. Removing a merchant membership revokes that person's access to that business without affecting their other businesses or personal provider profiles.
9. Merchant owner transfer, staff invitation, and role changes require server-side authorization and immutable audit events.
10. Never trust client-supplied `role`, `is_admin`, `is_approved`, `business_id` membership, or verification claims.

## 5. Professional-only onboarding and publishing

The Professional Services flow should be independent:

1. Authenticated customer chooses “Daftar sebagai Profesional”.
2. Server creates or resumes the person's `professional_provider_profiles` record.
3. Applicant submits service details and category-specific evidence into private storage paths owned by that user.
4. Admin reviews identity/profile and service-specific evidence independently from Talent review.
5. Approval publishes only the approved Professional service listing.
6. Public listing visibility checks active person account, required age/KTP verification, approved Professional profile, approved active listing, active taxonomy and category-specific credentials.
7. Professional service booking and financial rules remain separate from Social Experience until a deliberate shared booking/financial model is designed and tested.

The existing Talent profile requirement in the professional application INSERT policy and review RPC must be replaced only as part of a reviewed migration with equivalent or stronger checks against the new Professional Provider profile. Do not simply remove the Talent check without adding the new independent checks.

## 6. Client session and navigation model

Replace the client assumption of one exclusive role with a server-confirmed access snapshot, conceptually:

```ts
type AccessSnapshot = {
  accountStatus: 'active' | 'pending_verification' | 'suspended' | 'banned';
  capabilities: {
    customer: { available: boolean };
    talent?: { status: ProfileStatus };
    professionalProvider?: { status: ProfileStatus };
    merchantMemberships: Array<{
      businessId: string;
      businessName: string;
      role: 'owner' | 'manager' | 'staff';
      status: 'active' | 'invited' | 'suspended';
    }>;
    admin?: { permissions: AdminPermission[] };
  };
};
```

This is a target contract, not a request to paste this type into the app before the server API exists.

- Load the access snapshot from an authenticated server-controlled RPC after session restoration.
- Treat errors as no newly verified privileges; never infer access from local storage, signup metadata or URL parameters.
- Refresh the snapshot after onboarding, approval notifications, membership changes, account status changes and app focus.
- Navigation should expose only workspaces the server confirms. Keep marketplace discovery available to customers.
- Add distinct routes/workspaces for Talent Center, Professional Center and Merchant Center; route guards must check the matching capability and status.
- Do not overload “Dashboard Talent” as the Professional or Merchant dashboard.
- Keep account/profile settings shared where appropriate, but separate provider/business settings and audit history.

## 7. Data migration strategy

Use additive, staged migrations with compatibility windows:

**Phase A — inventory and contract**
- Confirm actual production table definitions, constraints, triggers, RLS policies, RPC callers, generated Supabase types and client role checks.
- Define stable keys and lifecycle enums before creating tables.
- Document every consumer of `users.role`; do not assume it is safe to remove.

**Phase B — additive schema**
- Add `professional_provider_profiles` and merchant business/membership/location tables.
- Add unique and foreign-key constraints, indexes, audit columns and explicit lifecycle states.
- Add narrowly scoped RLS policies and security-definer RPCs with fixed search paths and revoked default execution.
- Keep existing Talent schema and legacy role column intact.

**Phase C — safe backfill**
- Backfill existing Professional applicants/listings into Professional Provider profiles only after validating source identity and current approval state.
- Preserve evidence paths, reviewer identity, review timestamps and historical decisions.
- Do not auto-approve records or infer merchant ownership from unrelated profile fields.
- Produce reconciliation counts and exception lists before enabling new reads.

**Phase D — dual-read / controlled cutover**
- Deploy server APIs and client access snapshot behind a feature flag.
- Compare legacy and new authorization decisions in staging; log mismatches without granting extra access.
- Migrate Professional visibility and onboarding to independent profile checks.
- Retain compatibility for existing Talent flows and booking history.

**Phase E — cleanup**
- Remove legacy role assumptions only after all client routes, RPCs, RLS policies, Edge Functions, analytics and operational scripts are migrated.
- Remove deprecated columns/constraints only in a separate reviewed release after usage evidence proves they are unused.

## 8. Required test matrix before release

| Scenario | Expected result |
|---|---|
| New customer account | Can browse; no provider workspace granted |
| Customer applies as Talent | Talent profile pending; no public listing until approved |
| Customer applies as Professional only | Professional profile pending; no Talent profile required |
| Professional approved, Talent absent | Professional listing visible if all required checks pass |
| Talent approved, Professional absent | Talent listing works; no Professional listing implied |
| Same person approved as both | Both workspaces available independently |
| Same person joins two merchants | Can switch between only those active businesses |
| Merchant staff removed | Access to that business revoked; other capabilities unaffected |
| Person account suspended | All personal listings hidden and personal actions blocked |
| One provider profile suspended | Only that provider capability hidden/blocked, subject to account risk policy |
| Client tampers with role/business ID | Server denies unauthorized access |
| Missing/failed access snapshot | No privileged workspace is rendered or authorized |
| Admin permission removed | Admin action denied server-side even if old UI remains open |
| Legacy Talent user after migration | Existing Talent access and booking history preserved |

Automate RLS tests with real authenticated JWTs and test both anon and authenticated public listing reads. Include concurrent membership revocation, approval, suspension and session-refresh tests.

## 9. Release gates and non-goals

Do not release until:
- Production schema inventory and migration dry-run are reviewed.
- RLS policy tests prove cross-user and cross-business isolation.
- Professional-only onboarding succeeds end-to-end in staging without a Talent row.
- Existing Talent onboarding, booking, payments, disputes and history regressions pass.
- Public profile responses expose only approved public fields.
- Admin audit events and permission revocation tests pass.
- Backfill counts and rollback plan are approved.

Non-goals for this architecture stage:
- No production schema change or migration.
- No new merchant checkout, escrow, payout or commission system.
- No automatic transfer of Talent approval to Professional Services.
- No client-only role switching or self-assigned admin access.
- No merge or deployment authorization.

## 10. Recommended implementation order

1. Build the additive Professional Provider identity and independent visibility path.
2. Build the server-owned multi-capability access snapshot and update AuthContext/navigation.
3. Add Merchant business, membership and location foundation.
4. Build Merchant Center and directory workflows.
5. Consider offers/vouchers only after merchant verification and redemption controls are ready.

**Decision requested at implementation review:** approve the architecture and migration plan before any database or authorization behavior is changed.
