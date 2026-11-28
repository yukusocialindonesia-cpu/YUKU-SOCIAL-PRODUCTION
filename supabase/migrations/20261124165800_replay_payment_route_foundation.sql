-- Replay-safe foundation for the payment route lock.
-- The original migration 30 uses a legacy filename and is skipped by timestamp-only replay.
-- Keep this additive and idempotent so it is also safe on environments where the column exists.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_route TEXT;

-- Preserve the historical provider route where a payment already exists.
UPDATE public.bookings b
SET payment_route = p.provider::TEXT,
    updated_at = NOW()
FROM public.payments p
WHERE p.booking_id = b.id
  AND b.payment_route IS NULL;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_route_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_route_check
  CHECK (
    payment_route IS NULL
    OR payment_route IN ('xendit', 'manual_qris', 'manual_bank_transfer')
  );

CREATE INDEX IF NOT EXISTS idx_bookings_payment_route
  ON public.bookings(payment_route);

COMMENT ON COLUMN public.bookings.payment_route IS
  'Immutable active payment route for this booking. NULL means no route has been selected yet.';
