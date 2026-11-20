# YUKU Web Push — branch implementation

This branch contains the browser permission/subscription flow and the server-side push sender. It does not change the live database or deploy the Edge Function.

## Browser setup
- The service worker is registered at `/sw.js` on HTTPS.
- A signed-in user opens the notification bell and chooses **Aktifkan notifikasi HP**.
- The browser asks for permission and creates a PushSubscription.
- The app sends that subscription to `yuku-push` using the user's Supabase session.
- The Edge Function verifies the session and stores the endpoint and encryption keys in `push_subscriptions`.
- Only signed-in users see the push control.

## Server sender
The Edge Function supports:
- `subscribe`: verifies the user's Supabase access token and registers their device.
- `unsubscribe`: verifies the user's token and deletes only that user's endpoint.
- `send`: accepts database webhook requests only when the private `x-yuku-push-secret` matches.

The service-role key and VAPID private key remain on the server. The browser receives only the public VAPID key.

## Required configuration before end-to-end delivery
1. Generate a VAPID key pair. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` as Edge Function secrets. The subject should be a valid `mailto:` or HTTPS contact URI.
2. Set `YUKU_PUSH_WEBHOOK_SECRET` to a long random secret in Edge Function secrets. Use the exact same value in the Database Webhook header; do not put it in Git or the browser.
3. Set the public key only as frontend build variable `VITE_WEB_PUSH_PUBLIC_KEY`.
4. Set `APP_ORIGIN` to the exact website origin, `https://yuku-friends.yukusocial-indonesia.workers.dev` (confirmed) (no path and no trailing slash). The function rejects browser requests from other origins; there is no wildcard CORS fallback.
5. Generate a formal migration using the Supabase CLI based on `docs/sql/push_subscriptions_draft.sql`. The draft enables RLS, revokes browser-role access, and grants table access only to `service_role`.
6. Deploy `supabase/functions/yuku-push/index.ts` with JWT verification disabled because the function validates user JWTs itself and validates the separate private webhook secret for the send action.
7. Configure a Database Webhook on `public.notifications`, event INSERT, POST to the deployed function URL, with a JSON body containing the inserted row and header `x-yuku-push-secret` set to the same private secret.
8. Supabase's current Edge Function runtime provides `SUPABASE_SECRET_KEYS` and `SUPABASE_PUBLISHABLE_KEYS`; the function supports these and the legacy service-role/anon environment variables.

## Test plan
- Android Chrome: grant permission, subscribe, refresh, unsubscribe, subscribe again.
- Confirm only the signed-in user's device endpoint can be changed.
- Insert a test notification for a test account and confirm it arrives with YUKU closed.
- Confirm requests from an unapproved Origin and invalid webhook secrets are rejected.
- Confirm expired endpoints (404/410) are removed.

## Safety status
- No production SQL has been run.
- No Edge Function has been deployed.
- No secrets have been set.
- Database webhook is not configured.
- The SQL file is a review draft, not a migration.
