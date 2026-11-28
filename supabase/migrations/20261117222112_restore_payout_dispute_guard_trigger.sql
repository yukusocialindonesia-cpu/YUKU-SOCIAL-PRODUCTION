
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname='payout_requests'
      AND t.tgname='trg_guard_payout_completion_during_dispute'
  ) THEN
    CREATE TRIGGER trg_guard_payout_completion_during_dispute
    BEFORE UPDATE ON public.payout_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_payout_completion_during_dispute();
  END IF;
END $$;

