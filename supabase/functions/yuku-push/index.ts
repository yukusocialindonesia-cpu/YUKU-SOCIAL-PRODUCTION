import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-yuku-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, message: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, message: "Server configuration is incomplete." }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: "Invalid JSON body." }, 400);
  }

  const action = payload.action;

  if (action === "subscribe" || action === "unsubscribe") {
    const authorization = request.headers.get("Authorization");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!authorization || !anonKey) return json({ ok: false, message: "Authentication required." }, 401);

    const token = authorization.replace(/^Bearer\s+/i, "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ ok: false, message: "Session tidak valid. Silakan login kembali." }, 401);
    const userId = userData.user.id;

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
        return json({ ok: false, message: "Data langganan perangkat tidak valid." }, 400);
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

      if (error) return json({ ok: false, message: "Gagal menyimpan perangkat. Pastikan tabel push sudah dipasang." }, 500);
      return json({ ok: true });
    }

    const endpoint = typeof payload.endpoint === "string" ? payload.endpoint : "";
    if (!endpoint.startsWith("https://")) return json({ ok: false, message: "Alamat perangkat tidak valid." }, 400);
    const { error } = await admin.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
    if (error) return json({ ok: false, message: "Gagal menghapus perangkat." }, 500);
    return json({ ok: true });
  }

  if (action === "send") {
    const expectedSecret = Deno.env.get("YUKU_PUSH_WEBHOOK_SECRET");
    const suppliedSecret = request.headers.get("x-yuku-push-secret");
    if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
      return json({ ok: false, message: "Unauthorized webhook." }, 401);
    }

    const notificationId =
      typeof payload.notification_id === "string" ? payload.notification_id :
      typeof (payload.record as Record<string, unknown> | undefined)?.id === "string"
        ? (payload.record as Record<string, unknown>).id as string
        : null;
    if (!notificationId) return json({ ok: false, message: "notification_id is required." }, 400);

    const { data: notification, error: notificationError } = await admin
      .from("notifications")
      .select("id, user_id, title, message, metadata")
      .eq("id", notificationId)
      .maybeSingle();
    if (notificationError || !notification) return json({ ok: false, message: "Notification not found." }, 404);

    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT");
    if (!publicKey || !privateKey || !subject) return json({ ok: false, message: "VAPID keys are not configured." }, 500);

    webpush.setVapidDetails(subject, publicKey, privateKey);
    const { data: subscriptions, error: subscriptionsError } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", notification.user_id);
    if (subscriptionsError) return json({ ok: false, message: "Could not load device subscriptions." }, 500);

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

    return json({ ok: true, sent, expired });
  }

  return json({ ok: false, message: "Unknown action." }, 400);
});
