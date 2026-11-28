-- Restore the authenticated Talent payout RPC in clean database replays.
-- Production already has this function; its original definition is copied verbatim
-- so disposable replay matches the live payout eligibility and idempotency rules.
CREATE OR REPLACE FUNCTION public.request_talent_payout(
  p_amount bigint,
  p_bank_name text,
  p_bank_account_number text,
  p_bank_account_holder_name text,
  p_idempotency_key uuid DEFAULT gen_random_uuid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_existing public.payout_requests%ROWTYPE;
  v_payout_id uuid;
  v_payout_number text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.talent_profiles tp ON tp.id = u.id
    JOIN public.user_identities ui ON ui.id = u.id
    WHERE u.id = v_actor
      AND u.role = 'talent'::public.user_role_type
      AND u.account_status = 'active'::public.account_status_type
      AND u.is_verified_18 IS TRUE
      AND tp.is_approved IS TRUE
      AND ui.ktp_verification_status = 'verified'::public.ktp_status_type
  ) THEN
    RAISE EXCEPTION 'Hanya Talent aktif yang sudah lolos verifikasi dan persetujuan dapat mengajukan pencairan.';
  END IF;

  IF p_amount IS NULL OR p_amount < 100000 THEN
    RAISE EXCEPTION 'Minimal pencairan saldo adalah Rp100.000.';
  END IF;

  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Kunci idempotensi wajib tersedia.';
  END IF;

  IF char_length(trim(COALESCE(p_bank_name,''))) NOT BETWEEN 2 AND 100
     OR char_length(trim(COALESCE(p_bank_account_number,''))) NOT BETWEEN 5 AND 40
     OR char_length(trim(COALESCE(p_bank_account_holder_name,''))) NOT BETWEEN 2 AND 150 THEN
    RAISE EXCEPTION 'Data rekening bank tidak valid.';
  END IF;

  SELECT * INTO v_existing
  FROM public.payout_requests
  WHERE idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.talent_id <> v_actor
       OR v_existing.amount <> p_amount
       OR v_existing.bank_name <> trim(p_bank_name)
       OR v_existing.bank_account_number <> trim(p_bank_account_number)
       OR v_existing.bank_account_holder_name <> trim(p_bank_account_holder_name) THEN
      RAISE EXCEPTION 'Kunci idempotensi sudah digunakan untuk permintaan pencairan yang berbeda.';
    END IF;
    RETURN v_existing.id;
  END IF;

  -- Exactly 20 characters: YK + 18 random hexadecimal characters.
  v_payout_number := 'YK' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 18));

  INSERT INTO public.payout_requests(
    payout_number, talent_id, amount, bank_name,
    bank_account_number, bank_account_holder_name, idempotency_key
  )
  VALUES(
    v_payout_number, v_actor, p_amount, trim(p_bank_name),
    trim(p_bank_account_number), trim(p_bank_account_holder_name), p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_payout_id;

  IF v_payout_id IS NOT NULL THEN
    RETURN v_payout_id;
  END IF;

  SELECT * INTO v_existing
  FROM public.payout_requests
  WHERE idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF NOT FOUND
     OR v_existing.talent_id <> v_actor
     OR v_existing.amount <> p_amount
     OR v_existing.bank_name <> trim(p_bank_name)
     OR v_existing.bank_account_number <> trim(p_bank_account_number)
     OR v_existing.bank_account_holder_name <> trim(p_bank_account_holder_name) THEN
    RAISE EXCEPTION 'Konflik kunci idempotensi pada permintaan pencairan.';
  END IF;

  RETURN v_existing.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.request_talent_payout(bigint, text, text, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_talent_payout(bigint, text, text, text, uuid)
  TO authenticated;
