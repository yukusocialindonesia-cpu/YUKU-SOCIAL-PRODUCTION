-- Additive enum extension, isolated so PostgreSQL commits the value before later migrations use it.
ALTER TYPE public.payment_provider_type ADD VALUE IF NOT EXISTS 'manual_bank_transfer';
