
CREATE OR REPLACE FUNCTION public.admin_review_ktp(
  p_user_id uuid,
  p_decision public.ktp_status_type,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_current_status public.ktp_status_type;
  v_old_user jsonb;
  v_new_user jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya Admin yang dapat meninjau KTP.';
  END IF;

  IF p_decision NOT IN ('verified'::public.ktp_status_type, 'rejected'::public.ktp_status_type) THEN
    RAISE EXCEPTION 'Keputusan verifikasi KTP hanya boleh verified atau rejected.';
  END IF;

  IF p_decision = 'rejected'::public.ktp_status_type
     AND NULLIF(trim(COALESCE(p_reason,'')), '') IS NULL THEN
    RAISE EXCEPTION 'Alasan penolakan KTP wajib diisi.';
  END IF;

  SELECT jsonb_build_object(
    'user_id', u.id,
    'account_status', u.account_status,
    'is_verified_18', u.is_verified_18,
    'ktp_verification_status', ui.ktp_verification_status,
    'ktp_rejection_reason', ui.ktp_rejection_reason
  )
  INTO v_old_user
  FROM public.users u
  JOIN public.user_identities ui ON ui.id = u.id
  WHERE u.id = p_user_id
  FOR UPDATE OF u, ui;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data pengguna atau identitas tidak ditemukan.';
  END IF;

  v_current_status := (v_old_user->>'ktp_verification_status')::public.ktp_status_type;

  IF v_current_status <> 'pending_review'::public.ktp_status_type THEN
    RAISE EXCEPTION 'Verifikasi KTP hanya dapat diproses untuk status pending_review.';
  END IF;

  UPDATE public.user_identities
  SET ktp_verification_status = p_decision,
      ktp_rejection_reason = CASE WHEN p_decision = 'rejected'::public.ktp_status_type THEN trim(p_reason) ELSE NULL END,
      verified_at = CASE WHEN p_decision = 'verified'::public.ktp_status_type THEN NOW() ELSE NULL END,
      verified_by_admin_id = CASE WHEN p_decision = 'verified'::public.ktp_status_type THEN auth.uid() ELSE NULL END,
      updated_at = NOW()
  WHERE id = p_user_id;

  IF p_decision = 'verified'::public.ktp_status_type THEN
    UPDATE public.users
    SET is_verified_18 = TRUE,
        account_status = CASE
          WHEN account_status = 'pending_verification'::public.account_status_type
          THEN 'active'::public.account_status_type
          ELSE account_status
        END,
        updated_at = NOW()
    WHERE id = p_user_id;
  ELSE
    UPDATE public.users
    SET is_verified_18 = FALSE,
        updated_at = NOW()
    WHERE id = p_user_id;
  END IF;

  SELECT jsonb_build_object(
    'user_id', u.id,
    'account_status', u.account_status,
    'is_verified_18', u.is_verified_18,
    'ktp_verification_status', ui.ktp_verification_status,
    'ktp_rejection_reason', ui.ktp_rejection_reason
  )
  INTO v_new_user
  FROM public.users u
  JOIN public.user_identities ui ON ui.id = u.id
  WHERE u.id = p_user_id;

  INSERT INTO public.admin_audit_logs (
    admin_user_id, action_type, target_table, target_id, old_data, new_data
  ) VALUES (
    auth.uid(), 'admin_review_ktp', 'user_identities', p_user_id::text,
    v_old_user,
    v_new_user || jsonb_build_object('admin_reason', NULLIF(trim(COALESCE(p_reason,'')), ''))
  );

  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_review_talent(
  p_talent_id uuid,
  p_is_approved boolean,
  p_ktp_status public.ktp_status_type,
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_old_state jsonb;
  v_new_state jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya Admin YUKU yang berhak mengubah status kurasi Talent.';
  END IF;

  IF p_ktp_status NOT IN (
    'verified'::public.ktp_status_type,
    'rejected'::public.ktp_status_type
  ) THEN
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
  )
  INTO v_old_state
  FROM public.talent_profiles tp
  JOIN public.user_identities ui ON ui.id = tp.id
  JOIN public.users u ON u.id = tp.id
  WHERE tp.id = p_talent_id
  FOR UPDATE OF tp, ui, u;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil Talent, data identitas, atau akun pengguna tidak ditemukan.';
  END IF;

  UPDATE public.talent_profiles
  SET is_approved = p_is_approved,
      updated_at = NOW()
  WHERE id = p_talent_id;

  UPDATE public.user_identities
  SET ktp_verification_status = p_ktp_status,
      ktp_rejection_reason = CASE
        WHEN p_ktp_status = 'rejected'::public.ktp_status_type THEN trim(p_notes)
        ELSE NULL
      END,
      verified_at = CASE
        WHEN p_ktp_status = 'verified'::public.ktp_status_type THEN NOW()
        ELSE NULL
      END,
      verified_by_admin_id = CASE
        WHEN p_ktp_status = 'verified'::public.ktp_status_type THEN auth.uid()
        ELSE NULL
      END,
      updated_at = NOW()
  WHERE id = p_talent_id;

  UPDATE public.users
  SET is_verified_18 = (p_ktp_status = 'verified'::public.ktp_status_type),
      account_status = CASE
        WHEN p_is_approved THEN 'active'::public.account_status_type
        ELSE 'pending_verification'::public.account_status_type
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

REVOKE ALL ON FUNCTION public.admin_review_ktp(uuid, public.ktp_status_type, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_review_talent(uuid, boolean, public.ktp_status_type, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_ktp(uuid, public.ktp_status_type, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_talent(uuid, boolean, public.ktp_status_type, text) TO authenticated;

