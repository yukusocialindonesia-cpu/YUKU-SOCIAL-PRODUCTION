# YUKU notifications — implementation status

This branch is intentionally isolated from production.

## Implemented in this branch
- In-app notification sound preference remains stored locally in the browser.
- AudioContext is resumed when the user enables sound, improving compatibility with mobile browsers that suspend audio until a user gesture.
- The service worker is registered on secure origins (HTTPS) and can display a Web Push event delivered by a push service.
- Clicking a push notification focuses the existing YUKU tab or opens the target page.

## Not yet enabled
The service worker is only a receiver. Push delivery while YUKU is closed is not active until all of these are completed:
1. Generate a VAPID key pair and configure the public key in the frontend build environment.
2. Add a private push_subscriptions table with RLS and ownership policies.
3. Add an authenticated subscription-management endpoint and a server-side sender using the VAPID private key stored as a Supabase Edge Function secret.
4. Connect notification creation to the sender and test on Android Chrome, including with the website closed.

## Production safety
- No Supabase database, migration, Edge Function, or production secret was changed by this branch.
- Do not expose VAPID private keys or Supabase secret/service-role keys to browser code.
- The database migration must be generated with the Supabase CLI, reviewed, and applied only to an isolated development database first. It must not be applied to production without separate explicit approval.
