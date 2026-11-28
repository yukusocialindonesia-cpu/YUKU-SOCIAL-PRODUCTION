-- YUKU Affiliate earnings and shared payout integration.
-- Keep affiliate earnings separate from booking earnings to preserve booking ledger uniqueness.
CREATE TABLE IF NOT EXISTS public.talent_affiliate_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES public.users(id),
  referral_reward_id UUID NOT NULL UNIQUE REFERENCES public.referral_rewards(id),
  reward_amount BIGINT NOT NULL CHECK (reward_amount > 0),
  allocated_payout_amount BIGINT NOT NULL DEFAULT 0 CHECK (allocated_payout_amount >= 0),
  paid_out_amount BIGINT NOT NULL DEFAULT 0 CHECK (paid_out_amount >= 0),
  status public.talent_earning_status_type NOT NULL DEFAULT 'available_for_payout',
  status_before_dispute public.talent_earning_status_type,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT talent_affiliate_earnings_balance_check
    CHECK (allocated_payout_amount + paid_out_amount <= reward_amount)
);

COMMENT ON TABLE public.talent_affiliate_earnings IS
'Ledger terpisah untuk bonus Affiliate Talent. Tidak mengubah ledger pendapatan booking.';
ALTER TABLE public.talent_affiliate_earnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS talent_affiliate_earnings_select_talent_or_admin ON public.talent_affiliate_earnings;
CREATE POLICY talent_affiliate_earnings_select_talent_or_admin
  ON public.talent_affiliate_earnings
  FOR SELECT TO authenticated
  USING (talent_id = (SELECT auth.uid()) OR public.is_admin());
GRANT SELECT ON public.talent_affiliate_earnings TO authenticated;
GRANT ALL ON public.talent_affiliate_earnings TO service_role;

-- Backfill any rewards already credited before this migration.
INSERT INTO public.talent_affiliate_earnings (talent_id, referral_reward_id, reward_amount, available_at)
SELECT rr.referrer_id, rr.id, rr.reward_amount, COALESCE(rr.credited_at, rr.created_at)
FROM public.referral_rewards rr
WHERE rr.status = 'credited'::public.referral_reward_status_type
  AND rr.reward_amount > 0
ON CONFLICT (referral_reward_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_referral_reward_to_affiliate_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ledger public.talent_affiliate_earnings%ROWTYPE;
BEGIN
  IF NEW.status = 'credited'::public.referral_reward_status_type THEN
    INSERT INTO public.talent_affiliate_earnings (
      talent_id, referral_reward_id, reward_amount, available_at
    ) VALUES (
      NEW.referrer_id, NEW.id, NEW.reward_amount, COALESCE(NEW.credited_at, NOW())
    )
    ON CONFLICT (referral_reward_id) DO NOTHING;

    UPDATE public.talent_affiliate_earnings
    SET status = COALESCE(status_before_dispute, 'available_for_payout'::public.talent_earning_status_type),
        status_before_dispute = NULL,
        available_at = COALESCE(available_at, NEW.credited_at, NOW())
    WHERE referral_reward_id = NEW.id
      AND status = 'disputed_hold'::public.talent_earning_status_type
      AND status_before_dispute IS NOT NULL;

  ELSIF NEW.status = 'pending_completion'::public.referral_reward_status_type
        AND OLD.status = 'credited'::public.referral_reward_status_type THEN
    UPDATE public.talent_affiliate_earnings
    SET status_before_dispute = COALESCE(status_before_dispute, status),
        status = 'disputed_hold'::public.talent_earning_status_type
    WHERE referral_reward_id = NEW.id
      AND status <> 'refund_adjusted'::public.talent_earning_status_type;

  ELSIF NEW.status = 'cancelled_disputed'::public.referral_reward_status_type THEN
    SELECT * INTO v_ledger
    FROM public.talent_affiliate_earnings
    WHERE referral_reward_id = NEW.id
    FOR UPDATE;

    IF FOUND THEN
      IF v_ledger.allocated_payout_amount > 0 OR v_ledger.paid_out_amount > 0 THEN
        RAISE EXCEPTION 'Bonus Affiliate sudah dialokasikan atau dibayarkan. Pembatalan/refund perlu pemeriksaan Finance.';
      END IF;

      UPDATE public.talent_affiliate_earnings
      SET status = 'refund_adjusted'::public.talent_earning_status_type,
          status_before_dispute = NULL
      WHERE id = v_ledger.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_referral_reward_to_affiliate_ledger ON public.referral_rewards;
CREATE TRIGGER trg_sync_referral_reward_to_affiliate_ledger
AFTER UPDATE OF status ON public.referral_rewards
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_referral_reward_to_affiliate_ledger();

REVOKE ALL ON FUNCTION public.sync_referral_reward_to_affiliate_ledger() FROM PUBLIC, anon, authenticated;

-- A payout allocation may now reference exactly one earning source.
ALTER TABLE public.payout_earnings_allocations
  ALTER COLUMN talent_earning_id DROP NOT NULL;
ALTER TABLE public.payout_earnings_allocations
  ADD COLUMN IF NOT EXISTS affiliate_earning_id UUID
  REFERENCES public.talent_affiliate_earnings(id);
ALTER TABLE public.payout_earnings_allocations
  ADD CONSTRAINT payout_earnings_allocations_exactly_one_source
  CHECK ((talent_earning_id IS NOT NULL) <> (affiliate_earning_id IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS uq_payout_affiliate_earning_alloc
  ON public.payout_earnings_allocations (payout_request_id, affiliate_earning_id)
  WHERE affiliate_earning_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_payout_request_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_available_balance BIGINT;
BEGIN
  NEW.payout_status := 'requested'::public.payout_status_type;
  NEW.processed_by_admin_id := NULL;
  NEW.payout_provider_ref := NULL;
  NEW.provider_confirmed_at := NULL;

  IF NEW.amount < 100000 THEN
    RAISE EXCEPTION 'Batas minimal pencairan saldo adalah Rp100.000.';
  END IF;

  PERFORM 1 FROM public.talent_profiles WHERE id = NEW.talent_id FOR UPDATE;
  PERFORM 1
  FROM public.talent_earnings
  WHERE talent_id = NEW.talent_id
    AND status IN ('available_for_payout'::public.talent_earning_status_type, 'partially_paid_out'::public.talent_earning_status_type)
    AND (net_earning - allocated_payout_amount - paid_out_amount) > 0
  FOR UPDATE;
  PERFORM 1
  FROM public.talent_affiliate_earnings
  WHERE talent_id = NEW.talent_id
    AND status IN ('available_for_payout'::public.talent_earning_status_type, 'partially_paid_out'::public.talent_earning_status_type)
    AND (reward_amount - allocated_payout_amount - paid_out_amount) > 0
  FOR UPDATE;

  SELECT COALESCE(SUM(remaining_amount), 0)::BIGINT
  INTO v_available_balance
  FROM (
    SELECT net_earning - allocated_payout_amount - paid_out_amount AS remaining_amount
    FROM public.talent_earnings
    WHERE talent_id = NEW.talent_id
      AND status IN ('available_for_payout'::public.talent_earning_status_type, 'partially_paid_out'::public.talent_earning_status_type)
      AND (net_earning - allocated_payout_amount - paid_out_amount) > 0
    UNION ALL
    SELECT reward_amount - allocated_payout_amount - paid_out_amount AS remaining_amount
    FROM public.talent_affiliate_earnings
    WHERE talent_id = NEW.talent_id
      AND status IN ('available_for_payout'::public.talent_earning_status_type, 'partially_paid_out'::public.talent_earning_status_type)
      AND (reward_amount - allocated_payout_amount - paid_out_amount) > 0
  ) balances;

  IF NEW.amount > v_available_balance THEN
    RAISE EXCEPTION 'Saldo tidak mencukupi untuk pencairan. Saldo tersedia: Rp%. Pencairan diminta: Rp%', v_available_balance, NEW.amount;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.allocate_payout_earnings_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_remaining_to_allocate BIGINT := NEW.amount;
  v_earning RECORD;
  v_unreserved_in_row BIGINT;
  v_alloc_amount BIGINT;
BEGIN
  -- Preserve the established booking-ledger allocation order.
  FOR v_earning IN
    SELECT id, net_earning, allocated_payout_amount, paid_out_amount
    FROM public.talent_earnings
    WHERE talent_id = NEW.talent_id
      AND status IN ('available_for_payout'::public.talent_earning_status_type, 'partially_paid_out'::public.talent_earning_status_type)
      AND (net_earning - allocated_payout_amount - paid_out_amount) > 0
    ORDER BY available_at ASC NULLS LAST, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining_to_allocate <= 0;
    v_unreserved_in_row := v_earning.net_earning - v_earning.allocated_payout_amount - v_earning.paid_out_amount;
    v_alloc_amount := LEAST(v_remaining_to_allocate, v_unreserved_in_row);

    INSERT INTO public.payout_earnings_allocations (
      payout_request_id, talent_earning_id, affiliate_earning_id, allocated_amount, status
    ) VALUES (
      NEW.id, v_earning.id, NULL, v_alloc_amount, 'reserved'::public.payout_allocation_status_type
    );

    UPDATE public.talent_earnings
    SET allocated_payout_amount = allocated_payout_amount + v_alloc_amount
    WHERE id = v_earning.id;
    v_remaining_to_allocate := v_remaining_to_allocate - v_alloc_amount;
  END LOOP;

  FOR v_earning IN
    SELECT id, reward_amount, allocated_payout_amount, paid_out_amount
    FROM public.talent_affiliate_earnings
    WHERE talent_id = NEW.talent_id
      AND status IN ('available_for_payout'::public.talent_earning_status_type, 'partially_paid_out'::public.talent_earning_status_type)
      AND (reward_amount - allocated_payout_amount - paid_out_amount) > 0
    ORDER BY available_at ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining_to_allocate <= 0;
    v_unreserved_in_row := v_earning.reward_amount - v_earning.allocated_payout_amount - v_earning.paid_out_amount;
    v_alloc_amount := LEAST(v_remaining_to_allocate, v_unreserved_in_row);

    INSERT INTO public.payout_earnings_allocations (
      payout_request_id, talent_earning_id, affiliate_earning_id, allocated_amount, status
    ) VALUES (
      NEW.id, NULL, v_earning.id, v_alloc_amount, 'reserved'::public.payout_allocation_status_type
    );

    UPDATE public.talent_affiliate_earnings
    SET allocated_payout_amount = allocated_payout_amount + v_alloc_amount
    WHERE id = v_earning.id;
    v_remaining_to_allocate := v_remaining_to_allocate - v_alloc_amount;
  END LOOP;

  IF v_remaining_to_allocate > 0 THEN
    RAISE EXCEPTION 'Gagal mengalokasikan saldo payout secara penuh. Sisa alokasi yang belum tercover: Rp%', v_remaining_to_allocate;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_payout_completion_during_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.payout_status = 'completed_provider_confirmed'::public.payout_status_type
     AND OLD.payout_status IS DISTINCT FROM NEW.payout_status
     AND (
       EXISTS (
         SELECT 1
         FROM public.payout_earnings_allocations pea
         JOIN public.talent_earnings te ON te.id = pea.talent_earning_id
         WHERE pea.payout_request_id = NEW.id
           AND pea.status = 'reserved'::public.payout_allocation_status_type
           AND te.status = 'disputed_hold'::public.talent_earning_status_type
       )
       OR EXISTS (
         SELECT 1
         FROM public.payout_earnings_allocations pea
         JOIN public.talent_affiliate_earnings tae ON tae.id = pea.affiliate_earning_id
         WHERE pea.payout_request_id = NEW.id
           AND pea.status = 'reserved'::public.payout_allocation_status_type
           AND tae.status = 'disputed_hold'::public.talent_earning_status_type
       )
     ) THEN
    RAISE EXCEPTION 'Pencairan ditahan karena terdapat penghasilan yang sedang dalam sengketa.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_payout_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_alloc_rec RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    IF NEW.payout_status IS DISTINCT FROM OLD.payout_status OR
       NEW.payout_provider_ref IS DISTINCT FROM OLD.payout_provider_ref OR
       NEW.processed_by_admin_id IS DISTINCT FROM OLD.processed_by_admin_id THEN
      RAISE EXCEPTION 'Akses Ditolak: Status pencairan hanya dapat diproses oleh Admin / Provider Callback.';
    END IF;
  END IF;

  IF NEW.payout_status IS DISTINCT FROM OLD.payout_status THEN
    IF NEW.payout_status IN ('rejected'::public.payout_status_type, 'failed'::public.payout_status_type) THEN
      FOR v_alloc_rec IN
        SELECT id, talent_earning_id, affiliate_earning_id, allocated_amount
        FROM public.payout_earnings_allocations
        WHERE payout_request_id = NEW.id AND status = 'reserved'::public.payout_allocation_status_type
        FOR UPDATE
      LOOP
        IF v_alloc_rec.talent_earning_id IS NOT NULL THEN
          UPDATE public.talent_earnings
          SET allocated_payout_amount = GREATEST(0, allocated_payout_amount - v_alloc_rec.allocated_amount)
          WHERE id = v_alloc_rec.talent_earning_id;
        ELSE
          UPDATE public.talent_affiliate_earnings
          SET allocated_payout_amount = GREATEST(0, allocated_payout_amount - v_alloc_rec.allocated_amount)
          WHERE id = v_alloc_rec.affiliate_earning_id;
        END IF;

        UPDATE public.payout_earnings_allocations
        SET status = 'released_unreserved'::public.payout_allocation_status_type
        WHERE id = v_alloc_rec.id;
      END LOOP;

    ELSIF NEW.payout_status = 'completed_provider_confirmed'::public.payout_status_type THEN
      FOR v_alloc_rec IN
        SELECT id, talent_earning_id, affiliate_earning_id, allocated_amount
        FROM public.payout_earnings_allocations
        WHERE payout_request_id = NEW.id AND status = 'reserved'::public.payout_allocation_status_type
        FOR UPDATE
      LOOP
        IF v_alloc_rec.talent_earning_id IS NOT NULL THEN
          UPDATE public.talent_earnings
          SET allocated_payout_amount = GREATEST(0, allocated_payout_amount - v_alloc_rec.allocated_amount),
              paid_out_amount = paid_out_amount + v_alloc_rec.allocated_amount,
              status = CASE
                WHEN paid_out_amount + v_alloc_rec.allocated_amount >= net_earning
                  THEN 'fully_paid_out'::public.talent_earning_status_type
                ELSE 'partially_paid_out'::public.talent_earning_status_type
              END
          WHERE id = v_alloc_rec.talent_earning_id;
        ELSE
          UPDATE public.talent_affiliate_earnings
          SET allocated_payout_amount = GREATEST(0, allocated_payout_amount - v_alloc_rec.allocated_amount),
              paid_out_amount = paid_out_amount + v_alloc_rec.allocated_amount,
              status = CASE
                WHEN paid_out_amount + v_alloc_rec.allocated_amount >= reward_amount
                  THEN 'fully_paid_out'::public.talent_earning_status_type
                ELSE 'partially_paid_out'::public.talent_earning_status_type
              END
          WHERE id = v_alloc_rec.affiliate_earning_id;
        END IF;

        UPDATE public.payout_earnings_allocations
        SET status = 'settled'::public.payout_allocation_status_type
        WHERE id = v_alloc_rec.id;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_referral_reward_to_affiliate_ledger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_payout_request_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.allocate_payout_earnings_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_payout_completion_during_dispute() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_payout_status_update() FROM PUBLIC, anon, authenticated;

