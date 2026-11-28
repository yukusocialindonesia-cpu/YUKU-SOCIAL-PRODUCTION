DO $$
BEGIN
  IF to_regclass('public.hero_slides') IS NOT NULL
     AND (SELECT count(*) FROM public.hero_slides) > 0 THEN
    RAISE EXCEPTION 'hero_slides berisi data; perubahan dibatalkan demi keamanan.';
  END IF;
END $$;

DROP TABLE IF EXISTS public.hero_slides;

CREATE TABLE public.hero_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar NOT NULL DEFAULT 'Slide YUKU',
  image_url text NOT NULL,
  mobile_image_url text,
  link_url text,
  storage_path text,
  mobile_storage_path text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hero_slides_active_order
  ON public.hero_slides (is_active, sort_order, created_at DESC);
CREATE INDEX idx_hero_slides_created_by
  ON public.hero_slides (created_by);

CREATE TRIGGER trg_hero_slides_updated_at
  BEFORE UPDATE ON public.hero_slides
  FOR EACH ROW EXECUTE FUNCTION public.set_hero_slides_updated_at();

ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY hero_slides_select_public ON public.hero_slides
  FOR SELECT TO public
  USING ((is_active = true) OR (SELECT public.is_admin()));

CREATE POLICY hero_slides_admin_insert ON public.hero_slides
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY hero_slides_admin_update ON public.hero_slides
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY hero_slides_admin_delete ON public.hero_slides
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

REVOKE ALL ON public.hero_slides FROM anon, authenticated;
GRANT SELECT ON public.hero_slides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_slides TO authenticated;

NOTIFY pgrst, 'reload schema';