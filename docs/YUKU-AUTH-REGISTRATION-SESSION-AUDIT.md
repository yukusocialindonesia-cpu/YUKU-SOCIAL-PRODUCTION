# YUKU Authentication, Registration & Session Audit

Date: 2026-11-26
Scope: branch frontend review plus read-only Production Auth-related function, trigger, grant and RLS catalog inspection. No Auth user records or session rows were read.

## Executive summary

The core role boundary is correctly enforced in the database:
- New Auth users are always created as `customer`; the client-supplied `user_role` metadata is ignored by `handle_new_user()`.
- Becoming a Talent requires an authenticated `become_talent()` call. It locks the caller's `public.users` row and only allows `customer -> talent` (or idempotent Talent retry). Admin role cannot be self-assigned through this path.
- Direct authenticated UPDATE grants on `public.users` are limited to `full_name`, `phone_number`, and `updated_at`. A trigger blocks direct role, identity, and verification-status tampering.
- Suspended/banned accounts are blocked at database access boundaries by the active-account guard and restrictive RLS policies; Admin permission checks also require an active Admin and active user account.

## Fixed in the feature branch

### P1/P2 privacy — Talent registration draft could appear to another browser account

Before the fix, `LoginPage` routed any successful login to `/daftar-talent` whenever a generic localStorage draft existed. `BecomeTalentPage` restored that draft without checking which account created it. On a shared device this could expose the previous registrant's name, email, phone, date of birth, city, bio, referral code and other form values to a different signed-in user.

Branch fix:
- Login only treats a saved draft as resumable when its normalized email matches the authenticated account email.
- Talent form restores the draft only after an authenticated account email matches the draft email.
- A mismatched or malformed draft is discarded instead of being rendered.
- Password and KTP number remain excluded from saved draft content.

Files:
- `src/pages/LoginPage.tsx`
- `src/pages/BecomeTalentPage.tsx`

The fix was source-verified on the branch; no browser/shared-device test has run yet.

### P2 session scope — transient profile lookup failure

Previously, if the login-time read of `public.users` failed due to a transient network/database error, LoginPage called `signOut({ scope: 'global' })`, potentially revoking sessions on the user's other devices even though account status had not been proven invalid.

Branch fix: that error path now uses local sign-out only. A positively detected suspended/banned account continues to use global sign-out in AuthContext and the database remains authoritative.

File: `src/pages/LoginPage.tsx`.

## Production checks

### Signup and role assignment
- `public.handle_new_user()` inserts `public.users.role='customer'` and `account_status='pending_verification'`, regardless of editable `raw_user_meta_data.user_role`.
- The Auth trigger creates a customer profile; it does not trust the browser to assign Talent or Admin.
- `public.become_talent()` requires `auth.uid()`, selects the caller's role `FOR UPDATE`, allows Customer-to-Talent only, and rejects other roles.
- The public.users BEFORE UPDATE trigger rejects role changes unless the caller is Super Admin or trusted service backend.
- The Talent registration client calls `become_talent()` before creating Talent profile/service records. If a later step fails, the account can retry because the RPC is idempotent for an existing Talent role. Partial onboarding can leave a Talent role without a complete profile until retry; it does not grant public Talent visibility because approval and active-service requirements remain.

### Account state and session enforcement
- AuthContext loads role/account status from `public.users`, not from user-editable role metadata.
- Admin access is loaded separately from `get_admin_access()`; failed access lookup yields no Admin UI permission.
- Suspended/banned or missing user rows trigger global sign-out in AuthContext.
- The database active-account helper accepts only `active` and `pending_verification`; restrictive RLS and write triggers use this boundary.
- Login reads the current user's role/status before navigation.

### Password reset and auth listeners
- `ResetPasswordPage` checks for a recovery event/session before enabling password update and listens for PASSWORD_RECOVERY / SIGNED_OUT.
- `App` has an additional listener for password-recovery routing; it does not grant roles or permissions.
- The generic app session owner remains AuthContext. Password recovery is a dedicated flow.
- The login UI's “Ingat saya” checkbox is currently decorative/inert; Supabase client session persistence is always enabled. This is a P3 UX mismatch, not an authentication bypass.

### User metadata and authorization
- Search of the repository found no authorization use of `user_metadata.user_role` / `user_metadata?.user_role`.
- Full name and phone metadata are used for form prefill only; database role and Admin access remain database-derived.

## Items not verifiable in this pass

The available project connector does not expose Auth dashboard configuration. Therefore this audit cannot confirm:
- password strength/compromised-password policy,
- email confirmation and SMTP enforcement settings,
- sign-in / OTP rate limits and CAPTCHA enforcement,
- MFA enrollment and whether Admin routes require AAL2,
- access-token lifetime, refresh-token rotation and session inactivity policy,
- allowed redirect URL allowlist and OAuth provider settings.

These require an Auth configuration review in the Supabase Dashboard. Do not infer that a control is enabled or disabled from frontend code alone.

## Remaining tests

1. Shared-device test: account A creates an unconfirmed Talent draft; account B logs in; no A data is rendered and draft is discarded.
2. Matching-account test: A confirms email/logs in; A draft restores without password/KTP values.
3. Role escalation test: alter `user_role` metadata to `admin` or `talent`; DB row must remain Customer until the authenticated Talent RPC is called; direct role UPDATE must fail.
4. Account state test: pending-verification can complete onboarding; suspended/banned cannot write or access protected tables and is signed out.
5. Session test: transient users-row read failure signs out only current browser; confirmed suspended status revokes all sessions.
6. Password recovery test: invalid/expired token cannot update password; valid recovery session can update it.
7. Run frontend build, type checks and GitHub Actions after code changes.

## Change boundary

No Production Auth configuration, user row, session, password, provider, trigger, function, grant, RLS policy or migration was modified. No email, OTP, password reset or session revocation was sent. All database inspection was read-only.
