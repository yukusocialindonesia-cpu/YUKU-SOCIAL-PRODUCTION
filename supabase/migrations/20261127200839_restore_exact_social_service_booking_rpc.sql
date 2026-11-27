-- YUKU PRODUCTION MIGRATION: Restore exact Social Experience booking contract.
-- Applied to Production as migration 20261127200839.
-- Additive compatibility change: preserves the existing create_booking() implementation.
-- Existing booking rows are linked only when their Talent/category pair resolves uniquely.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS service_id UUID,
  ADD COLUMN IF NOT EXISTS service_title_snapshot VARCHAR(80),
  ADD COLUMN IF NOT EXISTS service_description_snapshot VARCHAR(500);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_service_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_service_id_fkey
      FOREIGN KEY (service_id) REFERENCES public.talent_services(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_bookings_service_id
  ON public.bookings(service_id)
  WHERE service_id IS NOT NULL;

UPDATE public.bookings b
SET service_id = ts.id
FROM public.talent_services ts
WHERE b.service_id IS NULL
  AND ts.talent_id = b.talent_id
  AND ts.activity_category_id = b.activity_category_id;

ALTER TABLE public.bookings
  VALIDATE CONSTRAINT bookings_service_id_fkey;

CREATE OR REPLACE FUNCTION public.assign_booking_service_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_service public.talent_services%ROWTYPE;
  v_category_title TEXT;
  v_requested_service_id UUID;
BEGIN
  v_requested_service_id := NULLIF(pg_catalog.current_setting('yuku.booking_service_id', TRUE), '')::UUID;
  IF NEW.service_id IS NULL AND v_requested_service_id IS NOT NULL THEN
    NEW.service_id := v_requested_service_id;
  END IF;

  IF NEW.service_id IS NULL THEN
    SELECT ts.* INTO v_service
    FROM public.talent_services ts
    WHERE ts.talent_id = NEW.talent_id
      AND ts.activity_category_id = NEW.activity_category_id
    FOR SHARE;
  ELSE
    SELECT ts.* INTO v_service
    FROM public.talent_services ts
    WHERE ts.id = NEW.service_id
    FOR SHARE;

    IF FOUND AND (
      v_service.talent_id IS DISTINCT FROM NEW.talent_id
      OR v_service.activity_category_id IS DISTINCT FROM NEW.activity_category_id
    ) THEN
      RAISE EXCEPTION 'Selected service does not belong to this Talent/category';
    END IF;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected Social Experience service was not found';
  END IF;

  IF v_service.approval_status IS DISTINCT FROM 'approved'
     OR v_service.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Selected Social Experience service is not approved and active';
  END IF;

  NEW.service_id := v_service.id;

  IF NEW.service_title_snapshot IS NULL THEN
    SELECT ac.title INTO v_category_title
    FROM public.activity_categories ac
    WHERE ac.id = v_service.activity_category_id;

    NEW.service_title_snapshot := COALESCE(
      NULLIF(BTRIM(v_service.custom_title), ''),
      v_category_title
    );
  END IF;

  IF NEW.service_description_snapshot IS NULL THEN
    NEW.service_description_snapshot := v_service.custom_description;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_booking_service_snapshot ON public.bookings;
CREATE TRIGGER trg_assign_booking_service_snapshot
BEFORE INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.assign_booking_service_snapshot();

REVOKE ALL ON FUNCTION public.assign_booking_service_snapshot() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.prevent_booking_service_identity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.service_id IS DISTINCT FROM OLD.service_id
     OR NEW.service_title_snapshot IS DISTINCT FROM OLD.service_title_snapshot
     OR NEW.service_description_snapshot IS DISTINCT FROM OLD.service_description_snapshot THEN
    RAISE EXCEPTION 'Booking service identity snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_booking_service_identity_change ON public.bookings;
CREATE TRIGGER trg_prevent_booking_service_identity_change
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.prevent_booking_service_identity_change();

REVOKE ALL ON FUNCTION public.prevent_booking_service_identity_change() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_booking_for_service(
  p_service_id UUID,
  p_booking_mode public.booking_mode_type,
  p_start_time TIMESTAMPTZ,
  p_duration_hours NUMERIC,
  p_meeting_location_name TEXT,
  p_meeting_location_address TEXT DEFAULT NULL
)
RETURNS SETOF public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_service public.talent_services%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_service_id IS NULL THEN
    RAISE EXCEPTION 'A specific Social Experience service is required';
  END IF;

  SELECT ts.* INTO v_service
  FROM public.talent_services ts
  WHERE ts.id = p_service_id
  FOR SHARE;

  IF NOT FOUND
     OR v_service.approval_status IS DISTINCT FROM 'approved'
     OR v_service.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Selected Social Experience service is not available';
  END IF;

  PERFORM pg_catalog.set_config('yuku.booking_service_id', p_service_id::TEXT, TRUE);

  RETURN QUERY
  SELECT *
  FROM public.create_booking(
    v_service.talent_id,
    v_service.activity_category_id,
    p_booking_mode,
    p_start_time,
    p_duration_hours,
    p_meeting_location_name,
    p_meeting_location_address
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_for_service(
  UUID, public.booking_mode_type, TIMESTAMPTZ, NUMERIC, TEXT, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking_for_service(
  UUID, public.booking_mode_type, TIMESTAMPTZ, NUMERIC, TEXT, TEXT
) TO authenticated;

COMMENT ON COLUMN public.bookings.service_id IS
  'Nullable stable Social Experience offer ID. NULL remains valid for historical bookings that cannot be mapped.';
COMMENT ON COLUMN public.bookings.service_title_snapshot IS
  'Immutable display title captured when a new Social Experience booking is created.';
COMMENT ON COLUMN public.bookings.service_description_snapshot IS
  'Immutable service description captured when a new Social Experience booking is created.';
COMMENT ON FUNCTION public.create_booking_for_service(
  UUID, public.booking_mode_type, TIMESTAMPTZ, NUMERIC, TEXT, TEXT
) IS
'Creates a booking from an exact approved Social Experience offer ID while delegating established customer eligibility, schedule, payment gate and financial checks to the legacy booking RPC.';
