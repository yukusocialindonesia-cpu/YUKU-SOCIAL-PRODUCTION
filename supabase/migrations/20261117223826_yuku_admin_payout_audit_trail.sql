
CREATE OR REPLACE FUNCTION public.admin_process_payout(
  p_payout_id uuid,
  p_new_status public.payout_status_type,
  p_rejection_reason text DEFAULT NULL,
  p_provider_reference text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_current_status public.payout_status_type;
  v_old_data jsonb;
  v_new_data jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Admin YUKU yang dapat memproses pencairan.';
  END IF;

  SELECT to_jsonb(pr) INTO v_old_data
  FROM public.payout_requests pr
  WHERE pr.id = p_payout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permintaan pencairan tidak ditemukan.';
  END IF;

  v_current_status := (v_old_data->>'payout_status')::public.payout_status_type;

  IF p_new_status = 'processing'::public.payout_status_type THEN
    IF v_current_status <> 'requested'::public.payout_status_type THEN
      RAISE EXCEPTION 'Hanya permintaan berstatus requested yang dapat diproses.';
    END IF;
    UPDATE public.payout_requests
    SET payout_status = 'processing'::public.payout_status_type,
        processed_by_admin_id = auth.uid()
    WHERE id = p_payout_id;

  ELSIF p_new_status = 'rejected'::public.payout_status_type THEN
    IF v_current_status NOT IN ('requested'::public.payout_status_type, 'processing'::public.payout_status_type) THEN
      RAISE EXCEPTION 'Status pencairan ini tidak dapat ditolak.';
    END IF;
    IF NULLIF(trim(COALESCE(p_rejection_reason, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Alasan penolakan wajib diisi.';
    END IF;
    UPDATE public.payout_requests
    SET payout_status = 'rejected'::public.payout_status_type,
        rejection_reason = trim(p_rejection_reason),
        processed_by_admin_id = auth.uid()
    WHERE id = p_payout_id;

  ELSIF p_new_status = 'completed_provider_confirmed'::public.payout_status_type THEN
    IF v_current_status <> 'processing'::public.payout_status_type THEN
      RAISE EXCEPTION 'Pencairan harus berstatus processing sebelum diselesaikan.';
    END IF;
    IF NULLIF(trim(COALESCE(p_provider_reference, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Nomor referensi transfer bank/provider wajib diisi sebelum menyelesaikan pencairan.';
    END IF;
    UPDATE public.payout_requests
    SET payout_status = 'completed_provider_confirmed'::public.payout_status_type,
        payout_provider_ref = trim(p_provider_reference),
        provider_confirmed_at = NOW(),
        processed_by_admin_id = auth.uid(),
        rejection_reason = NULL
    WHERE id = p_payout_id;

  ELSE
    RAISE EXCEPTION 'Transisi status pencairan tidak diizinkan.';
  END IF;

  SELECT to_jsonb(pr) INTO v_new_data
  FROM public.payout_requests pr
  WHERE pr.id = p_payout_id;

  INSERT INTO public.admin_audit_logs (
    admin_user_id, action_type, target_table, target_id, old_data, new_data
  ) VALUES (
    auth.uid(), 'admin_process_payout', 'payout_requests', p_payout_id::text,
    v_old_data, v_new_data
  );

  RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_process_payout(uuid, public.payout_status_type, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_process_payout(uuid, public.payout_status_type, text, text) TO authenticated;

