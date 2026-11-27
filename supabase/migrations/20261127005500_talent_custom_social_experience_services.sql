-- Talent-defined Social Experience offerings.
-- Additive only: preserve existing category links, rows, and booking compatibility.
ALTER TABLE public.talent_services
  ADD COLUMN IF NOT EXISTS custom_title VARCHAR(80),
  ADD COLUMN IF NOT EXISTS custom_description VARCHAR(500);

ALTER TABLE public.talent_service_change_log
  DROP CONSTRAINT IF EXISTS talent_service_change_log_change_type_check;
ALTER TABLE public.talent_service_change_log
  ADD CONSTRAINT talent_service_change_log_change_type_check
  CHECK (change_type IN ('submitted','activated','deactivated','price_changed','approved','rejected','disabled_by_admin'));

ALTER TABLE public.talent_services
  ADD CONSTRAINT talent_services_custom_title_length
    CHECK (custom_title IS NULL OR char_length(trim(custom_title)) BETWEEN 3 AND 80),
  ADD CONSTRAINT talent_services_custom_description_length
    CHECK (custom_description IS NULL OR char_length(trim(custom_description)) BETWEEN 10 AND 500);

CREATE OR REPLACE FUNCTION public.request_talent_service_custom(
  p_activity_category_id VARCHAR(50),
  p_custom_title VARCHAR(80),
  p_custom_description VARCHAR(500),
  p_custom_rate_override BIGINT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_existing public.talent_services%ROWTYPE;
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'talent'::public.user_role_type
  ) THEN RAISE EXCEPTION 'Hanya akun Talent yang dapat mengajukan layanan'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.talent_profiles tp WHERE tp.id = auth.uid()) THEN
    RAISE EXCEPTION 'Profil Talent belum tersedia';
  END IF;
  IF p_activity_category_id IS NULL OR trim(p_activity_category_id) = '' THEN
    RAISE EXCEPTION 'Kategori layanan wajib dipilih';
  END IF;
  IF char_length(trim(COALESCE(p_custom_title, ''))) NOT BETWEEN 3 AND 80 THEN
    RAISE EXCEPTION 'Nama layanan harus 3–80 karakter';
  END IF;
  IF char_length(trim(COALESCE(p_custom_description, ''))) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Deskripsi layanan harus 10–500 karakter';
  END IF;
  IF p_custom_rate_override IS NOT NULL AND p_custom_rate_override < 50000 THEN
    RAISE EXCEPTION 'Tarif khusus minimal Rp50.000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.activity_categories ac
    WHERE ac.id = p_activity_category_id AND ac.is_active = TRUE
  ) THEN RAISE EXCEPTION 'Kategori layanan tidak tersedia'; END IF;

  SELECT * INTO v_existing
  FROM public.talent_services
  WHERE talent_id = auth.uid() AND activity_category_id = p_activity_category_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.approval_status <> 'rejected' THEN
      RAISE EXCEPTION 'Kategori ini sudah diajukan atau sudah aktif pada profil Anda';
    END IF;
    UPDATE public.talent_services
    SET custom_title = trim(p_custom_title),
        custom_description = trim(p_custom_description),
        custom_rate_override = p_custom_rate_override,
        approval_status = 'pending', is_active = TRUE,
        review_note = NULL, reviewed_by = NULL, reviewed_at = NULL, updated_at = NOW()
    WHERE id = v_existing.id RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.talent_services(
      talent_id, activity_category_id, custom_title, custom_description,
      custom_rate_override, approval_status, is_active
    ) VALUES (
      auth.uid(), p_activity_category_id, trim(p_custom_title), trim(p_custom_description),
      p_custom_rate_override, 'pending', TRUE
    ) RETURNING id INTO v_id;
  END IF;

  INSERT INTO public.talent_service_change_log(
    talent_service_id, talent_id, changed_by, change_type, old_value, new_value
  ) VALUES (
    v_id, auth.uid(), auth.uid(), 'submitted',
    jsonb_build_object('approval_status', COALESCE(v_existing.approval_status, 'new')),
    jsonb_build_object(
      'approval_status', 'pending',
      'activity_category_id', p_activity_category_id,
      'custom_title', trim(p_custom_title),
      'custom_description', trim(p_custom_description)
    )
  );
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_talent_service_custom(VARCHAR, VARCHAR, VARCHAR, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_talent_service_custom(VARCHAR, VARCHAR, VARCHAR, BIGINT) TO authenticated;

COMMENT ON COLUMN public.talent_services.custom_title IS
  'Talent-authored Social Experience offering title; remains under the selected YUKU activity category.';
COMMENT ON COLUMN public.talent_services.custom_description IS
  'Talent-authored Social Experience offering description; Admin approval is required before public display.';
