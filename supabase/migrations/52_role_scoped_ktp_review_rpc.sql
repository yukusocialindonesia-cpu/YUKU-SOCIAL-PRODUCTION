-- KTP review: Talent files require Talent permission; Customer files require Support.
create or replace function public.admin_review_ktp(p_user_id uuid,p_decision public.ktp_status_type,p_reason text default null)
returns boolean language plpgsql security definer set search_path to ''
as $function$
declare v_current_status public.ktp_status_type; v_target_role public.user_role_type;
begin
  select u.role into v_target_role from public.users u where u.id=p_user_id;
  if not found then raise exception 'Pengguna tidak ditemukan.'; end if;
  if v_target_role='talent'::public.user_role_type then
    if not public.has_admin_permission('talent') then raise exception 'Akses ditolak: pemeriksaan KTP Talent memerlukan izin Talent.'; end if;
  elsif v_target_role='customer'::public.user_role_type then
    if not public.has_admin_permission('support') then raise exception 'Akses ditolak: pemeriksaan KTP Customer memerlukan izin Support.'; end if;
  else raise exception 'Jenis akun ini tidak dapat diproses melalui verifikasi KTP.';
  end if;
  if p_decision not in ('verified'::public.ktp_status_type,'rejected'::public.ktp_status_type) then
    raise exception 'Keputusan verifikasi KTP hanya boleh verified atau rejected.';
  end if;
  select ui.ktp_verification_status into v_current_status from public.user_identities ui where ui.id=p_user_id for update;
  if not found then raise exception 'Permohonan ditolak: data identitas pengguna tidak ditemukan.'; end if;
  if v_current_status<>'pending_review'::public.ktp_status_type then
    raise exception 'Permohonan ditolak: verifikasi KTP hanya dapat diproses untuk status pending_review.';
  end if;
  update public.user_identities set
    ktp_verification_status=p_decision,
    ktp_rejection_reason=case when p_decision='rejected'::public.ktp_status_type then p_reason else null end,
    verified_at=case when p_decision='verified'::public.ktp_status_type then now() else null end,
    verified_by_admin_id=case when p_decision='verified'::public.ktp_status_type then auth.uid() else null end
  where id=p_user_id;
  if p_decision='verified'::public.ktp_status_type then
    update public.users set is_verified_18=true,
      account_status=case when account_status='pending_verification'::public.account_status_type then 'active'::public.account_status_type else account_status end
    where id=p_user_id;
  elsif p_decision='rejected'::public.ktp_status_type then
    update public.users set is_verified_18=false where id=p_user_id;
  end if;
  return true;
end;
$function$;
