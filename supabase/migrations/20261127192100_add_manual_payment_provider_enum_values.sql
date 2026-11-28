-- Add manual settlement providers in a separate migration so PostgreSQL commits
-- the enum labels before later migrations use them in function signatures/defaults.
ALTER TYPE public.payment_provider_type ADD VALUE IF NOT EXISTS 'manual_qris';
ALTER TYPE public.payment_provider_type ADD VALUE IF NOT EXISTS 'manual_bank_transfer';
