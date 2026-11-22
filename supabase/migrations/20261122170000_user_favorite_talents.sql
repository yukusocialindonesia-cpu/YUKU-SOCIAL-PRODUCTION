-- YUKU: saved talent favorites per authenticated account.
-- This migration is a proposal in the Jelajah PR branch only.
-- Do not apply to Production until reviewed and tested in a non-production project.

CREATE TABLE IF NOT EXISTS public.user_favorite_talents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  talent_id UUID NOT NULL REFERENCES public.talent_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_favorite_talents_user_talent_unique UNIQUE (user_id, talent_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_talents_user_created
  ON public.user_favorite_talents (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_favorite_talents_talent
  ON public.user_favorite_talents (talent_id);

ALTER TABLE public.user_favorite_talents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_favorite_talents FROM anon, PUBLIC;
GRANT SELECT, INSERT, DELETE ON TABLE public.user_favorite_talents TO authenticated;

DROP POLICY IF EXISTS "Users can read their own favorite talents"
  ON public.user_favorite_talents;
CREATE POLICY "Users can read their own favorite talents"
  ON public.user_favorite_talents
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can add their own favorite talents"
  ON public.user_favorite_talents;
CREATE POLICY "Users can add their own favorite talents"
  ON public.user_favorite_talents
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can remove their own favorite talents"
  ON public.user_favorite_talents;
CREATE POLICY "Users can remove their own favorite talents"
  ON public.user_favorite_talents
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

COMMENT ON TABLE public.user_favorite_talents IS
  'Saved talent profiles for each authenticated YUKU user. RLS restricts rows to the owner.';
