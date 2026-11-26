# YUKU Edge Functions, API & Payment Webhook Audit

Date: 2026-11-26
Scope: read-only Production Edge Function inventory/source inspection, branch source review, and Supabase Security/Health Advisor review. No live payment calls, webhook sends, push sends, secrets, user records or payment records were accessed.

## Executive summary

Production currently lists three ACTIVE Edge Functions:
- `account-management` — version 1, JWT verification enabled.
- `admin-management` — version 3, JWT verification enabled.
- `yuku-push` — version 4, platform JWT verification disabled; function performs its own user-token or webhook-secret authentication.

The repository also contains `create-checkout` and `xendit-webhook`, but neither appears in the active Production function inventory. The Xendit code comments explicitly say sandbox testing has not been completed. Therefore Xendit checkout/webhook must remain disabled until deployment, sandbox reconciliation and end-to-end testing are completed.

## Findings

### P1 — Production push function still includes chat message text in OS notifications

Production `yuku-push` version 4 builds push payload body directly from `notification.message`. The deployed source does not contain the generic-message guard for booking chat notifications.

The feature branch source now detects notification metadata containing both `booking_id` and `message_id` and replaces the push body with:
`Anda menerima pesan baru. Buka YUKU untuk membaca percakapan.`

This means the source fix is present in GitHub but is not live in Production. Existing notification rows are also protected by the metadata-based generic-body check once the fixed function is deployed.

Remediation:
1. Deploy the reviewed branch version of `yuku-push` to the intended environment after the normal release approval.
2. Verify with a test chat message that the OS push contains no message text, while the in-app chat still works.
3. Verify subscribe/unsubscribe/status actions still require a valid current user token and enforce account state.
4. Keep the webhook send action protected by its server-side secret.

No deployment was performed during this audit.

### P1 — Leaked password protection is disabled

Supabase Security Advisor returned `auth_leaked_password_protection` as WARN: Auth's HaveIBeenPwned compromised-password protection is disabled.

Remediation: enable leaked password protection in Supabase Auth password security settings, then test signup and password-change flows with known compromised-password fixtures in a non-production test account. Do not expose or store test credentials.

### P1 — Xendit checkout and webhook are not active in Production

Production Edge Function inventory did not list `create-checkout` or `xendit-webhook`. The repository contains both sources, but their comments state sandbox testing is not complete.

The Xendit webhook implementation validates callback token, canonical booking UUID, invoice ID presence, IDR currency, positive safe-integer amount and database gross amount before calling the idempotent settlement RPC. However, it does not independently retrieve the invoice from Xendit to verify the provider's authoritative invoice status, external ID, currency and amount. A durable provider event/invoice receipt ledger is also not yet present, as documented in the transaction audit.

Remediation before enabling:
1. Keep the feature flag and DB route guard closed until sandbox validation.
2. Add provider-side invoice retrieval/verification and a durable idempotent webhook receipt ledger.
3. Test duplicate callbacks, callback/manual QRIS races, mismatched invoice/external ID, wrong currency/amount, expired booking, transient DB failure/retry and settlement ledger uniqueness.
4. Deploy both functions only after Staging tests pass; verify callback URL and secrets without printing secret values.

### P2 — Broad CORS origin on privileged management functions

Production `account-management` and `admin-management` sources use `Access-Control-Allow-Origin: *`. Both functions still verify the bearer token, active account and Super Admin permission before privileged actions, so this is not a confirmed authorization bypass.

Remediation: restrict browser origins to the canonical YUKU app origin (and explicitly approved preview origins if required), while retaining server-side authentication and authorization. Confirm legitimate Admin UI requests continue to work after restriction.

### P2 — Push webhook secret comparison is not constant-time

Production `yuku-push` compares the supplied `x-yuku-push-secret` using ordinary string inequality. The webhook is still gated by a server-side secret, so this is a hardening finding rather than a demonstrated bypass.

Remediation: use a constant-time comparison helper with equal-length byte arrays, reject missing configuration, and consider request timestamp/replay protection if the webhook transport supports it.

## Positive controls observed

- Production `account-management` verifies caller JWT using `auth.getUser(token)`, requires active account, and checks `get_admin_access().is_super_admin` before exposing account management actions.
- Production `admin-management` verifies caller JWT, active account, Super Admin permission, validates permission values, rejects existing Customer/Talent emails for Admin invitation, and removes a newly invited Auth user if provisioning fails.
- Production `yuku-push` does not rely solely on the platform JWT setting: subscribe/unsubscribe actions validate the bearer token with Auth, while the send action requires a server-side webhook secret.
- Supabase Health Advisor returned no findings at inspection time.
- Security Advisor findings for callable SECURITY DEFINER functions and RLS-enabled private tables are recorded in the earlier SECURITY DEFINER/RPC audit; those warnings require function-by-function intent review and are not automatically vulnerabilities.

## Release checklist

- [ ] Deploy branch `yuku-push` fix and verify lock-screen privacy.
- [ ] Enable leaked-password protection and test Auth flows.
- [ ] Restrict CORS for privileged management functions.
- [ ] Harden webhook secret comparison and replay handling.
- [ ] Add provider-side Xendit invoice verification and durable event receipts.
- [ ] Complete Xendit sandbox/Staging tests before deploying checkout/webhook.
- [ ] Run frontend build, Deno checks, automated tests and GitHub Actions.

## Change boundary

No Production Edge Function was deployed or changed. No secrets were read or changed. No webhook, push notification, Xendit API request, account operation, payment, refund, payout or database mutation was performed. Findings are based on function inventory, source inspection and Supabase Advisor output only.
