-- YUKU MIGRATION 40: SOCIAL EXPERIENCE EXACT SERVICE ID FOUNDATION
-- Additive compatibility layer. Keep legacy category-based booking contract intact.
-- Apply only in staging after migrations 01-39 have been replayed and validated.

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

-- Link legacy bookings only when the existing provider/category pair resolves
-- to the single legacy offer. The unique constraint is intentionally retained.
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

-- New exact-offer RPC. The legacy create_booking RPC remains available for
-- existing clients and keeps its original signature. The provider/category
-- uniqueness constraint remains in place until all clients use this contract.
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

  -- Carry the exact offer identity into the legacy insert trigger for this transaction.
  -- The GUC is transaction-local and the trigger verifies the ID belongs to this Talent/category.
  PERFORM pg_catalog.set_config('yuku.booking_service_id', p_service_id::TEXT, TRUE);

  -- Reuse the established eligibility, KTP, schedule, feature-flag, pricing,
  -- overlap and pending-payment checks.
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
'Creates a booking from an exact approved Social Experience offer ID while delegating existing customer eligibility, schedule, payment gate and financial checks to the legacy booking RPC.';


-- Multi-profile booking compatibility.
-- Primary users.role is not the source of Customer/Talent capability. Require a
-- real customer profile for the booking FK and an approved/public Talent profile.
CREATE OR REPLACE FUNCTION public.create_booking(p_talent_id uuid, p_activity_category_id text, p_booking_mode public.booking_mode_type, p_start_time timestamp with time zone, p_duration_hours numeric, p_meeting_location_name text, p_meeting_location_address text DEFAULT NULL::text)
 RETURNS SETOF public.bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_customer_id UUID := auth.uid();
  v_customer public.users%ROWTYPE;
  v_talent public.users%ROWTYPE;
  v_profile public.talent_profiles%ROWTYPE;
  v_rate BIGINT;
  v_gross BIGINT;
  v_platform_fee BIGINT;
  v_talent_share BIGINT;
  v_start_local TIMESTAMP;
  v_end_local TIMESTAMP;
  v_has_any_schedule BOOLEAN;
  v_has_specific_schedule BOOLEAN;
  v_checkout_enabled BOOLEAN := FALSE;
  v_category_online BOOLEAN;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT enabled INTO v_checkout_enabled
  FROM public.system_feature_flags
  WHERE flag_key = 'payment_checkout';

  IF COALESCE(v_checkout_enabled, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'Payment gateway YUKU belum aktif. Booking berbayar sementara ditutup.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.customer_id = v_customer_id
      AND b.status = 'pending_payment'::public.booking_status_type
      AND b.payment_expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'Anda masih memiliki booking yang menunggu pembayaran. Selesaikan atau tunggu kedaluwarsa sebelum membuat booking baru.';
  END IF;

  IF p_talent_id IS NULL OR p_talent_id = v_customer_id THEN
    RAISE EXCEPTION 'Self booking is not allowed';
  END IF;

  IF p_activity_category_id IS NULL OR trim(p_activity_category_id) = '' THEN
    RAISE EXCEPTION 'Activity category is required';
  END IF;

  IF p_booking_mode IS NULL OR p_start_time IS NULL OR p_duration_hours IS NULL
     OR p_duration_hours <= 0 OR p_duration_hours > 5 THEN
    RAISE EXCEPTION 'Invalid booking schedule or duration';
  END IF;

  IF p_start_time < NOW() + INTERVAL '2 hours' THEN
    RAISE EXCEPTION 'Booking start time must be at least two hours in the future';
  END IF;

  -- Online bookings have no physical meeting place; default the label to 'Online'.
  IF p_booking_mode = 'online'::public.booking_mode_type THEN
    p_meeting_location_name := COALESCE(NULLIF(trim(COALESCE(p_meeting_location_name, '')), ''), 'Online');
  END IF;

  IF NULLIF(trim(COALESCE(p_meeting_location_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Meeting location is required';
  END IF;

  SELECT * INTO v_customer
  FROM public.users
  WHERE id = v_customer_id
  FOR SHARE;

  IF NOT FOUND
     OR v_customer.account_status <> 'active'::public.account_status_type
     OR v_customer.is_verified_18 IS NOT TRUE
     OR NOT EXISTS (
       SELECT 1 FROM public.customer_profiles cp
       WHERE cp.id = v_customer_id
     ) THEN
    RAISE EXCEPTION 'Customer account is not eligible';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_identities ui
    WHERE ui.id = v_customer_id
      AND ui.ktp_verification_status = 'verified'::public.ktp_status_type
  ) THEN
    RAISE EXCEPTION 'Customer KTP verification required';
  END IF;

  SELECT * INTO v_talent
  FROM public.users
  WHERE id = p_talent_id
  FOR SHARE;

  IF NOT FOUND
     OR v_talent.account_status <> 'active'::public.account_status_type
     OR v_talent.is_verified_18 IS NOT TRUE THEN
    RAISE EXCEPTION 'Talent is not available';
  END IF;

  SELECT * INTO v_profile
  FROM public.talent_profiles
  WHERE id = p_talent_id
    AND is_approved IS TRUE;

  IF NOT FOUND OR NOT public.is_talent_publicly_visible(p_talent_id) THEN
    RAISE EXCEPTION 'Talent is not available';
  END IF;

  -- Category must be active, and the talent must offer it as an approved, active service.
  SELECT ac.is_online_available INTO v_category_online
  FROM public.activity_categories ac
  WHERE ac.id = p_activity_category_id AND ac.is_active IS TRUE;

  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.talent_services ts
    WHERE ts.talent_id = p_talent_id
      AND ts.activity_category_id = p_activity_category_id
      AND ts.approval_status = 'approved'
      AND ts.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Talent does not offer this category';
  END IF;

  -- Booking mode follows the category: online category = online, all others = offline.
  IF (p_booking_mode = 'online'::public.booking_mode_type) <> COALESCE(v_category_online, FALSE) THEN
    RAISE EXCEPTION 'Booking mode does not match this category';
  END IF;

  IF p_booking_mode = 'online'::public.booking_mode_type
     AND v_profile.online_chat_rate IS NULL THEN
    RAISE EXCEPTION 'Talent does not offer online sessions';
  END IF;

  IF (p_booking_mode = 'online'::public.booking_mode_type
      AND v_profile.service_mode = 'Offline Only'::public.service_mode_type)
     OR (p_booking_mode = 'offline'::public.booking_mode_type
      AND v_profile.service_mode = 'Online Only'::public.service_mode_type) THEN
    RAISE EXCEPTION 'Talent does not offer this booking mode';
  END IF;

  SELECT COALESCE(
    ts.custom_rate_override,
    CASE
      WHEN p_booking_mode = 'online'::public.booking_mode_type THEN v_profile.online_chat_rate
      ELSE v_profile.hourly_rate
    END
  )
  INTO v_rate
  FROM public.talent_services ts
  WHERE ts.talent_id = p_talent_id
    AND ts.activity_category_id = p_activity_category_id
    AND ts.approval_status = 'approved'
    AND ts.is_active IS TRUE;

  IF v_rate IS NULL OR v_rate <= 0 THEN
    RAISE EXCEPTION 'Talent rate is not configured for this service';
  END IF;

  -- Availability rows are interpreted in Indonesia Western Time (Asia/Jakarta).
  -- If a Talent has no schedule configured, retain the current open-booking behavior.
  v_start_local := p_start_time AT TIME ZONE 'Asia/Jakarta';
  v_end_local := (p_start_time + make_interval(secs => (p_duration_hours * 3600)::DOUBLE PRECISION)) AT TIME ZONE 'Asia/Jakarta';

  SELECT EXISTS (
    SELECT 1 FROM public.talent_availability ta WHERE ta.talent_id = p_talent_id
  ) INTO v_has_any_schedule;

  IF v_has_any_schedule THEN
    IF v_start_local::DATE <> v_end_local::DATE THEN
      RAISE EXCEPTION 'Booking tidak dapat melewati tengah malam karena jadwal Talent menggunakan slot harian.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.talent_availability ta
      WHERE ta.talent_id = p_talent_id
        AND ta.specific_date = v_start_local::DATE
    ) INTO v_has_specific_schedule;

    IF v_has_specific_schedule THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.talent_availability ta
        WHERE ta.talent_id = p_talent_id
          AND ta.specific_date = v_start_local::DATE
          AND ta.is_available IS TRUE
          AND ta.start_time <= v_start_local::TIME
          AND ta.end_time >= v_end_local::TIME
      ) THEN
        RAISE EXCEPTION 'Talent is not available';
      END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.talent_availability ta
        WHERE ta.talent_id = p_talent_id
          AND ta.specific_date IS NULL
          AND ta.day_of_week = EXTRACT(DOW FROM v_start_local)::INT
          AND ta.is_available IS TRUE
          AND ta.start_time <= v_start_local::TIME
          AND ta.end_time >= v_end_local::TIME
      ) THEN
        RAISE EXCEPTION 'Talent is not available';
      END IF;
    END IF;
  END IF;

  v_gross := ROUND(v_rate::NUMERIC * p_duration_hours)::BIGINT;
  IF v_gross <= 0 THEN
    RAISE EXCEPTION 'Booking amount must be greater than zero';
  END IF;
  v_platform_fee := ROUND(v_gross::NUMERIC * 0.20)::BIGINT;
  v_talent_share := v_gross - v_platform_fee;

  RETURN QUERY
  INSERT INTO public.bookings (
    booking_code,
    customer_id,
    talent_id,
    activity_category_id,
    booking_mode,
    start_time,
    end_time,
    duration_hours,
    meeting_location_name,
    meeting_location_address,
    hourly_rate_snapshot,
    gross_amount,
    platform_fee_amount,
    talent_gross_share,
    status
  ) VALUES (
    'YKB-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 12)),
    v_customer_id,
    p_talent_id,
    p_activity_category_id,
    p_booking_mode,
    p_start_time,
    p_start_time + make_interval(secs => (p_duration_hours * 3600)::DOUBLE PRECISION),
    p_duration_hours,
    trim(p_meeting_location_name),
    NULLIF(trim(COALESCE(p_meeting_location_address, '')), ''),
    v_rate,
    v_gross,
    v_platform_fee,
    v_talent_share,
    'pending_payment'::public.booking_status_type
  )
  RETURNING *;
END;
$function$
;
