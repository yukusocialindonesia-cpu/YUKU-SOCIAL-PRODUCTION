# YUKU Merchant Partner & Voucher Audit

Date: 2026-11-26
Branch: `feat/professional-services-categories`
Status: design/audit only — no merchant schema or production changes.

## 1. Existing implementation

- The existing `public.promotions` table is a poster/banner content table: `title`, `image_url`, `link_url`, `storage_path`, `sort_order`, `is_active`, creator and timestamps.
- `PromoCarousel` displays active posters. Internal links beginning with `/` are sent to app navigation; HTTP(S) links open an external tab.
- Admin promotion management is a Super Admin-only banner manager. It uploads a poster to the public `promotions` Storage bucket and writes a row to `promotions`.
- Migration 15 grants public SELECT for active posters and gates writes through `public.is_admin()`. On the current branch, the generic `is_admin()` helper is Super Admin-only; this is consistent with the Super Admin-only UI.
- There is no merchant/partner business profile, merchant location, offer/discount rules, voucher issuance, redemption, quota, or merchant settlement model in the inspected schema/types and migration set. A poster link is not a voucher and does not prove that a booking qualifies for a deal.

## 2. Current risks / limitations

1. **Poster is not a commercial offer.** Title/image/link do not encode minimum spend, eligible service/category, valid date/time, quota, per-customer limit, area, exclusions or redemption status. Do not advertise a banner as an enforceable benefit.
2. **No booking-to-deal eligibility link.** The current booking RPC and payment record do not reserve or issue a merchant benefit. A Talent booking cannot safely unlock a deal merely because a customer viewed a banner.
3. **No redemption idempotency.** There is no unique redemption token/state machine to stop repeated scans, screenshots, replay, or two merchant staff redeeming the same benefit.
4. **No merchant verification and lifecycle.** There is no partner onboarding, business ownership verification, branch/location approval, contract acceptance, pause/suspension, or audit history.
5. **No customer privacy boundary.** Do not give merchants a Customer phone, chat, identity document, Talent booking details or exact meeting point just to validate a discount. Merchant only needs the minimum proof that the voucher is valid and unredeemed.
6. **Public poster storage is intentionally public.** Only non-sensitive campaign artwork belongs in this bucket. Never put contracts, merchant identity documents, redemption exports, or customer evidence in it.
7. **Upload validation is client-led.** The current poster form checks declared MIME, file size and dimensions in the browser, but the upload path derives extension from the original filename. The Storage bucket policy shown in migration 15 does not itself enforce size/MIME allowlists or server-side image signature validation. This should be hardened before broad merchant self-service.
8. **Creator attribution is not strongly bound by the insert policy in migration 15.** The UI sends the current user as `created_by`, but the database policy shown does not require `created_by = auth.uid()`. Current Super Admin-only writes reduce exposure, but database-side attribution should be enforced.
9. **No merchant financial settlement contract exists.** Do not route merchant food/drink payments through Talent escrow or treat the 20% Talent marketplace fee as merchant commission. Merchant purchase and YUKU service booking are separate transactions unless a later signed agreement explicitly defines otherwise.

## 3. Recommended product model

Keep existing `promotions` as the campaign/banner CMS. Add separate, normalized entities only when partner onboarding and operating rules are approved:

- `merchant_partners`: legal/business display name, verified owner, business category, status (draft, submitted, verified, active, paused, rejected), support contact held privately, agreement version/acceptance and audit fields.
- `merchant_locations`: partner ID, branch name, structured address, city/region, coordinates, service radius, opening hours, active status and location verification. Public view should expose only approved business details.
- `merchant_offers`: partner/location, title/description, offer type, discount/benefit, minimum spend or minimum YUKU booking condition, eligible YUKU service categories, geographic scope, valid-from/to, weekdays/time windows, quota, per-customer limit, exclusions, terms, status, approval and version.
- `merchant_vouchers`: opaque random voucher identifier, booking/customer binding, offer/version snapshot, expiry, state (issued, reserved, redeemed, expired, revoked), issued/redeemed timestamps and actor. Store a hash for verification where practical; never use a sequential or guessable code.
- `merchant_redemption_events`: append-only event/audit log for issue, reserve, redeem, reject, expire, revoke and reversal, with actor, location, reason and idempotency key.

Do not expose merchant owner phone, private contract or internal notes through public catalog queries. Merchant portal permissions must be branch/partner-scoped; one merchant must never read another merchant's vouchers or customer information.

## 4. Recommended customer journey (without changing booking payment)

1. Customer browses a verified merchant offer near the planned service area. The offer clearly states whether it requires a YUKU booking, a minimum booking duration/value, separate merchant minimum spend, date/time restrictions, quota and exclusions.
2. Customer books and pays for the Talent service through the existing YUKU checkout and escrow, unchanged.
3. Only after the booking reaches the agreed qualifying state (recommended: payment confirmed in escrow, not merely pending_payment), server-side eligibility checks issue one voucher for the selected offer. The offer terms and version are snapshotted.
4. Customer presents an in-app QR/short-lived code to the merchant. Merchant portal validates token, offer status, branch/location, expiry, booking qualification and unredeemed state.
5. Redemption is a single atomic/idempotent transition. A successful redemption returns only the benefit and minimal voucher status; it does not reveal Talent profile private data or Customer identity documents.
6. Customer pays the restaurant/cafe/hotel directly under the merchant's own checkout/POS. This payment is not deducted from or mixed with YUKU Talent escrow.
7. Customer may report an invalid/refused voucher through YUKU. Keep a separate merchant complaint record; do not automatically dispute/refund the Talent booking unless the Talent service itself is affected.

## 5. Business rules to settle before implementation

- Is the benefit unlocked by any paid booking in the area, or only a specific category/minimum duration/value?
- Does the voucher attach to a booking or to a Customer account? Recommended: booking-bound and one-time by default.
- Can a booking issue vouchers for multiple merchants? Recommended: yes, subject to offer quotas and customer limits, with separate vouchers.
- When is the voucher issued: after escrow payment, after Talent confirms, or after service completion? Recommended default: after escrow payment; merchant benefit is independent of completion unless the campaign explicitly requires completed service.
- Can a voucher be used before or after the Talent appointment? Each offer must define its validity window; default should be around the booking date.
- Who funds the discount? Merchant-funded by default. YUKU-funded subsidies require a separate budget ledger and approval.
- What happens if booking is cancelled/refunded after voucher issue? Revoke unused vouchers; redeemed benefits follow explicit partner terms and must not silently change Talent refund calculation.
- Can merchant offer require customer spending at the venue? State that minimum spend is paid directly to the merchant and is not part of YUKU booking checkout.
- Are there partner commissions or lead fees? Keep disabled until signed agreement, attribution, invoice and tax treatment are defined.

## 6. Security and transaction invariants

- Merchant deal must never alter `bookings.gross_amount`, `platform_fee_amount`, `talent_gross_share`, payment route, payment amount, or escrow state.
- Never accept discount amount, eligibility, merchant ID, branch ID or redemption state from client as authoritative. Validate and calculate in a server-side RPC with row locks.
- Enforce uniqueness/idempotency for voucher issuance per booking + offer and redemption per voucher.
- Recheck partner, location, offer, booking and customer status at issue and redemption time.
- Do not expose booking code, service category, Talent name, chat, meeting address or payment details to merchant unless strictly necessary and consented.
- Use short-lived, non-guessable QR tokens; rotate/revoke on suspicious activity; prevent screenshot replay by single-use server state.
- Require merchant staff authentication and branch-scoped permissions; record every redemption and reversal.
- Keep merchant voucher ledger separate from Talent payment/earning/refund/payout ledgers.
- Add rate limits and abuse detection for voucher generation, validation and redemption.

## 7. Promotion CMS hardening backlog

- Validate poster file signature server-side or in a trusted upload function; enforce image MIME allowlist and maximum file size at Storage bucket level.
- Normalize storage extension from validated file signature, not the untrusted original filename.
- Enforce `created_by = auth.uid()` in database policy/trigger and add audit log for create/update/delete/activation/reorder.
- Validate link schemes and allowlist internal routes; external links must be HTTP(S), opened safely. Reject malformed URLs and protocol-relative URLs.
- Add a clear campaign end date and stale-poster expiry if the banner CMS is used for time-limited partner campaigns.
- Preserve current Super Admin-only poster publishing unless a separately scoped marketing permission is designed.

## 8. Implementation order

1. Approve business rules and partner agreement model.
2. Implement merchant onboarding and branch verification.
3. Implement merchant offer catalogue and Admin approval.
4. Implement booking-bound voucher issuance and atomic redemption RPCs.
5. Implement minimal merchant portal and customer voucher screen.
6. Add cancellation/revocation, complaint and audit workflows.
7. Add security/RLS/Storage and idempotency tests for Customer, merchant staff, different merchants, Admin, Super Admin and anonymous users.
8. Stage the full migration sequence and run end-to-end booking/payment/voucher tests before enabling any public offer.

No merchant schema, voucher logic, booking/payment behavior, or Production data was changed by this audit.
