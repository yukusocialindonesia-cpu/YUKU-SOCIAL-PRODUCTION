-- Replay foundation for the legacy talent-service audit table.
-- Timestamped feature migrations run before legacy numbered migration 40 in a
-- clean Supabase replay, so create the relation before custom-service RPCs use it.
CREATE TABLE IF NOT EXISTS public.talent_service_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_service_id UUID NOT NULL REFERENCES public.talent_services(id) ON DELETE CASCADE,
  talent_id UUID NOT NULL REFERENCES public.talent_profiles(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  change_type TEXT NOT NULL CHECK (change_type IN (
    'activated','deactivated','price_changed','approved','rejected','disabled_by_admin','submitted'
  )),
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
