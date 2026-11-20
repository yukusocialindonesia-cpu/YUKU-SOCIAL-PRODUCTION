# YUKU Web Push — branch implementation

This branch contains the browser permission/subscription flow and the server-side push sender. It does not change the live database or deploy the Edge Function.

## Browser setup (1)
- The browser registers `/sw.js`.
- A signed-in user chooses **Aktifkan notifikasi HP** in the notification panel.
- The browser asks for permission and creates a PushSubscription.
- The app sends the subscription to the `yuku-push` Edge Function using the user's Supabase session.
- The Edge Function verifies the session and stores the endpoint and encryption keys in `push_subscriptions`.

## Server sender (3)
The Edge Function supports:
- `subscribe`: authenticated user only.
- `unsubscribe`: authenticated owner only.
- `send`: protected by the separate `x-yuku-push-secret` header and intended for the database webhook.

The function never returns VAPID private keys or the Supabase service-role key to the browser.

## Required setup before delivery works
1. Generate a VAPID key pair. Keep the private key secret. Set Edge Function secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and `YUKU_PUSH_WEBHOOK_SECRET`.
2. Set the public VAPID key as the frontend build variable `VITE_WEB_PUSH_PUBLIC_KEY`.
3. Generate a proper Supabase migration with the Supabase CLI using the reviewed SQL draft in `docs/sql/push_subscriptions_draft.sql`. The draft enables RLS, grants no table access to anon/authenticated, and grants access only to service_role.
4. Deploy `supabase/functions/yuku-push/index.ts` with JWT verification disabled because the function validates user JWTs itself and validates the private webhook secret for the send action.
5. Configure a Database Webhook on `public.notifications`, event INSERT, POST to the deployed function URL, with JSON body containing the inserted row and header `x-yuku-push-secret` set to the same secret.
6. Configure the exact production site origin in `APP_ORIGIN` before production use.

## Test plan
- Android Chrome: grant permission, subscribe, refresh, unsubscribe, subscribe again.
- Confirm only the signed-in user's device endpoint can be changed.
- Insert a test notification for a test account and confirm it arrives with YUKU closed.
- Confirm invalid webhook secrets are rejected and expired endpoints (404/410) are removed.

## Safety status
- No production SQL has been run.
- No Edge Function has been deployed.
- No secrets have been set.
- Database webhook is not configured.
- The SQL file is a review draft, not a migration.
