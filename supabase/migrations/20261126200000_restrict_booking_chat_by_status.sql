-- Restrict booking chat to paid, live bookings and protect message integrity.
-- Customer/Talent can coordinate after payment is held in escrow, before or after Talent approval.
-- Completed/disputed conversations remain readable; terminal cancelled/expired/rejected states are closed.

DROP POLICY IF EXISTS "booking_messages_select_participants" ON public.booking_messages;
CREATE POLICY "booking_messages_select_participants"
ON public.booking_messages
FOR SELECT
TO authenticated
USING (
  (SELECT public.is_admin())
  OR EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_messages.booking_id
      AND (b.customer_id = (SELECT auth.uid()) OR b.talent_id = (SELECT auth.uid()))
      AND b.status IN (
        'paid_held_in_escrow',
        'confirmed_by_talent',
        'in_progress',
        'completed',
        'disputed_hold'
      )
  )
);

DROP POLICY IF EXISTS "booking_messages_insert_participants" ON public.booking_messages;
CREATE POLICY "booking_messages_insert_participants"
ON public.booking_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_messages.booking_id
      AND (b.customer_id = (SELECT auth.uid()) OR b.talent_id = (SELECT auth.uid()))
      AND b.status IN (
        'paid_held_in_escrow',
        'confirmed_by_talent',
        'in_progress'
      )
  )
);

DROP POLICY IF EXISTS "booking_messages_update_read_recipient" ON public.booking_messages;
CREATE POLICY "booking_messages_update_read_recipient"
ON public.booking_messages
FOR UPDATE
TO authenticated
USING (
  sender_id <> (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_messages.booking_id
      AND (b.customer_id = (SELECT auth.uid()) OR b.talent_id = (SELECT auth.uid()))
      AND b.status IN (
        'paid_held_in_escrow',
        'confirmed_by_talent',
        'in_progress',
        'completed',
        'disputed_hold'
      )
  )
)
WITH CHECK (
  sender_id <> (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_messages.booking_id
      AND (b.customer_id = (SELECT auth.uid()) OR b.talent_id = (SELECT auth.uid()))
      AND b.status IN (
        'paid_held_in_escrow',
        'confirmed_by_talent',
        'in_progress',
        'completed',
        'disputed_hold'
      )
  )
);

-- Clients may submit only the business fields. Database-generated id, read state,
-- and timestamp cannot be forged by the sender.
REVOKE INSERT ON TABLE public.booking_messages FROM authenticated;
REVOKE INSERT (id, is_read, created_at)
  ON TABLE public.booking_messages FROM authenticated;
GRANT INSERT (booking_id, sender_id, message)
  ON TABLE public.booking_messages TO authenticated;

-- Message rows are immutable to participants; only the read receipt may be updated.
REVOKE UPDATE ON TABLE public.booking_messages FROM authenticated;
REVOKE UPDATE (id, booking_id, sender_id, message, created_at)
  ON TABLE public.booking_messages FROM authenticated;
GRANT UPDATE (is_read) ON TABLE public.booking_messages TO authenticated;
