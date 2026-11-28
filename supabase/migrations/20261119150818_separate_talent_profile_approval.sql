CREATE OR REPLACE FUNCTION public.admin_review_talent_profile(
  p_talent_id uuid,
  p_is_approved boolean,
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role public.user_role_type;
  v_account_status public.account_status_type;
  v_is_verified_18 boolean;
  v_ktp_status public.ktp_status_type;
  v_old_state jsonb;
  v_new_state jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Admin YUKU yang dapat meninjau profil Talent.';
  END IF;

  SELECT u.role, u.account_status, u.is_verified_18,
         ui.ktp_verification_status,
         jsonb_build_object('is_approved', tp.is_approved)
    INTO v_role, v_account_status, v_is_verified_18, v_ktp_status, v_old_state
  FROM public.talent_profiles tp
  JOIN public.users u ON u.id = tp.id
  JOIN public.user_identities ui ON ui.id = tp.id
  WHERE tp.id = p_talent_id
  FOR UPDATE OF tp, u, ui;

  IF NOT FOUND OR v_role <> 'talent'::public.user_role_type THEN
    RAISE EXCEPTION 'Profil Talent tidak ditemukan.';
  END IF;

  IF p_is_approved IS TRUE THEN
    IF v_ktp_status IS DISTINCT FROM 'verified'::public.ktp_status_type
       OR v_is_verified_18 IS NOT TRUE
       OR v_account_status <> 'active'::public.account_status_type THEN
      RAISE EXCEPTION 'Profil hanya dapat disetujui setelah KTP/usia terverifikasi dan akun aktif.';
    END IF;
  END IF;

  UPDATE public.talent_profiles
     SET is_approved = p_is_approved,
         updated_at = NOW()
   WHERE id = p_talent_id;

  v_new_state := jsonb_build_object(
    'is_approved', p_is_approved,
    'admin_notes', NULLIF(trim(COALESCE(p_notes, '')), '')
  );

  INSERT INTO public.admin_audit_logs (
    admin_user_id, action_type, target_table, target_id, old_data, new_data
  ) VALUES (
    auth.uid(), 'admin_review_talent_profile', 'talent_profiles',
    p_talent_id::text, v_old_state, v_new_state
  );

  RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_review_talent_profile(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_talent_profile(uuid, boolean, text) TO authenticated;
COMMENT ON FUNCTION public.admin_review_talent_profile(uuid, boolean, text) IS
  'Admin-only profile approval/rejection. Does not modify KTP verification, account status, or service approvals.';