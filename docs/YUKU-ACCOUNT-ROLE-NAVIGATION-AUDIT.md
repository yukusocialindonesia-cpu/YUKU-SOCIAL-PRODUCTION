# YUKU Account, Role & Navigation — Current Branch Audit

Audit date: 2026-11-27
Branch: `design/beranda-brand-promise-v2`
Status: source-level review. Branch implementation is not proof of deployed schema or successful Staging authorization tests.

## Executive finding

The branch has moved beyond the older single-role design. It now contains a server-derived account access snapshot for Customer, Talent, independent Professional Provider, and Merchant memberships. It also registers Merchant Center, Merchant Partner discovery, and Super Admin merchant review routes.

However, `public.users.role` remains as a legacy compatibility role, and the client retains a fallback to legacy role-based access when the snapshot RPC is unavailable. The new access model therefore must be validated end-to-end before any multi-profile or merchant onboarding is enabled.

## Current implementation observed

### Account identity and access snapshot

- `AuthContext` retains legacy `UserRole = admin | talent | customer` for compatibility.
- It also defines server-derived `AccountAccessSnapshot` capabilities for Customer, Talent, Professional Provider, and Merchant memberships.
- The client requests `get_my_account_access_snapshot` and normalizes the returned capabilities.
- The compatibility path can fall back to legacy role-based navigation if the RPC is not available. This must fail closed for new privileges; it must not infer Professional or Merchant access from user-editable metadata.
- Admin access remains a separate server-confirmed permission object.
- A user can have multiple merchant memberships; each membership is scoped to a business and role.

### Professional Services

- The branch includes `professional_provider_profiles` and an application flow that upserts the authenticated user's own professional profile.
- Professional Provider identity is designed to be independent from Talent, allowing a Professional-only provider path.
- The branch includes migrations for independent profile creation, Professional-only applications, independent review/publication, profile completeness, document storage, and Super Admin review.
- This is branch-only until migration history is reconciled and the schema/RLS/RPC/storage behavior is validated in Staging.
- Professional Services checkout and payment are not enabled by this foundation; do not imply it shares Social Experience booking/payment automatically.

### Merchant Partner

- Routes are registered for `/merchant-center`, `/merchant-partner`, and `/admin/merchant-partners`.
- Merchant Center manages business onboarding, profile, locations, memberships, offers, and review history.
- Merchant Partner is a separate business directory, not a Talent type or Professional Provider category.
- Public visibility is intended to include only approved businesses, active locations, and approved/current offers.
- Initial customer transactions are direct with the merchant. No YUKU merchant checkout, escrow, commission, payout, or settlement is included.
- Merchant UI and migrations remain staged and must not be announced as generally available until Staging authorization tests pass.

### Navigation

- The branch includes five mobile destinations: Beranda, Jelajah, Community, Pesanan, and Profil.
- Jelajah separates Social Experience, Professional Services, and Merchant Partner.
- Merchant Center is a distinct workspace from Talent Center.
- Continue checking route guards, account switching, pending application states, revoked membership states, and deep-link access. Hiding a menu item is not an authorization boundary.

## Target account model

Keep one authenticated human identity and separate server-governed capabilities:
- **Customer:** default consumer capability.
- **Talent:** Social Experience provider profile.
- **Professional Provider:** independent profile for professional services.
- **Merchant membership:** access to a specific business as owner, manager, or staff.
- **Admin:** privileged permissions provisioned and checked separately.

The same person may hold multiple capabilities without merging their profile data or permissions.

## Non-negotiable security boundaries

- Client state, route visibility, and user metadata must never grant privileges.
- Professional Provider ownership and private document access must be checked server-side.
- Merchant access must be scoped to the exact business and active membership.
- Public discovery must expose only approved public fields.
- Professional Provider status must not imply Talent booking, earnings, escrow, or payout permissions.
- Merchant membership must not grant access to Talent bookings, escrow, or financial records.
- Suspension/revocation must invalidate the relevant capability without corrupting unrelated memberships.
- Existing Talent booking, payment, cancellation, refund, earnings, and Admin permissions must remain unchanged unless separately reviewed and tested.

## Release gates

Do not enable Professional-only or Merchant onboarding until:
1. Migration timestamps are unique and the target migration history is reconciled.
2. The access snapshot RPC and legacy fallback are tested for missing, malformed, stale, and revoked capability data.
3. RLS/RPC tests cover Customer-only, Talent-only, Professional-only, combined-role, Merchant owner, Manager, Staff, Admin, and Super Admin.
4. Cross-user and cross-business negative tests prove no data leakage.
5. Private professional document upload/read/revocation and public listing visibility are verified.
6. Workspace switching and direct route access are tested on mobile and desktop.
7. Existing Talent booking/payment/refund/earnings regression tests pass.
8. Staging migrations and CI produce recorded successful evidence.

## Immediate conclusion

The multi-profile and Merchant foundations are now represented in this branch, so the older recommendation to start designing them from scratch is obsolete. The remaining work is validation and safe integration—not treating the branch implementation as already live.