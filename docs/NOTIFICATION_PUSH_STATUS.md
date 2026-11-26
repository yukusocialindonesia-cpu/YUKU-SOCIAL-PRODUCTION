# YUKU notifications — implementation status

All implementation work is isolated to `feature/notification-push`.

## Implemented in this branch
- In-app notification sound preference remains stored locally in the browser.
- The service worker is registered on secure origins (HTTPS).
- The notification panel has an enable/disable control for signed-in users.
- Browser permission is requested only after the user presses the button.
- Browser subscriptions are sent using the signed-in Supabase session.
- The Edge Function verifies the user token before registering or removing a device.
- The server sender accepts webhook events only with a private secret.
- CORS is restricted to the exact configured `APP_ORIGIN`; there is no wildcard fallback.
- The server supports current Supabase secret-key environment variables and legacy names.
- Push subscription data is designed for a private RLS-enabled table, with browser-role access revoked.
- The service worker accepts only same-origin relative paths when a notification is clicked.
- A Deno type-check step has been added to GitHub Actions for the Edge Function.

## Read-only production inspection
- `public.notifications` exists and has the expected fields: `id`, `user_id`, `title`, `message`, `type`, `is_read`, `metadata`, and `created_at`.
- RLS is enabled on `public.notifications`.
- `public.push_subscriptions` does not exist yet.
- No Edge Functions are currently listed in the production project.

## Still required before end-to-end delivery
1. Create a formal migration with `supabase migration new <name>`, then put the reviewed SQL into the generated file. The current workspace does not have the Supabase CLI, so no migration filename has been invented.
2. Review and separately approve applying that migration to production.
3. Generate VAPID keys and set the private values as Edge Function secrets; set only the public VAPID key in the frontend build environment.
4. Confirm the canonical production website origin and set it as `APP_ORIGIN`.
5. Deploy the Edge Function with JWT verification disabled only after its internal user-token and webhook-secret checks have been reviewed.
6. Configure the Database Webhook for INSERT on `public.notifications`.
7. Run the Deno check and full website checks on the latest branch commit, then test on Android Chrome with YUKU closed.

## Verification and safety
- Latest GitHub Actions run passed: website TypeScript check, Vite production build, and Deno type-check for the Web Push Edge Function.
- Dependency installation reported zero npm vulnerabilities in that run.
- No production SQL has been run.
- No production migration has been applied.
- No Edge Function has been deployed.
- No secrets have been set.
- No Database Webhook has been configured.
- `docs/sql/push_subscriptions_draft.sql` remains a draft, not a migration.


## Production status correction — 26 November 2026

The read-only Production snapshot on 26 November 2026 supersedes the earlier "no table / no Edge Functions" snapshot above:

- `public.push_subscriptions` exists and contained 3 rows in an aggregate-only check. No endpoints or account identifiers were read.
- `yuku-push` Edge Function is ACTIVE, version 4, `verify_jwt=false`.
- The `public.notifications` table has RLS enabled, is in `supabase_realtime`, and has 3 policies.
- The `yuku_push_after_notification_insert` database trigger is enabled. The Vault secret name `yuku_push_webhook_secret` exists; the value was not accessed.
- Production `yuku-push` deployment and DB webhook path exist, but VAPID secret configuration, `APP_ORIGIN`, delivery success, and Android closed-app delivery have not been verified end-to-end.
- Production `notify_on_booking_message_insert()` currently includes a 120-character chat preview in the notification body. This can flow into lock-screen push text. The branch migration 43 uses generic text and is the safer behavior; keep chat content out of push payloads.
- Do not interpret the presence of 3 subscription rows as proof of active/valid subscriptions or successful delivery.

No Production changes or push test sends were performed during this read-only check.
