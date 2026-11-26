-- Trigger-only SECURITY DEFINER helper; it is not an application RPC.
-- The trigger can still invoke the function without granting direct API execution.
REVOKE ALL ON FUNCTION public.guard_talent_media_moderation_fields()
  FROM PUBLIC, anon, authenticated;
