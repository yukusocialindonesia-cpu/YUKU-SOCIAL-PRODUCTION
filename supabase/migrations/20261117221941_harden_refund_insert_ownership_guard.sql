
DROP POLICY IF EXISTS refunds_insert_customer ON public.refunds;

CREATE POLICY refunds_insert_customer
ON public.refunds
FOR INSERT
TO public
WITH CHECK (
  (SELECT auth.uid()) = customer_id
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.payments p ON p.booking_id = b.id
    WHERE b.id = refunds.booking_id
      AND p.id = refunds.payment_id
      AND b.customer_id = (SELECT auth.uid())
      AND p.booking_id = b.id
      AND refunds.refund_amount > 0
      AND refunds.refund_amount <= p.amount
  )
);

