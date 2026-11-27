-- Preserve suspension and ban sanctions when Talent Admin reviews a profile.
-- Approval may activate only an account that is still pending_verification.
-- Rejection updates verification/profile state but never rewrites account_status.

CREATE OR REPLACE FUNCTION public.admin_review_talent(
  p_talent_id uuid,
  p_is_approved boolean,
  p_ktp_status public.ktp_status_type,
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_old_state jsonb;
  v_new_state jsonb;
  v_current_status public.ktp_status_type;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_admin_permission('talent') THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya Admin YUKU yang berhak mengubah status kurasi Talent.';
  END IF;

  IF p_ktp_status NOT IN ('verified'::public.ktp_status_type, 'rejected'::public.ktp_status_type) THEN
    RAISE EXCEPTION 'Status KTP saat kurasi Talent harus verified atau rejected.';
  END IF;

  IF p_is_approved IS TRUE AND p_ktp_status <> 'verified'::public.ktp_status_type THEN
    RAISE EXCEPTION 'Talent tidak dapat disetujui sebelum KTP terverifikasi.';
  END IF;

  IF p_ktp_status = 'rejected'::public.ktp_status_type
     AND NULLIF(trim(COALESCE(p_notes,'')), '') IS NULL THEN
    RAISE EXCEPTION 'Alasan penolakan KTP wajib diisi.';
  END IF;

  SELECT jsonb_build_object(
    'talent_id', tp.id,
    'is_approved', tp.is_approved,
    'ktp_verification_status', ui.ktp_verification_status,
    'ktp_rejection_reason', ui.ktp_rejection_reason,
    'is_verified_18', u.is_verified_18,
    'account_status', u.account_status
  ), ui.ktp_verification_status
  INTO v_old_state, v_current_status
  FROM public.talent_profiles tp
  JOIN public.user_identities ui ON ui.id = tp.id
  JOIN public.users u ON u.id = tp.id
  WHERE tp.id = p_talent_id
  FOR UPDATE OF tp, ui, u;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil Talent, data identitas, atau akun pengguna tidak ditemukan.';
  END IF;

  IF v_current_status <> 'pending_review'::public.ktp_status_type THEN
    RAISE EXCEPTION 'Pengajuan KTP Talent hanya dapat diproses saat status pending_review.';
  END IF;

  UPDATE public.talent_profiles
  SET is_approved = p_is_approved, updated_at = NOW()
  WHERE id = p_talent_id;

  UPDATE public.user_identities
  SET ktp_verification_status = p_ktp_status,
      ktp_rejection_reason = CASE WHEN p_ktp_status = 'rejected'::public.ktp_status_type THEN trim(p_notes) ELSE NULL END,
      verified_at = CASE WHEN p_ktp_status = 'verified'::public.ktp_status_type THEN NOW() ELSE NULL END,
      verified_by_admin_id = CASE WHEN p_ktp_status = 'verified'::public.ktp_status_type THEN auth.uid() ELSE NULL END,
      updated_at = NOW()
  WHERE id = p_talent_id;

  UPDATE public.users
  SET is_verified_18 = (p_ktp_status = 'verified'::public.ktp_status_type),
      account_status = CASE
        WHEN p_is_approved IS TRUE
         AND account_status = 'pending_verification'::public.account_status_type
          THEN 'active'::public.account_status_type
        ELSE account_status
      END,
      updated_at = NOW()
  WHERE id = p_talent_id;

  SELECT jsonb_build_object(
    'talent_id', tp.id,
    'is_approved', tp.is_approved,
    'ktp_verification_status', ui.ktp_verification_status,
    'ktp_rejection_reason', ui.ktp_rejection_reason,
    'is_verified_18', u.is_verified_18,
    'account_status', u.account_status,
    'admin_notes', NULLIF(trim(COALESCE(p_notes,'')), '')
  )
  INTO v_new_state
  FROM public.talent_profiles tp
  JOIN public.user_identities ui ON ui.id = tp.id
  JOIN public.users u ON u.id = tp.id
  WHERE tp.id = p_talent_id;

  INSERT INTO public.admin_audit_logs (
    admin_user_id, action_type, target_table, target_id, old_data, new_data
  ) VALUES (
    auth.uid(), 'admin_review_talent', 'talent_profiles', p_talent_id::text,
    v_old_state, v_new_state
  );

  RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_review_talent(uuid, boolean, public.ktp_status_type, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_talent(uuid, boolean, public.ktp_status_type, text)
  TO authenticated;
