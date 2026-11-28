import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method tidak diizinkan.' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sesi login diperlukan.' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return json({ error: 'Konfigurasi layanan belum lengkap.' }, 500);

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const serviceClient = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const token = authorization.slice(7);
    const { data: auth, error: authError } = await userClient.auth.getUser(token);
    if (authError || !auth.user) return json({ error: 'Sesi login tidak valid.' }, 401);
    const { data: actor, error: actorError } = await serviceClient.from('users').select('account_status').eq('id', auth.user.id).maybeSingle();
    if (actorError || actor?.account_status !== 'active') return json({ error: 'Akun Admin tidak aktif.' }, 403);
    const { data: access, error: accessError } = await userClient.rpc('get_admin_access');
    if (accessError || access?.is_super_admin !== true) return json({ error: 'Hanya Super Admin yang dapat mengelola permintaan hapus akun.' }, 403);

    const body = await req.json().catch(() => null);
    if (body?.action === 'list') {
      const { data, error } = await serviceClient.from('account_deletion_requests')
        .select('id,user_id,email_snapshot,status,requested_at,reviewed_at,admin_note')
        .in('status', ['pending', 'under_review', 'approved', 'rejected'])
        .order('requested_at', { ascending: true }).limit(200);
      if (error) return json({ error: 'Daftar permintaan belum dapat dimuat.' }, 500);
      return json({ success: true, requests: data || [] });
    }
    if (body?.action === 'review') {
      const id = typeof body.requestId === 'string' ? body.requestId : '';
      const status = body.status;
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '';
      if (!id || !['under_review', 'rejected'].includes(status)) return json({ error: 'Perubahan status tidak valid.' }, 400);
      if (status === 'rejected' && !note) return json({ error: 'Catatan alasan penolakan wajib diisi.' }, 400);
      const { data: current, error: currentError } = await serviceClient.from('account_deletion_requests')
        .select('id,status').eq('id', id).maybeSingle();
      if (currentError || !current) return json({ error: 'Permintaan tidak ditemukan.' }, 404);
      if (!['pending', 'under_review'].includes(current.status)) return json({ error: 'Permintaan ini sudah diputuskan dan tidak dapat diubah dari antrean aktif.' }, 409);
      const { data: updated, error: updateError } = await serviceClient.from('account_deletion_requests')
        .update({ status, admin_note: note || null, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id).in('status', ['pending', 'under_review'])
        .select('id,status,reviewed_at,admin_note').maybeSingle();
      if (updateError || !updated) return json({ error: 'Status permintaan gagal diperbarui. Muat ulang antrean.' }, 409);
      return json({ success: true, request: updated });
    }
    return json({ error: 'Aksi tidak dikenal.' }, 400);
  } catch (error) {
    console.error('YUKU account deletion admin error:', error);
    return json({ error: 'Terjadi kesalahan saat memproses antrean.' }, 500);
  }
});
