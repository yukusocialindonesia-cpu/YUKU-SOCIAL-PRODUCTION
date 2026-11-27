# YUKU Foundation Audit & Implementation Order

**Audit date:** 26 November 2026  
**Target:** Supabase project `yukuproduction` (`sbqvltqzzcsqzijgumld`) and repository `yukusocialindonesia-cpu/YUKU-id`.  
**Method:** Read-only schema, migration-history, SQL function, GitHub branch/PR and Supabase Security Advisor inspection.  
**Safety:** No production schema, data, policy, function, or deployment was changed during this audit.

## 1. Production facts confirmed

| Item | Current production observation |
|---|---:|
| `talent_services` rows | 10 |
| `bookings` rows | 7 |
| `professional_talent_services` rows | 0 |
| `professional_service_applications` rows | 0 |
| Merchant/business/voucher/branch tables in `public` | 0 |

The table counts are a point-in-time snapshot, not a statement about future production activity.

## 2. Current service and booking contract

### Social Experience

`public.talent_services` currently contains:
- `id` (UUID primary key);
- `talent_id`;
- `activity_category_id`;
- `custom_rate_override`;
- approval and active-state fields.

Production still enforces `UNIQUE(talent_id, activity_category_id)`. The proposed custom-title/description fields exist in the open taxonomy/custom-service branch migration, but are not present in the inspected production schema.

### Booking

`public.bookings` still requires:
- `talent_id`;
- `activity_category_id` (NOT NULL);
- `booking_mode`;
- `start_time`, `end_time`, `duration_hours`;
- hourly rate and financial snapshots.

It has no `service_id` reference. The production `create_booking` RPC accepts a talent and activity category, checks the matching approved/active service by that pair, and calculates a legacy hourly booking. The current flow therefore cannot distinguish two separate service offers in the same category.

Historical booking rows must remain valid and readable. Do not rewrite or infer historical prices from current service listings.

### Professional Services

Production has the professional category, subcategory, application and listing tables. `professional_talent_services.provider_id` still references `talent_profiles`. The independent professional-provider implementation is currently in an open feature branch; its migrations have not been applied to production. There are no current production professional applications or listings in the snapshot.

### Merchant Partner

No merchant, business, branch, offer, voucher-claim or redemption tables were found in the inspected `public` schema. Merchant Partner is a target product pillar, not a live database module yet.

## 3. Repository PR dependency chain

The relevant work is currently a stack of open, unmerged draft PRs:

1. [PR #280 — service taxonomy and custom Social Experience offers](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/280)
2. [PR #281 — independent Professional Services provider identity](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/281), based on the taxonomy branch.
3. [PR #282 — Beranda compact/premium hierarchy](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/282), based on the independent-provider branch.
4. [PR #283 — YUKU Master Product Concept](https://github.com/yukusocialindonesia-cpu/YUKU-id/pull/283), based on the Beranda branch.

These are not independent changes. Review and integration must respect their base/head dependency chain. Do not merge a later PR before its base changes are integrated or deliberately retargeted.

## 4. Confirmed implementation risks

1. **Category is not a service identity.** One provider can only have one row per category today. The booking RPC also resolves price by provider/category.
2. **Booking consumers are legacy-activity-specific.** Booking history, payment panels, chat context, admin/finance summaries, triggers, refunds, reviews and exports assume activity category and hourly duration.
3. **Financial triggers recalculate legacy hourly values.** A professional booking cannot be inserted safely by filling fake activity categories or placeholder hourly durations.
4. **Professional identity must remain independent.** A Professional-only provider must not be forced to create a Companion profile.
5. **Merchant transactions are a separate model.** Merchant voucher claims/redemptions must not be connected to talent booking, payout or commission tables.
6. **Security Advisor requires review.** Current snapshot reports 5 SECURITY DEFINER functions executable by `anon`, 61 executable by `authenticated`, 3 private-schema tables with RLS enabled but no policies, and leaked-password protection disabled. These are audit findings requiring function-by-function authorization review; they are not, by themselves, proof that each function is exploitable. Do not revoke permissions indiscriminately because some RPCs intentionally serve authenticated workflows.

## 5. Approved target architecture

### 5.1 Social Experience service identity

Keep `talent_services.id` as the stable offer ID. Do not create a second Social Experience offer table unless the existing table proves inadequate after consumer analysis.

Each public offer must be identified by `talent_services.id`, not merely `talent_id + activity_category_id`.

### 5.2 Booking compatibility

Use an additive migration strategy:
- Add a nullable service-offer reference for new activity bookings.
- Backfill existing bookings only where the provider/category match resolves unambiguously; leave unresolved legacy rows intact.
- Add immutable service title/description snapshots for newly created bookings.
- Preserve `activity_category_id`, existing hourly fields, statuses, payment records and ledger relations for legacy bookings.
- Update the server-side booking RPC to lock and validate the exact approved/active service row, calculate the rate from that row, and snapshot the service identity.
- Keep the old one-offer-per-category restriction until the exact service ID is enforced end-to-end in the booking flow and all readers.
- Only after that release is stable should multi-offer-per-category be enabled.

### 5.3 Professional Services booking

Do not activate Professional Services booking as part of the Social Experience service-ID change.

Professional Services needs a discriminated booking kind and its own listing ID, pricing unit, quantity, scope, delivery mode, provider eligibility and immutable snapshots. The existing payment, refund and payout ledger may be reused only after all booking consumers and triggers are updated and tested. Keep professional checkout disabled until the full lifecycle release gate passes.

### 5.4 Merchant Partner

Implement separately:
- merchant organization;
- branch/location;
- business verification;
- offer/promo and approval;
- voucher claim;
- unique voucher token;
- one-time redemption;
- expiry/quota/per-user limits;
- audit events and merchant reporting.

Customer pays the merchant directly in the initial product. Do not connect merchant offer purchases to talent booking/payment/earning/payout records.

## 6. Delivery sequence from this audit

### Step A — close the existing PR dependency chain safely
Review PR #280, #281, #282 and #283 in order, verify CI and migration compatibility, and ensure the base branch chain is intentional. No production migration is implied by PR review.

### Step B — Social Experience exact-offer identity
Update discovery/profile models and booking creation so a selected offer carries `talent_services.id` end-to-end. Preserve all existing category-based booking history. Add regression coverage for the seven current production bookings and all current active service rows.

### Step C — enable multiple offers per category
Only after Step B is deployed and observed successfully: replace the unique provider/category constraint with the correct per-offer rules, update provider editing and Admin review, and verify each booking resolves to exactly one offer.

### Step D — independent Professional Services provider identity
Review and test PR #281 migrations in a disposable/staging database, including RLS recursion, private document upload, admin/super-admin review and compatibility backfill. Do not apply the branch migrations to production until staging passes.

### Step E — Professional Services booking design and integration
Use a separate booking-kind contract and exact professional listing ID. Audit and update all payment, settlement, escrow, completion, cancellation, refund, dispute, chat, review, notification, admin, finance and payout consumers. Professional checkout remains disabled until all tests pass.

### Step F — Merchant Partner
Build merchant organization, branches, offers, vouchers and redemption as a separate domain, then surface it within Jelajah and supporting Beranda modules.

### Step G — Community and final integration
Connect community content to public provider/merchant pages without mixing paid catalogs, bookings or voucher financial records.

## 7. Release gates

- No direct production DDL or data migration during planning/audit.
- Use a disposable or staging Supabase database for migration and RLS tests first.
- Preserve current bookings, financial snapshots, payment records, earnings and payout history.
- Run typecheck/build and database regression tests on the exact branch head.
- Verify server-side authorization for every SECURITY DEFINER function touched.
- Never activate payment checkout merely because a new booking page or database column exists.
- Mark a module live only after end-to-end acceptance across customer, provider, admin and finance roles.

## 8. Current checkpoint

This audit is documentation-only. It establishes the production baseline and the safe order of work. The next code implementation should be the Social Experience exact-offer ID flow, not Merchant tables or Professional Services checkout.
