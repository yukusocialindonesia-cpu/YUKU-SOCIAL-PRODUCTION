-- Scope Admin operational notifications to the permission that owns each queue.
-- Also authorize booking-chat Presence/Broadcast only for active booking participants.

CREATE OR REPLACE FUNCTION public.notify_all_admins(
  p_title VARCHAR(150),
  p_message TEXT,
  p_type public.notification_type,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_permission_key TEXT;
BEGIN
  -- Fail closed: unknown notification types must never fan out to every Admin.
  v_permission_key := CASE p_title
    WHEN 'Uang Masuk: Bukti QRIS Menunggu Verifikasi' THEN 'finance'
    WHEN 'Uang Masuk: Pembayaran Xendit Diterima' THEN 'finance'
    WHEN 'Permintaan Pencairan Dana Baru' THEN 'finance'
    WHEN 'Permintaan Refund Baru' THEN 'finance'
    WHEN 'e-KTP Baru Menunggu Verifikasi' THEN 'talent'
    WHEN 'Pengajuan Layanan Talent Baru' THEN 'talent'
    WHEN 'Laporan Insiden Baru' THEN 'support'
    ELSE NULL
  END;

  IF v_permission_key IS NULL THEN
    RAISE EXCEPTION 'No Admin permission mapping for notification title: %', p_title;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, metadata)
  SELECT u.id, p_title, p_message, p_type, p_metadata
  FROM public.users u
  WHERE u.role = 'admin'::public.user_role_type
    AND private.is_active_admin(u.id)
    AND (
      private.is_super_admin(u.id)
      OR EXISTS (
        SELECT 1
        FROM private.admin_permissions ap
        WHERE ap.admin_user_id = u.id
          AND ap.permission_key = v_permission_key
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.notify_all_admins(VARCHAR, TEXT, public.notification_type, JSONB)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.notify_all_admins(VARCHAR, TEXT, public.notification_type, JSONB) IS
  'Creates operational notifications only for active Admins with the mapped module permission or Super Admin. Unknown notification titles fail closed.';

-- Private booking chat Presence/Broadcast authorization.
-- The booking UUID in the topic is only a lookup key, never an authorization secret.
DROP POLICY IF EXISTS booking_chat_private_channel_select ON realtime.messages;
CREATE POLICY booking_chat_private_channel_select
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND realtime.topic() ~ '^booking-chat:[0-9a-fA-F-]{36}$'
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.users u ON u.id = auth.uid()
    WHERE realtime.topic() = 'booking-chat:' || b.id::text
      AND (b.customer_id = auth.uid() OR b.talent_id = auth.uid())
      AND u.account_status::text = 'active'
      AND b.status::text IN (
        'paid_held_in_escrow',
        'confirmed_by_talent',
        'in_progress',
        'completed',
        'disputed_hold'
      )
  )
);

DROP POLICY IF EXISTS booking_chat_private_channel_insert ON realtime.messages;
CREATE POLICY booking_chat_private_channel_insert
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND realtime.topic() ~ '^booking-chat:[0-9a-fA-F-]{36}$'
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.users u ON u.id = auth.uid()
    WHERE realtime.topic() = 'booking-chat:' || b.id::text
      AND (b.customer_id = auth.uid() OR b.talent_id = auth.uid())
      AND u.account_status::text = 'active'
      AND (
        (
          realtime.messages.extension = 'presence'
          AND b.status::text IN (
            'paid_held_in_escrow',
            'confirmed_by_talent',
            'in_progress',
            'completed',
            'disputed_hold'
          )
        )
        OR
        (
          realtime.messages.extension = 'broadcast'
          AND b.status::text IN (
            'paid_held_in_escrow',
            'confirmed_by_talent',
            'in_progress'
          )
        )
      )
  )
);

COMMENT ON POLICY booking_chat_private_channel_select ON realtime.messages IS
  'Only active Customer/Talent participants can receive Presence/Broadcast on their visible booking chat topic.';
COMMENT ON POLICY booking_chat_private_channel_insert ON realtime.messages IS
  'Only active Customer/Talent participants can publish Presence on visible chats and Broadcast while chat is writable.';
