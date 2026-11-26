-- Link both required identity evidence files to the same review record.
ALTER TABLE public.user_identities
  ADD COLUMN IF NOT EXISTS selfie_storage_path TEXT;

-- Do not approve a Talent unless the identity submission includes durable evidence.
-- Keep account sanctions intact: only pending_verification may transition to active.
CREATE OR REPLACE FUNCTION public.admin_review_talent(
  p_talent_id UUID,
  p_is_approved BOOLEAN,
  p_ktp_status public.ktp_status_type,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role public.user_role_type;
  v_ktp public.ktp_status_type;
  v_ktp_path TEXT;
  v_selfie_path TEXT;
  v_nik TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya Admin YUKU yang berhak meninjau Talent.';
  END IF;

  SELECT u.role INTO v_role
  FROM public.users u
  WHERE u.id = p_talent_id
  FOR UPDATE;
  IF NOT FOUND OR v_role <> 'talent'::public.user_role_type THEN
    RAISE EXCEPTION 'Talent tidak ditemukan.';
  END IF;

  SELECT ui.ktp_verification_status, ui.ktp_storage_path,
         ui.selfie_storage_path, ui.ktp_number
    INTO v_ktp, v_ktp_path, v_selfie_path, v_nik
  FROM public.user_identities ui
  WHERE ui.id = p_talent_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data identitas Talent belum ada.';
  END IF;

  IF p_is_approved THEN
    IF p_ktp_status IS DISTINCT FROM 'verified'::public.ktp_status_type THEN
      RAISE EXCEPTION 'Persetujuan Talent mensyaratkan keputusan KTP verified.';
    END IF;
    IF NULLIF(trim(v_nik), '') IS NULL OR v_nik !~ '^[0-9]{16}$'
       OR NULLIF(trim(v_ktp_path), '') IS NULL
       OR NULLIF(trim(v_selfie_path), '') IS NULL THEN
      RAISE EXCEPTION 'Persetujuan ditolak: NIK 16 digit, foto e-KTP, dan selfie dengan KTP wajib tersedia.';
    END IF;

    IF v_ktp = 'pending_review'::public.ktp_status_type THEN
      PERFORM public.admin_review_ktp(p_talent_id, 'verified'::public.ktp_status_type, NULL);
    ELSIF v_ktp <> 'verified'::public.ktp_status_type THEN
      RAISE EXCEPTION 'Status KTP saat ini (%) tidak dapat disetujui.', v_ktp;
    END IF;

    UPDATE public.users
       SET account_status = 'active'::public.account_status_type
     WHERE id = p_talent_id
       AND account_status = 'pending_verification'::public.account_status_type;

    UPDATE public.talent_profiles
       SET is_approved = TRUE
     WHERE id = p_talent_id;
  ELSE
    IF v_ktp = 'pending_review'::public.ktp_status_type THEN
      PERFORM public.admin_review_ktp(p_talent_id, 'rejected'::public.ktp_status_type, p_notes);
    ELSIF v_ktp <> 'rejected'::public.ktp_status_type THEN
      RAISE EXCEPTION 'Talent dengan status KTP "%" tidak dapat ditolak lewat fungsi ini.', v_ktp;
    END IF;

    UPDATE public.talent_profiles
       SET is_approved = FALSE
     WHERE id = p_talent_id;
    -- account_status is intentionally not overwritten here: suspended/banned
    -- accounts must never be silently reactivated or have sanctions erased.
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_talent(UUID, BOOLEAN, public.ktp_status_type, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_talent(UUID, BOOLEAN, public.ktp_status_type, TEXT)
  TO authenticated;
