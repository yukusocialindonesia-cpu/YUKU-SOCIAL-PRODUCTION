-- Close the QRIS proof-upload gap and remove direct API execution from a trigger-only function.
-- QRIS uploads must belong to a booking already locked to the manual QRIS route.
-- A booking may have only one proof awaiting review; rejected proofs can be replaced.

DROP POLICY IF EXISTS qris_proof_upload_own_booking ON storage.objects;

CREATE POLICY qris_proof_upload_own_booking
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'qris-payment-proofs'
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND b.customer_id = (SELECT auth.uid())
        AND b.status = 'pending_payment'::public.booking_status_type
        AND b.payment_route = 'manual_qris'
        AND NOT EXISTS (
          SELECT 1
          FROM public.qris_payment_submissions s
          WHERE s.booking_id = b.id
            AND s.status = 'pending_review'
        )
    )
  );

