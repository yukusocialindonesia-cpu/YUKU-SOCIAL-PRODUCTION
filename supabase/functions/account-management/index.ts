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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method tidak diizinkan.' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sesi login diperlukan.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Konfigurasi layanan akun belum lengkap.' }, 500);

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
      return json({ error: 'Akses ditolak. Hanya Super Admin yang dapat mengelola akun Customer dan Talent.' }, 403);
    }

    const body = await req.json().catch(() => null);
    if (body?.action === 'list') {
      const { data: accounts, error } = await serviceClient
        .from('users')
        .select('id,email,full_name,role,account_status,created_at')
        .in('role', ['customer', 'talent'])
        .order('created_at', { ascending: false })
        .limit(250);
      if (error) return json({ error: 'Daftar akun gagal dimuat.' }, 500);
      return json({ success: true, accounts: accounts || [] });
    }

    if (body?.action !== 'set_status') return json({ error: 'Aksi tidak dikenal.' }, 400);
    const targetUserId = typeof body.userId === 'string' ? body.userId : '';
    const nextStatus = body.status;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(targetUserId)) return json({ error: 'ID akun tidak valid.' }, 400);
    if (targetUserId === authData.user.id) return json({ error: 'Super Admin tidak dapat mengubah status akunnya sendiri dari menu ini.' }, 400);
    if (nextStatus !== 'active' && nextStatus !== 'suspended') return json({ error: 'Status tujuan tidak valid.' }, 400);
    if (reason.length < 5 || reason.length > 500) return json({ error: 'Alasan wajib diisi (5–500 karakter).' }, 400);

    const { data: target, error: targetError } = await serviceClient
      .from('users')
      .select('id,email,role,account_status')
      .eq('id', targetUserId)
      .maybeSingle();
    if (targetError) return json({ error: 'Data akun target gagal diverifikasi.' }, 500);
    if (!target || !['customer', 'talent'].includes(target.role)) {
      return json({ error: 'Akun Customer/Talent tidak ditemukan.' }, 404);
    }
    if (target.account_status === nextStatus) return json({ error: 'Akun sudah memiliki status tersebut.' }, 409);
    if (target.account_status === 'banned') return json({ error: 'Akun yang diblokir permanen tidak dapat diaktifkan dari menu ini.' }, 403);

    // Auth ban is applied first when suspending, so a DB failure cannot leave a
    // newly suspended account able to refresh its session. Re-enable DB first
    // when activating, so a failed Auth update remains fail-closed.
    if (nextStatus === 'suspended') {
      const { error } = await serviceClient.auth.admin.updateUserById(targetUserId, { ban_duration: '876000h' });
      if (error) return json({ error: 'Sesi akun gagal diblokir. Status database tidak diubah.' }, 500);
    }

    const { error: updateError } = await serviceClient
      .from('users')
      .update({ account_status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', targetUserId);
    if (updateError) return json({ error: 'Status database gagal diperbarui. Hubungi Super Admin untuk pemeriksaan sesi akun.' }, 500);

    if (nextStatus === 'active') {
      const { error } = await serviceClient.auth.admin.updateUserById(targetUserId, { ban_duration: 'none' });
      if (error) return json({ error: 'Status database sudah aktif, tetapi pemulihan sesi Auth gagal. Akun tetap tidak dapat login sampai diperiksa.' }, 500);
    }

    const { error: auditError } = await serviceClient.from('admin_audit_logs').insert({
      admin_user_id: authData.user.id,
      action_type: nextStatus === 'suspended' ? 'customer_talent_account_suspended' : 'customer_talent_account_reactivated',
      target_table: 'public.users',
      target_id: targetUserId,
      old_data: { account_status: target.account_status },
      new_data: { account_status: nextStatus, reason },
    });
    if (auditError) {
      return json({ error: 'Status akun berubah, tetapi audit log gagal disimpan. Jangan ulangi tindakan; minta pemeriksaan Super Admin.' }, 500);
    }

    return json({
      success: true,
      message: nextStatus === 'suspended'
        ? 'Akun dinonaktifkan dan login baru serta perpanjangan sesi diblokir. Sesi yang sedang aktif akan berakhir saat access token kedaluwarsa.'
        : 'Akun diaktifkan kembali. Pengguna dapat login lagi.',
    });
  } catch (_error) {
    return json({ error: 'Terjadi kesalahan saat mengelola akun.' }, 500);
  }
});
