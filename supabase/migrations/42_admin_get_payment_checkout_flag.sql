-- YUKU MIGRATION 42: Admin dapat membaca status flag 'payment_checkout'.
-- Tabel public.system_feature_flags sengaja tidak punya policy/grant untuk klien,
-- jadi panel Admin tidak bisa membacanya langsung. Fungsi ini hanya untuk Admin dan
-- hanya membaca (tidak mengubah apa pun). Mengubah status tetap lewat
-- public.admin_set_payment_checkout_enabled(). Idempoten; aman dijalankan ulang.

CREATE OR REPLACE FUNCTION public.admin_get_payment_checkout_enabled()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Admin YUKU.';
  END IF;

  SELECT enabled INTO v_enabled
  FROM public.system_feature_flags
  WHERE flag_key = 'payment_checkout';

  RETURN COALESCE(v_enabled, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_payment_checkout_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_payment_checkout_enabled() TO authenticated;
