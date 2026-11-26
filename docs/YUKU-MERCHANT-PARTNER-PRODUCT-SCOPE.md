# YUKU Merchant Partner — Product Scope

Status: implementation draft in PR #287. UI and review workflow are coded but not live until the migrations pass staging validation. No Production changes.

## Product definition

Merchant Partner is a business-discovery ecosystem inside YUKU. It is not a Talent type, a Professional Service category, or a Talent booking channel.

A merchant is a business account with its own business identity, one or more locations, public business information, and (in a later phase) merchant-managed offers. A person may use one YUKU login for multiple roles, but the merchant business profile remains a separate entity from that person's Talent or Professional Provider profile.

## Keep the three product lanes separate

- **Social Experience:** a customer books a person for a shared activity. Existing Talent booking, payment, escrow, cancellation, and fee rules apply.
- **Professional Services:** a customer requests a defined professional service from a provider. Its own provider identity and service details remain separate from Talent.
- **Merchant Partner:** a customer discovers a business, venue, branch, or merchant offer. Merchant purchases are paid directly to the merchant under the merchant's own POS/payment process.

Do not place merchant businesses in Talent search results, Talent categories, provider verification, Talent availability, or Talent booking checkout.

## Merchant customer journey (initial release)

1. Customer opens Jelajah > Merchant Partner.
2. Customer browses approved business profiles and approved locations.
3. Customer opens a business detail page to view description, address/location, opening hours, contact/action links, and available public offers.
4. Customer contacts or visits the merchant and pays the merchant directly.
5. YUKU does not collect the merchant purchase amount, hold it in Talent escrow, calculate a Talent marketplace commission, or settle funds to the merchant in this initial release.

The initial release is a discovery/referral directory, not an in-app merchant checkout or booking marketplace.

## Merchant account and management

- Merchant registration is a separate business onboarding flow.
- A merchant business profile is distinct from the owner/operator's personal profile and provider profiles.
- Support multiple branches under one business. Owner and Manager memberships can manage permitted branch operations; Staff remains read-only in the current foundation.
- Only approved businesses with active locations may appear publicly. Draft, pending-review, needs-revision, rejected and suspended businesses remain hidden.
- Collect only the minimum business and ownership information needed for verification. Keep identity evidence, contracts, private contact data, and internal review notes private.
- Super Admin review UI supports pending review, needs revision, approved, rejected and suspension of approved businesses. Each owner submission and Admin decision is recorded in an append-only review history. Reinstatement and appeal workflows remain future work.

## Offers and promotions

- Existing `promotions` remains the banner/poster CMS; it must not be represented as a merchant catalogue, discount engine, or voucher ledger.
- Merchant offers are separate structured records linked to an approved business and reviewed independently before publication.
- Offers capture benefit/description, eligibility, validity window, optional stated quota, exclusions/terms, redemption instructions, and funding source (merchant-funded in this release).
- In the initial directory phase, offers are informational and redeemed directly with the merchant. Stated quota is informational only and is not decremented or reserved by YUKU.
- Voucher issuance, QR validation, single-use redemption, quota enforcement, and booking-linked benefits remain a later optional phase requiring explicit product and security approval.

## Commercial and payment boundaries

- Merchant goods/services are paid directly to the merchant.
- No YUKU merchant checkout, merchant escrow, merchant payout, settlement ledger, or merchant transaction fee in the initial release.
- Do not apply the Talent marketplace commission to merchant purchases.
- Any future paid placement, lead fee, commission, or YUKU-funded subsidy requires a separate commercial agreement, transparent customer terms, accounting treatment, and explicit approval.
- Merchant activity must not mutate Talent booking amounts, platform fees, Talent earnings, refunds, payment routes, or escrow state.

## Navigation and information architecture

- Jelajah contains distinct destinations/tabs for Social Experience, Professional Services, and Merchant Partner.
- Merchant Partner has its own business discovery list and business detail page.
- Merchant Center is a separate management area for business profile, branches, and offers; it is not Talent Center.
- Do not show a live Merchant Center or active merchant catalogue until the required routes, authorization, schema, and operational workflows exist.

## Release gates

Before public merchant listings:
- Define business verification requirements, owner consent, terms, and moderation policy.
- Implement separate merchant/business and location data models.
- Implement strict row-level access so a merchant can manage only its own business and locations.
- Ensure public queries expose only approved public fields.
- Add Admin review, pause/suspension, audit history, and reporting/complaint handling.
- Test anonymous, customer, merchant owner, merchant staff, Admin, and Super Admin access boundaries.
- Confirm mobile-first discovery and accurate empty states when no approved merchants exist.

Before any in-app voucher redemption:
- Define who funds each benefit and exact eligibility/expiry/reversal rules.
- Implement server-authoritative, atomic, idempotent redemption with non-guessable tokens.
- Add replay/rate-limit protections and append-only redemption audit events.
- Test cancellations, offer changes, expired offers, concurrent scans, and revoked merchants.
- Keep voucher accounting separate from Talent booking/payment/earnings ledgers.

## Current implementation status

At the time of this document, the homepage contains a staged Merchant Partner introduction only. There is no active Merchant Center, merchant onboarding, merchant business catalogue, structured offer engine, voucher issuance/redemption, or merchant checkout. Existing banner promotions do not satisfy those requirements.

No database migration, production configuration, payment flow, or production data is changed by this product-scope document.


## Current PR #287 implementation

- Merchant Center route: `/merchant-center` for business registration, profile draft/revision edits, branch creation, opening hours, review history, and review submission.
- Public directory route: `/merchant-partner`; it queries only approved businesses, active branches, and currently valid approved offers.
- Super Admin review route: `/admin/merchant-partners`; it now includes separate business and offer review queues. Server RPCs require the existing Super Admin check (`public.is_admin()`).
- Owner can invite existing active YUKU accounts as Manager/Staff; invitees accept in Merchant Center. Notifications cover invitations, acceptance, revocation, and business/offer review decisions.
- Adding a new branch to an approved business by its Owner moves the business to needs_revision and hides it until re-review, preventing unreviewed branch publication.
- The Merchant Center query is scoped through the signed-in user's own memberships; it does not list all public businesses as the user's own workspace.
- Merchant purchases and offer redemption remain direct-to-merchant. No merchant checkout, voucher wallet, quota enforcement, commission, escrow, payout or settlement has been added.
- Migrations `20261127002000` through `20261127005000` are draft-only and unexecuted; they require SQL review, staging validation, RLS/JWT tests, and operational sign-off.
