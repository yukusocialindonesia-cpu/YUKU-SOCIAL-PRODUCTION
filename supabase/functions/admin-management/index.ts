import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const allowedPermissions = new Set(['talent', 'booking', 'finance', 'support']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method tidak diizinkan.' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sesi login diperlukan.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Konfigurasi layanan undangan belum lengkap.' }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const token = authorization.slice('Bearer '.length);
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Sesi login tidak valid.' }, 401);

    const { data: access, error: accessError } = await userClient.rpc('get_admin_access');
    if (accessError || access?.is_super_admin !== true) {
      return json({ error: 'Hanya Super Admin yang dapat mengundang Admin baru.' }, 403);
    }

    const body = await req.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const requestOrigin = req.headers.get('origin');
    let redirectTo: string;
    try {
      const candidate = new URL(typeof body?.redirectTo === 'string' ? body.redirectTo : '');
      if (!requestOrigin || candidate.origin !== new URL(requestOrigin).origin || candidate.pathname !== '/aktivasi-admin' || !['https:', 'http:'].includes(candidate.protocol)) {
        return json({ error: 'Alamat aktivasi Admin tidak valid.' }, 400);
      }
      redirectTo = candidate.toString();
    } catch {
      return json({ error: 'Alamat aktivasi Admin tidak valid.' }, 400);
    }

    const permissions = Array.isArray(body?.permissions)
      ? [...new Set(body.permissions.filter((item: unknown): item is string => typeof item === 'string'))]
      : [];

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Alamat email tidak valid.' }, 400);
    }
    if (permissions.length === 0 || permissions.some((permission) => !allowedPermissions.has(permission))) {
      return json({ error: 'Pilih minimal satu izin menu yang valid.' }, 400);
    }

    // Do not turn an existing Customer/Talent account into Admin via an invite.
    // The auth.users creation trigger keeps a matching public.users profile.
    const { data: existingUser, error: existingUserError } = await serviceClient
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    if (existingUserError) {
      return json({ error: 'Status email belum dapat diverifikasi. Coba lagi nanti.' }, 500);
    }
    if (existingUser) {
      return json({ error: 'Email sudah terdaftar. Gunakan email baru untuk undangan Admin.' }, 409);
    }

    const { data: invitation, error: inviteError } =
      await serviceClient.auth.admin.inviteUserByEmail(email, { redirectTo });
    const invitedUserId = invitation.user?.id;
    if (inviteError || !invitedUserId) {
      return json({ error: inviteError?.message || 'Undangan Admin gagal dibuat.' }, 400);
    }

    // Provisioning role, Admin account, and permissions in one database transaction.
    // The invite email is sent by Supabase before this RPC; on failure, remove the
    // newly invited Auth user so the emailed link cannot activate a partial account.
    const { error: provisionError } = await serviceClient.rpc('provision_scoped_admin_account_with_permissions', {
      p_user_id: invitedUserId,
      p_created_by: authData.user.id,
      p_permissions: permissions,
    });
    if (provisionError) {
      const { error: cleanupError } = await serviceClient.auth.admin.deleteUser(invitedUserId);
      if (cleanupError) {
        return json({
          error: 'Provisioning Admin gagal dan pembersihan akun undangan juga gagal. Jangan kirim ulang undangan ke email ini; minta Super Admin memeriksa akun tersebut.',
        }, 500);
      }
      return json({ error: 'Akun Admin gagal disiapkan. Undangan dibatalkan; silakan periksa izin lalu coba kembali.' }, 500);
    }

    return json({
      success: true,
      user_id: invitedUserId,
      email,
      permissions,
      message: 'Undangan Admin berhasil dikirim.',
    }, 201);
  } catch (_error) {
    return json({ error: 'Terjadi kesalahan saat membuat undangan Admin.' }, 500);
  }
});
