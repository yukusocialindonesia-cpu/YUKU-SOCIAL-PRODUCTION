-- Trigger functions are invoked by PostgreSQL triggers, not by client RPC calls.
-- Remove direct API execution rights from the Talent-media moderation guard.
-- The trigger continues to run as its SECURITY DEFINER owner.
REVOKE ALL ON FUNCTION public.guard_talent_media_moderation_fields()
  FROM PUBLIC, anon, authenticated;
