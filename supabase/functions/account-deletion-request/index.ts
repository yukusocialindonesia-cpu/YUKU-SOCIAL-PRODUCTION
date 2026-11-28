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
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Silakan login untuk mengajukan penghapusan akun.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Konfigurasi layanan belum lengkap.' }, 500);

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
    if (authError || !authData.user) return json({ error: 'Sesi login tidak valid. Silakan login kembali.' }, 401);

    const body = await req.json().catch(() => null);
    const action = body?.action;
    if (action !== 'status' && action !== 'submit') {
      return json({ error: 'Permintaan tidak valid.' }, 400);
    }

    const { data: existing, error: lookupError } = await serviceClient
      .from('account_deletion_requests')
      .select('id,status,requested_at')
      .eq('user_id', authData.user.id)
      .in('status', ['pending', 'under_review'])
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error('YUKU account deletion lookup failed:', lookupError);
      return json({ error: 'Status permintaan belum dapat diperiksa. Silakan coba lagi.' }, 500);
    }

    if (action === 'status') {
      return json({ success: true, request: existing || null });
    }
    if (existing) {
      return json({ success: true, alreadyPending: true, request: existing });
    }

    const { data: created, error: insertError } = await serviceClient
      .from('account_deletion_requests')
      .insert({
        user_id: authData.user.id,
        email_snapshot: authData.user.email || null,
        status: 'pending',
      })
      .select('id,status,requested_at')
      .single();

    if (insertError) {
      // A concurrent submission may have won the unique pending-request index.
      if (insertError.code === '23505') {
        const { data: concurrent } = await serviceClient
          .from('account_deletion_requests')
          .select('id,status,requested_at')
          .eq('user_id', authData.user.id)
          .in('status', ['pending', 'under_review'])
          .order('requested_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (concurrent) return json({ success: true, alreadyPending: true, request: concurrent });
      }
      console.error('YUKU account deletion submission failed:', insertError);
      return json({ error: 'Permintaan belum berhasil dikirim. Silakan coba lagi.' }, 500);
    }

    return json({ success: true, alreadyPending: false, request: created });
  } catch (error) {
    console.error('YUKU account deletion request error:', error);
    return json({ error: 'Terjadi kesalahan saat memproses permintaan.' }, 500);
  }
});
