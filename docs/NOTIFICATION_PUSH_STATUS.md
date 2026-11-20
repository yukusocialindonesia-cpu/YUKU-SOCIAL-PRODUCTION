# YUKU notifications — implementation status

This branch is isolated from production.

## Implemented in this branch
- In-app notification sound preference remains stored locally in the browser.
- The service worker is registered on secure origins (HTTPS).
- The notification panel now has a control to request browser permission and enable/disable push on the current device.
- Browser push subscriptions are sent to the `yuku-push` Edge Function using the signed-in Supabase session.
- The Edge Function validates the user session before saving/removing a device subscription.
- The Edge Function includes a protected sender action for database webhook events and removes expired endpoints.
- The service worker displays incoming push notifications and opens only same-origin paths when clicked.
- Public VAPID key is configured through a frontend build variable; private VAPID and service-role keys remain server-side.

## Still required before end-to-end delivery
1. Generate a real VAPID key pair and set the public key as `VITE_WEB_PUSH_PUBLIC_KEY` in the frontend build environment.
2. Generate a formal migration using the Supabase CLI based on `docs/sql/push_subscriptions_draft.sql`, review it, and apply it only after separate approval.
3. Deploy `supabase/functions/yuku-push/index.ts` with its required secrets.
4. Configure a Database Webhook for INSERT on `public.notifications`, pointing to the Edge Function with the private `x-yuku-push-secret` header.
5. Test on Android Chrome with YUKU closed and confirm account isolation.

## Production safety
- No production database was changed.
- No migration was applied.
- No Edge Function was deployed.
- No secrets or webhook settings were changed.
- The SQL in `docs/sql/push_subscriptions_draft.sql` is a draft for review, not an applied migration.
