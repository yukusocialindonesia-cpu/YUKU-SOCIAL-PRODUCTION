# YUKU Payment, Refund & Proof Audit

Audit date: 26 November 2026  
Repository branch: `feat/professional-services-categories`  
Supabase project: `yukuproduction` (`sbqvltqzzcsqzijgumld`)  
Scope: Customer payment selection and proof submission, Finance/Admin verification, payment settlement, cancellation/refund processing, Storage, notifications, and Production deployment parity.

## Executive summary

Manual QRIS is the only payment provider represented in the current Production payment rows. The five observed payment rows are all `manual_qris` and `released_to_talent`; five QRIS proof submissions are approved. No bank-transfer submissions or refund rows existed in the read-only snapshot. This is a small snapshot, not a proof of operational readiness.

The current database reconciliation checks returned zero for payment/booking amount mismatch, duplicate provider charge references, duplicate provider refund references, refund/booking/payment mismatch, processed refunds missing audit fields, over-refunded payment groups, proof-owner mismatch, and missing/unreferenced QRIS or bank-transfer proof objects.

**Do not treat Xendit as ready for new checkout.** Production has `payment_checkout = true`, but the active Edge Function inventory contains no `create-checkout` or `xendit-webhook` function, and the Production route-claim RPC rejects a new Xendit route. The frontend environment flag `VITE_PAYMENT_CHECKOUT_ENABLED` was not accessible in this audit. Keep Xendit disabled at the hosting/UI level until the two functions, secrets, callback URL, and sandbox-to-Staging test suite are deployed and verified. Do not change the Production flag as part of this audit.

## Production checks (read-only)

### Current aggregate snapshot

- `payments`: 5 rows; all provider `manual_qris`; all status `released_to_talent`.
- `qris_payment_submissions`: 5 rows; all `approved`.
- `bank_transfer_submissions`: 0 rows.
- `refunds`: 0 rows.
- `customer_cancellation_cases`: 1 row.
- Booking statuses observed: 5 `completed`, 1 `expired`, and 1 `cancelled_by_customer`.
- Proof Storage: 5 QRIS proof objects; 0 bank-transfer proof objects. All referenced submission paths matched existing objects; no orphaned proof objects were found.
- Buckets `qris-payment-proofs` and `bank-transfer-payment-proofs` are private, have a 5 MiB object limit, and allow JPEG/PNG/WebP/PDF MIME types. `qris-payment-display` is a separate public display bucket.

No customer names, account identifiers, proof contents, file names, transaction references, or secret values were selected.

### Access control observed

- Payment rows: RLS SELECT for booking participants or Finance permission.
- Refund rows: RLS SELECT for the Customer or Finance permission.
- QRIS/bank proof submission rows: RLS SELECT for the submitting Customer or Finance permission.
- Proof buckets are private; object SELECT is limited to the owner whose submission references the object or Finance.
- `settle_booking_payment` is not executable by `anon` or `authenticated`; service-role/server execution only.
- Customer proof submission RPCs are executable by authenticated users but derive the Customer from `auth.uid()`, lock the booking, check ownership/status/expiry/amount/route, and verify the uploaded object exists.
- The Finance-facing QRIS wrapper and bank transfer review RPC require Finance permission. The underlying QRIS review RPC is revoked from authenticated users.
- Finance refund processing checks Finance permission, locks refund/payment/booking, requires an external provider/bank reference, prevents reuse of refund references, and caps cumulative processed refunds at the payment amount.

### Reconciliation result

The read-only aggregate checks returned zero anomalies for:
- payment amount differing from the linked booking gross amount;
- duplicate provider charge references;
- duplicate provider refund references;
- refund linked to a different booking than its payment;
- processed refund missing processed timestamp, Finance actor, or provider reference;
- cumulative processed refunds greater than the original payment;
- proof submission Customer differing from the booking Customer;
- QRIS/bank proof object missing or not referenced by a submission.

These checks were aggregate-only and did not validate provider-side bank statements or actual money movement.

## Findings

### P0 — Xendit deployment and configuration are inconsistent

Production snapshot:
- `system_feature_flags.payment_checkout` is `true`.
- Active Edge Functions returned by Supabase: `account-management`, `admin-management`, and `yuku-push`. Neither `create-checkout` nor `xendit-webhook` is deployed in that inventory.
- Production `claim_booking_payment_route()` rejects a new Xendit route when a booking has no previously locked route.
- The frontend Xendit panel invokes `create-checkout` for an existing booking already locked to Xendit. The frontend hosting flag was not inspected.

Impact: any existing Xendit-routed booking cannot rely on a working checkout function in the current deployed function inventory; new Xendit route claims are blocked by the database. This is a release/configuration blocker if Xendit is intended to be offered. Manual QRIS currently has Production records and is the only provider seen in the payment ledger.

Required: keep Xendit hidden/disabled until deployment, secrets, callback configuration, route policy, and full sandbox/Staging tests are complete. Verify both the server feature flag and frontend build flag together. Do not enable Xendit by toggling only one flag.

### P1 — Internal cancellation-case notes are readable by the Customer row owner

Production `customer_cancellation_cases` grants authenticated SELECT on every column. Its row policy allows the Customer who owns the case or Finance. A direct column-privilege check confirms authenticated users can SELECT `admin_notes` (and other Admin decision fields) on their own case.

The Admin UI also reads the table using `select('*')`. Because row-level security does not hide individual columns, `admin_notes` is exposed to the Customer who owns the case even though it is named as an Admin note.

Required: revoke table-wide authenticated SELECT, grant only Customer-safe columns, and give Finance/Admin a narrowly scoped RPC for internal case notes and decision metadata. Update the Admin UI to use that RPC. Test Customer, Finance, Support, and Super Admin sessions. Do not assume RLS alone hides the note.

### P1 — Retained-amount refund path does not trigger the Customer refund notification

Production `notify_refund_processed()` is attached to `AFTER UPDATE OF status` on `refunds`. The Finance RPC `admin_resolve_customer_cancellation_case(..., 'refund_customer', ...)` inserts the retained-amount refund row directly with status `processed`; it does not update an existing row from another status.

Therefore that retained-amount refund path bypasses the existing `notify_refund_processed` trigger. The money/refund ledger can be updated while the Customer receives no matching refund notification.

Required: implement a notification path for processed refunds created by INSERT as well as UPDATE, with idempotent event handling. Test both automatic cancellation refund and retained-amount case resolution. Ensure the message is sent only after Finance records that the real external refund has already been executed.

### P2 — QRIS proof cleanup can leave private orphan objects on failed submission

Production `qris-payment-proofs` Storage policies include SELECT and INSERT but no DELETE policy. The QRIS Customer UI attempts to remove an uploaded object when its subsequent submission RPC fails. That cleanup is therefore not authorized by the current policy and may leave an unreferenced private object.

No orphaned QRIS or bank-transfer proof object was found in the current snapshot; this is a code-path risk, not an observed data incident.

Required: add a narrowly scoped DELETE policy for the owner of a pending-payment booking, only when the exact object is not referenced by a pending/approved submission; alternatively implement server-side cleanup. Do not grant broad bucket deletion. Add tests for RPC failure after upload, rejected-proof replacement, and attempts to delete another Customer's proof.

### P2 — Verify file contents, not only client MIME metadata

Both private proof buckets restrict declared MIME types and file size. Browser-side validation and Storage `contentType` metadata are not proof that file bytes actually match the claimed image/PDF format.

Required: validate magic bytes server-side or re-encode images and safely inspect PDFs before long-term retention/review. Continue using private buckets and short-lived signed URLs.

## Branch-only source fixes made during this audit

1. Commit `c9ec2d5c4b275ff65bd29054bdcc5431a46c93fa`: QRIS panel now calls `claim_booking_payment_route(..., 'manual_qris')` before uploading the proof. This keeps the UI ordering aligned with branch migration `20261126230000_harden_qris_proof_upload_and_trigger_acl.sql`, whose Storage INSERT policy requires the booking to be locked to QRIS. The existing submission RPC rechecks the route server-side.
2. Commit `eccf3d6934cc4eca060ef9a7be216d940bcb0286`: Xendit webhook now returns HTTP 500 when the database booking lookup errors, allowing the provider to retry. A confirmed non-existent booking still returns an ignored response. Previously, a transient query error could be mistaken for a missing booking and acknowledged with HTTP 200.

These are branch source changes only. They are not deployed to Production and have not yet completed the CI/Staging suite.

## Refund and payout boundaries

- Talent cancellation creates a full refund request; Finance must perform the actual external refund and enter a provider/bank reference before marking it processed.
- Customer cancellation policy snapshots automatic refund and retained amounts. Retained funds are not YUKU revenue or Talent earnings until Finance makes and records a decision.
- Partial refund processing is cumulative and cannot exceed the original payment. The payment is only marked `refunded` after the cumulative processed refund reaches the original amount.
- The existing professional-service financial audit remains a release blocker for professional-service checkout/payout: partial allocations across Talent/platform/referral/reserved/paid balances and project acceptance are not complete.
- No payout or refund money movement was performed during this audit.

## Required regression tests before release

1. QRIS and bank transfer: Customer ownership, exact amount, active booking, expiry, payment-route lock, one pending proof per booking, proof object existence, duplicate reference rejection, simultaneous Finance review, repeated review, and rejected-proof resubmission.
2. QRIS Storage: wrong booking folder, wrong owner, route mismatch, duplicate upload, failed RPC cleanup, cross-user read/delete denial, private signed URL expiry.
3. Refund: Finance-only execution, wrong booking/payment link, duplicate provider refund reference, cumulative partial refunds, full refund state transition, duplicate RPC retry, and no over-refund under concurrent Finance actions.
4. Customer cancellation: unpaid cancellation, >24h full refund, 6–24h partial refund, under-6h retained funds, retained amount resolution, compensation to Talent, extended hold, and payout/dispute race.
5. Notifications: automatic refund UPDATE, retained refund INSERT, QRIS rejection reason, no internal case notes in Customer notification/push, and correct recipient.
6. Xendit: deployed function versions, secrets present without exposing values, callback token validation, invoice status/ID/external ID/currency/amount validation, duplicate callback, lookup transient failure => 5xx retry, expired invoice, and route-lock race.
7. Reconciliation: daily sums of payments/refunds/escrow releases/Talent earnings/platform commission/referral earnings/payout allocations match provider settlement reports and ledger snapshots.

## Validation boundary

Production database checks were read-only. No payment was initiated, no refund or payout was executed, no proof was uploaded or downloaded, no account-specific rows or secret values were read, no Storage object was changed, no feature flag or policy was changed, no Edge Function was deployed, and no Production migration was applied.

Branch-only source fixes are not yet validated by workflow runs or Staging runtime tests. PR #263 remains draft and unmerged.