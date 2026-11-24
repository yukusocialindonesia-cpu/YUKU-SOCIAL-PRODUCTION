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

const countRows = async (query: any) => {
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
};

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
        .select('id,email,full_name,phone_number,role,account_status,created_at')
        .in('role', ['customer', 'talent'])
        .order('created_at', { ascending: false })
        .limit(250);
      if (error) return json({ error: 'Daftar akun gagal dimuat.' }, 500);
      return json({ success: true, accounts: accounts || [] });
    }

    if (body?.action === 'preflight') {
      const targetUserId = typeof body.userId === 'string' ? body.userId : '';
      if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(targetUserId)) return json({ error: 'ID akun tidak valid.' }, 400);
      const { data: target, error: targetError } = await serviceClient
        .from('users')
        .select('id,role,account_status')
        .eq('id', targetUserId)
        .maybeSingle();
      if (targetError) return json({ error: 'Data akun target gagal diverifikasi.' }, 500);
      if (!target || !['customer', 'talent'].includes(target.role)) return json({ error: 'Akun Customer/Talent tidak ditemukan.' }, 404);

      try {
        const isTalent = target.role === 'talent';
        const activeBookingStatuses = ['pending_payment', 'paid_held_in_escrow', 'confirmed_by_talent', 'in_progress', 'disputed_hold'];
        const pendingPaymentStatuses = ['pending', 'settled_held', 'disputed_hold'];
        const pendingPayoutStatuses = ['requested', 'processing'];
        const pendingRefundStatuses = ['requested', 'approved'];
        const activeReportStatuses = ['open', 'investigating'];
        const activeEarningStatuses = ['held_in_escrow', 'disputed_hold', 'available_for_payout', 'partially_paid_out'];

        const [
          totalBookings, activeBookings, pendingPayments, pendingPayouts, pendingRefunds,
          activeReports, referralLinks, pendingRewards, affiliateEarnings, identityRows,
          qrisSubmissions, orders, cancellationCases, auditRecords, talentEarnings, outstandingTalentEarnings, reservedAllocations,
          totalPayments, totalPayoutRequests, totalRefunds, totalReports, totalReferralRewards, totalAffiliateEarnings, totalPayoutAllocations,
        ] = await Promise.all([
          countRows(serviceClient.from('bookings').select('id', { count: 'exact', head: true }).or(`customer_id.eq.${targetUserId},talent_id.eq.${targetUserId}`)),
          countRows(serviceClient.from('bookings').select('id', { count: 'exact', head: true }).or(`customer_id.eq.${targetUserId},talent_id.eq.${targetUserId}`).in('status', activeBookingStatuses)),
          countRows(serviceClient.from('payments').select('id,bookings!inner(customer_id,talent_id)', { count: 'exact', head: true }).eq(isTalent ? 'bookings.talent_id' : 'bookings.customer_id', targetUserId).in('payment_status', pendingPaymentStatuses)),
          isTalent ? countRows(serviceClient.from('payout_requests').select('id', { count: 'exact', head: true }).eq('talent_id', targetUserId).in('payout_status', pendingPayoutStatuses)) : Promise.resolve(0),
          countRows(serviceClient.from('refunds').select('id,bookings!inner(customer_id,talent_id)', { count: 'exact', head: true }).eq(isTalent ? 'bookings.talent_id' : 'customer_id', targetUserId).in('status', pendingRefundStatuses)),
          countRows(serviceClient.from('reports_complaints').select('id', { count: 'exact', head: true }).or(`reporter_id.eq.${targetUserId},reported_user_id.eq.${targetUserId}`).in('status', activeReportStatuses)),
          isTalent ? countRows(serviceClient.from('referral_relationships').select('id', { count: 'exact', head: true }).or(`referrer_id.eq.${targetUserId},referee_talent_id.eq.${targetUserId}`)) : countRows(serviceClient.from('referral_relationships').select('id', { count: 'exact', head: true }).eq('referrer_id', targetUserId)),
          countRows(serviceClient.from('referral_rewards').select('id', { count: 'exact', head: true }).eq('referrer_id', targetUserId).eq('status', 'pending_completion')),
          isTalent ? countRows(serviceClient.from('talent_affiliate_earnings').select('id', { count: 'exact', head: true }).eq('talent_id', targetUserId).in('status', activeEarningStatuses)) : Promise.resolve(0),
          countRows(serviceClient.from('user_identities').select('id', { count: 'exact', head: true }).eq('id', targetUserId)),
          isTalent ? Promise.resolve(0) : countRows(serviceClient.from('qris_payment_submissions').select('id', { count: 'exact', head: true }).eq('customer_id', targetUserId)),
          countRows(serviceClient.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', targetUserId)),
          isTalent ? countRows(serviceClient.from('customer_cancellation_cases').select('id,bookings!inner(talent_id)', { count: 'exact', head: true }).eq('bookings.talent_id', targetUserId)) : countRows(serviceClient.from('customer_cancellation_cases').select('id', { count: 'exact', head: true }).eq('customer_id', targetUserId)),
          countRows(serviceClient.from('admin_audit_logs').select('id', { count: 'exact', head: true }).eq('target_id', targetUserId)),
          isTalent ? countRows(serviceClient.from('talent_earnings').select('id', { count: 'exact', head: true }).eq('talent_id', targetUserId)) : Promise.resolve(0),
          isTalent ? countRows(serviceClient.from('talent_earnings').select('id', { count: 'exact', head: true }).eq('talent_id', targetUserId).in('status', activeEarningStatuses)) : Promise.resolve(0),
          isTalent ? countRows(serviceClient.from('payout_earnings_allocations').select('id,talent_earnings!inner(talent_id)', { count: 'exact', head: true }).eq('talent_earnings.talent_id', targetUserId).eq('status', 'reserved')) : Promise.resolve(0),
          countRows(serviceClient.from('payments').select('id,bookings!inner(customer_id,talent_id)', { count: 'exact', head: true }).eq(isTalent ? 'bookings.talent_id' : 'bookings.customer_id', targetUserId)),
          isTalent ? countRows(serviceClient.from('payout_requests').select('id', { count: 'exact', head: true }).eq('talent_id', targetUserId)) : Promise.resolve(0),
          isTalent ? countRows(serviceClient.from('refunds').select('id,bookings!inner(talent_id)', { count: 'exact', head: true }).eq('bookings.talent_id', targetUserId)) : countRows(serviceClient.from('refunds').select('id', { count: 'exact', head: true }).eq('customer_id', targetUserId)),
          countRows(serviceClient.from('reports_complaints').select('id', { count: 'exact', head: true }).or(`reporter_id.eq.${targetUserId},reported_user_id.eq.${targetUserId}`)),
          countRows(serviceClient.from('referral_rewards').select('id', { count: 'exact', head: true }).eq('referrer_id', targetUserId)),
          isTalent ? countRows(serviceClient.from('talent_affiliate_earnings').select('id', { count: 'exact', head: true }).eq('talent_id', targetUserId)) : Promise.resolve(0),
          isTalent ? countRows(serviceClient.from('payout_earnings_allocations').select('id,talent_earnings!inner(talent_id)', { count: 'exact', head: true }).eq('talent_earnings.talent_id', targetUserId)) : Promise.resolve(0),
        ]);

        const checks = [
          { key: 'active_bookings', label: 'Booking belum selesai', count: activeBookings, blocker: activeBookings > 0 },
          { key: 'pending_payments', label: 'Pembayaran tertahan / belum selesai', count: pendingPayments, blocker: pendingPayments > 0 },
          { key: 'pending_payouts', label: 'Payout menunggu / diproses', count: pendingPayouts, blocker: pendingPayouts > 0 },
          { key: 'pending_refunds', label: 'Refund menunggu / disetujui', count: pendingRefunds, blocker: pendingRefunds > 0 },
          { key: 'active_reports', label: 'Laporan atau sengketa terbuka', count: activeReports, blocker: activeReports > 0 },
          { key: 'pending_rewards', label: 'Reward referral belum dikreditkan', count: pendingRewards, blocker: pendingRewards > 0 },
          { key: 'talent_earnings', label: 'Saldo dan earning Talent yang belum selesai', count: outstandingTalentEarnings, blocker: outstandingTalentEarnings > 0 },
          { key: 'reserved_allocations', label: 'Saldo yang sedang dialokasikan untuk payout', count: reservedAllocations, blocker: reservedAllocations > 0 },
          { key: 'affiliate_earnings', label: 'Saldo affiliate / earning aktif', count: affiliateEarnings, blocker: affiliateEarnings > 0 },
          { key: 'talent_earnings_history', label: 'Riwayat ledger penghasilan Talent', count: talentEarnings, blocker: false, manualReview: talentEarnings > 0 },
          { key: 'identity_records', label: 'Catatan identitas / KTP', count: identityRows, blocker: false, manualReview: identityRows > 0 },
          { key: 'qris_submissions', label: 'Bukti pembayaran QRIS', count: qrisSubmissions, blocker: false, manualReview: qrisSubmissions > 0 },
          { key: 'orders', label: 'Riwayat pesanan', count: orders, blocker: false, manualReview: orders > 0 },
          { key: 'referral_links', label: 'Relasi referral', count: referralLinks, blocker: false, manualReview: referralLinks > 0 },
          { key: 'total_bookings', label: 'Total riwayat booking', count: totalBookings, blocker: false, manualReview: totalBookings > 0 },
          { key: 'cancellation_cases', label: 'Riwayat kasus pembatalan', count: cancellationCases, blocker: false, manualReview: cancellationCases > 0 },
          { key: 'audit_records', label: 'Catatan audit terkait akun', count: auditRecords, blocker: false, manualReview: auditRecords > 0 },
          { key: 'payment_history', label: 'Seluruh riwayat pembayaran', count: totalPayments, blocker: false, manualReview: totalPayments > 0 },
          { key: 'payout_history', label: 'Seluruh riwayat payout', count: totalPayoutRequests, blocker: false, manualReview: totalPayoutRequests > 0 },
          { key: 'refund_history', label: 'Seluruh riwayat refund', count: totalRefunds, blocker: false, manualReview: totalRefunds > 0 },
          { key: 'report_history', label: 'Seluruh riwayat laporan', count: totalReports, blocker: false, manualReview: totalReports > 0 },
          { key: 'referral_reward_history', label: 'Seluruh riwayat reward referral', count: totalReferralRewards, blocker: false, manualReview: totalReferralRewards > 0 },
          { key: 'affiliate_earning_history', label: 'Seluruh riwayat earning affiliate', count: totalAffiliateEarnings, blocker: false, manualReview: totalAffiliateEarnings > 0 },
          { key: 'payout_allocation_history', label: 'Seluruh riwayat alokasi payout', count: totalPayoutAllocations, blocker: false, manualReview: totalPayoutAllocations > 0 },
        ];
        const blockers = checks.filter((item) => item.blocker).length;
        const manualReviews = checks.filter((item) => item.manualReview).length;
        return json({
          success: true,
          preflight: {
            status: blockers > 0 ? 'blocked' : 'manual_review_required',
            blockers,
            manualReviews,
            checks,
            permanentDeletionEnabled: false,
            note: 'Pemeriksaan ini hanya membaca data. Hasil tanpa blocker bukan persetujuan penghapusan; retensi data, file Storage, audit, dan kewajiban hukum tetap perlu ditinjau manual.',
          },
        });
      } catch (_error) {
        return json({ error: 'Pemeriksaan kelayakan tidak lengkap. Demi keamanan, akun tidak boleh diproses untuk penghapusan.' }, 500);
      }
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

    // Update database status first with an optimistic status check.
    // Auth and audit changes are compensated if a later step fails.
    const { data: updatedRows, error: updateError } = await serviceClient
      .from('users')
      .update({ account_status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', targetUserId)
      .eq('account_status', target.account_status)
      .select('id');
    if (updateError) return json({ error: 'Status database gagal diperbarui.' }, 500);
    if (!updatedRows?.length) return json({ error: 'Status akun berubah oleh proses lain. Muat ulang daftar akun.' }, 409);

    const nextBanDuration = nextStatus === 'suspended' ? '876000h' : 'none';
    const previousBanDuration = target.account_status === 'suspended' ? '876000h' : 'none';
    const { error: authUpdateError } = await serviceClient.auth.admin.updateUserById(targetUserId, {
      ban_duration: nextBanDuration,
    });
    if (authUpdateError) {
      const { error: rollbackError } = await serviceClient
        .from('users')
        .update({ account_status: target.account_status, updated_at: new Date().toISOString() })
        .eq('id', targetUserId)
        .eq('account_status', nextStatus);
      return json({
        error: rollbackError
          ? 'Perubahan status Auth gagal dan pemulihan status database juga gagal. Akun perlu pemeriksaan manual segera.'
          : 'Perubahan status Auth gagal. Status database telah dikembalikan ke kondisi sebelumnya.',
      }, 500);
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
      const [authRollback, dbRollback] = await Promise.all([
        serviceClient.auth.admin.updateUserById(targetUserId, { ban_duration: previousBanDuration }),
        serviceClient
          .from('users')
          .update({ account_status: target.account_status, updated_at: new Date().toISOString() })
          .eq('id', targetUserId)
          .eq('account_status', nextStatus),
      ]);
      const rollbackFailed = Boolean(authRollback.error || dbRollback.error);
      return json({
        error: rollbackFailed
          ? 'Audit log gagal dan pemulihan status tidak lengkap. Akun perlu pemeriksaan manual segera.'
          : 'Audit log gagal disimpan. Perubahan status dan Auth telah dikembalikan ke kondisi sebelumnya.',
      }, 500);
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
