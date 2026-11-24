import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const allowedOrigin = Deno.env.get("APP_ORIGIN")?.replace(/\/$/, "");

function responseHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-yuku-push-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  });
  if (origin && allowedOrigin && origin === allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }
  return headers;
}

const json = (body: Record<string, unknown>, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) });

function getDefaultSecretKey(variable: string): string | null {
  const raw = Deno.env.get(variable);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = parsed.default;
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (origin && (!allowedOrigin || origin !== allowedOrigin)) {
    return json({ ok: false, message: "Origin not allowed." }, 403);
  }
  if (request.method === "OPTIONS") {
    if (!origin || !allowedOrigin) return new Response("CORS is not configured.", { status: 403 });
    return new Response("ok", { headers: responseHeaders(origin) });
  }
  if (request.method !== "POST") return json({ ok: false, message: "Method not allowed" }, 405, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  // Supabase provides this legacy JWT key automatically to hosted Edge Functions.
  // It stays server-side and does not need to be added to custom Function Secrets.
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, message: "Server configuration is incomplete." }, 500, origin);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: "Invalid JSON body." }, 400, origin);
  }

  const action = payload.action;

  if (action === "subscribe" || action === "unsubscribe") {
    const authorization = request.headers.get("Authorization");
    const anonKey = getDefaultSecretKey("SUPABASE_PUBLISHABLE_KEYS") ?? Deno.env.get("SUPABASE_ANON_KEY");
    if (!authorization || !anonKey) return json({ ok: false, message: "Authentication required." }, 401, origin);

    const token = authorization.replace(/^Bearer\s+/i, "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ ok: false, message: "Session tidak valid. Silakan login kembali." }, 401, origin);
    const userId = userData.user.id;

    // This function writes through service_role, so enforce the account state
    // explicitly instead of relying on the caller's RLS policies.
    if (action === "subscribe") {
      const { data: account, error: accountError } = await admin
        .from("users")
        .select("account_status")
        .eq("id", userId)
        .maybeSingle();
      if (accountError || !account || !["active", "pending_verification"].includes(account.account_status)) {
        return json({ ok: false, message: "Akun sedang dinonaktifkan dan tidak dapat mendaftarkan perangkat." }, 403, origin);
      }
    }

    if (action === "subscribe") {
      const subscription = payload.subscription as {
        endpoint?: string;
        expirationTime?: number | null;
        keys?: { p256dh?: string; auth?: string };
      } | undefined;
      const endpoint = subscription?.endpoint;
      const p256dh = subscription?.keys?.p256dh;
      const auth = subscription?.keys?.auth;
      if (!endpoint || !endpoint.startsWith("https://") || !p256dh || !auth) {
        return json({ ok: false, message: "Data langganan perangkat tidak valid." }, 400, origin);
      }

      const { data: existingEndpoint, error: lookupError } = await admin
        .from("push_subscriptions")
        .select("user_id")
        .eq("endpoint", endpoint)
        .maybeSingle();
      if (lookupError) return json({ ok: false, message: "Could not verify existing device registration." }, 500, origin);
      if (existingEndpoint && existingEndpoint.user_id !== userId) {
        return json({ ok: false, message: "Perangkat ini sudah terdaftar pada akun lain." }, 409, origin);
      }

      const { error } = await admin.from("push_subscriptions").upsert({
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        expiration_time: subscription?.expirationTime ?? null,
        user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });

      if (error) return json({ ok: false, message: "Gagal menyimpan perangkat. Pastikan tabel push sudah dipasang." }, 500, origin);
      return json({ ok: true }, 200, origin);
    }

    const endpoint = typeof payload.endpoint === "string" ? payload.endpoint : "";
    if (!endpoint.startsWith("https://")) return json({ ok: false, message: "Alamat perangkat tidak valid." }, 400, origin);
    const { error } = await admin.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
    if (error) return json({ ok: false, message: "Gagal menghapus perangkat." }, 500, origin);
    return json({ ok: true }, 200, origin);
  }

  if (action === "send") {
    const expectedSecret = Deno.env.get("YUKU_PUSH_WEBHOOK_SECRET");
    const suppliedSecret = request.headers.get("x-yuku-push-secret");
    if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
      return json({ ok: false, message: "Unauthorized webhook." }, 401, origin);
    }

    const notificationId =
      typeof payload.notification_id === "string" ? payload.notification_id :
      typeof (payload.record as Record<string, unknown> | undefined)?.id === "string"
        ? (payload.record as Record<string, unknown>).id as string
        : null;
    if (!notificationId) return json({ ok: false, message: "notification_id is required." }, 400, origin);

    const { data: notification, error: notificationError } = await admin
      .from("notifications")
      .select("id, user_id, title, message, metadata")
      .eq("id", notificationId)
      .maybeSingle();
    if (notificationError || !notification) return json({ ok: false, message: "Notification not found." }, 404, origin);

    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT");
    if (!publicKey || !privateKey || !subject) return json({ ok: false, message: "VAPID keys are not configured." }, 500, origin);

    webpush.setVapidDetails(subject, publicKey, privateKey);
    const { data: subscriptions, error: subscriptionsError } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", notification.user_id);
    if (subscriptionsError) return json({ ok: false, message: "Could not load device subscriptions." }, 500, origin);

    const route = (notification.metadata as Record<string, unknown> | null)?.route;
    const pushPayload = JSON.stringify({
      title: notification.title,
      body: notification.message,
      url: typeof route === "string" && route.startsWith("/") ? route : "/",
      tag: notification.id,
    });

    let sent = 0;
    let expired = 0;
    for (const subscription of subscriptions ?? []) {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, pushPayload);
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
          expired += 1;
        }
      }
    }

    return json({ ok: true, sent, expired }, 200, origin);
  }

  return json({ ok: false, message: "Unknown action." }, 400, origin);
});
