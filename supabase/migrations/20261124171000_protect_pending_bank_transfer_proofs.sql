-- Prevent customers from deleting a transfer proof while Finance is reviewing it.
-- RLS policies are permissive by default, so the pending-review guard must be part
-- of the DELETE policy itself.
DROP POLICY IF EXISTS bank_transfer_proof_delete_own_booking ON storage.objects;

CREATE POLICY bank_transfer_proof_delete_own_booking ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'bank-transfer-payment-proofs'
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND b.customer_id = auth.uid()
        AND b.status = 'pending_payment'::public.booking_status_type
        AND b.payment_route = 'manual_bank_transfer'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.bank_transfer_submissions s
      WHERE s.proof_storage_path = name
        AND s.status = 'pending_review'
    )
  );
