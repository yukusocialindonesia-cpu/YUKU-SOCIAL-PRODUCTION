-- Optimize private booking chat Realtime policies without changing access semantics.
-- Production migration: 20261127201132_optimize_private_realtime_chat_policy_initplans.
-- Wrap request-scoped identity/topic lookups in scalar subqueries so Postgres can
-- evaluate them once per statement rather than once per candidate row.

ALTER POLICY booking_chat_private_channel_select
ON realtime.messages
USING (
  extension = ANY (ARRAY['broadcast'::text, 'presence'::text])
  AND (SELECT realtime.topic()) ~ '^booking-chat:[0-9a-fA-F-]{36}$'::text
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.users u ON u.id = (SELECT auth.uid())
    WHERE (SELECT realtime.topic()) = ('booking-chat:'::text || b.id::text)
      AND (b.customer_id = (SELECT auth.uid()) OR b.talent_id = (SELECT auth.uid()))
      AND u.account_status::text = 'active'::text
      AND b.status::text = ANY (ARRAY[
        'paid_held_in_escrow'::text,
        'confirmed_by_talent'::text,
        'in_progress'::text,
        'completed'::text,
        'disputed_hold'::text
      ])
  )
);

ALTER POLICY booking_chat_private_channel_insert
ON realtime.messages
WITH CHECK (
  extension = ANY (ARRAY['broadcast'::text, 'presence'::text])
  AND (SELECT realtime.topic()) ~ '^booking-chat:[0-9a-fA-F-]{36}$'::text
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.users u ON u.id = (SELECT auth.uid())
    WHERE (SELECT realtime.topic()) = ('booking-chat:'::text || b.id::text)
      AND (b.customer_id = (SELECT auth.uid()) OR b.talent_id = (SELECT auth.uid()))
      AND u.account_status::text = 'active'::text
      AND (
        (messages.extension = 'presence'::text AND b.status::text = ANY (ARRAY[
          'paid_held_in_escrow'::text,
          'confirmed_by_talent'::text,
          'in_progress'::text,
          'completed'::text,
          'disputed_hold'::text
        ]))
        OR
        (messages.extension = 'broadcast'::text AND b.status::text = ANY (ARRAY[
          'paid_held_in_escrow'::text,
          'confirmed_by_talent'::text,
          'in_progress'::text
        ]))
      )
  )
);
