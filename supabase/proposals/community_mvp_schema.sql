-- DRAFT ONLY: Community MVP schema for YUKU.
-- This is a review proposal, NOT a numbered Supabase migration.
-- Do not execute against Production. Assign a migration number only after review.
-- Access model: public read; authenticated users may create posts, likes and comments.
-- Text-only MVP: no Storage bucket, media upload, payment, booking or talent schema changes.

CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_display_name text NOT NULL DEFAULT 'Anggota YUKU',
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1200),
  topic text NOT NULL CHECK (topic IN ('Pertemanan', 'Kuliner', 'Travel & Aktivitas', 'Hobi', 'Gaming')),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_display_name text NOT NULL DEFAULT 'Anggota YUKU',
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 600),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_likes (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('Spam', 'Pelecehan', 'Konten tidak pantas', 'Penipuan', 'Lainnya')),
  details text CHECK (details IS NULL OR char_length(details) <= 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_reports_one_target CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS community_posts_public_feed_idx
  ON public.community_posts (created_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS community_posts_author_idx
  ON public.community_posts (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_comments_post_idx
  ON public.community_comments (post_id, created_at ASC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS community_reports_status_idx
  ON public.community_reports (status, created_at DESC);

-- Copy a safe display name from existing public profile data.
-- The browser cannot supply or change this field.
CREATE OR REPLACE FUNCTION public.set_community_author_display_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  SELECT COALESCE(
    NULLIF(cp.display_name, ''),
    NULLIF(tp.display_name, ''),
    NULLIF(u.full_name, ''),
    'Anggota YUKU'
  )
  INTO NEW.author_display_name
  FROM public.users u
  LEFT JOIN public.customer_profiles cp ON cp.id = NEW.author_id
  LEFT JOIN public.talent_profiles tp ON tp.id = NEW.author_id
  WHERE u.id = NEW.author_id;

  NEW.author_display_name := COALESCE(NEW.author_display_name, 'Anggota YUKU');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.set_community_author_display_name() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_community_post_author_name ON public.community_posts;
CREATE TRIGGER trg_community_post_author_name
BEFORE INSERT ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.set_community_author_display_name();

DROP TRIGGER IF EXISTS trg_community_comment_author_name ON public.community_comments;
CREATE TRIGGER trg_community_comment_author_name
BEFORE INSERT ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.set_community_author_display_name();

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

-- Public visitors can read only published community content.
DROP POLICY IF EXISTS community_posts_public_read ON public.community_posts;
CREATE POLICY community_posts_public_read ON public.community_posts
FOR SELECT TO anon, authenticated
USING (status = 'published' OR author_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS community_posts_admin_read ON public.community_posts;
CREATE POLICY community_posts_admin_read ON public.community_posts
FOR SELECT TO authenticated
USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS community_posts_member_insert ON public.community_posts;
CREATE POLICY community_posts_member_insert ON public.community_posts
FOR INSERT TO authenticated
WITH CHECK (author_id = (SELECT auth.uid()) AND status = 'published');

DROP POLICY IF EXISTS community_posts_owner_update ON public.community_posts;
CREATE POLICY community_posts_owner_update ON public.community_posts
FOR UPDATE TO authenticated
USING (author_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
WITH CHECK (author_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS community_posts_owner_delete ON public.community_posts;
CREATE POLICY community_posts_owner_delete ON public.community_posts
FOR DELETE TO authenticated
USING (author_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS community_comments_public_read ON public.community_comments;
CREATE POLICY community_comments_public_read ON public.community_comments
FOR SELECT TO anon, authenticated
USING (
  (status = 'published' AND EXISTS (
    SELECT 1 FROM public.community_posts p
    WHERE p.id = post_id AND p.status = 'published'
  ))
  OR author_id = (SELECT auth.uid())
);

DROP POLICY IF EXISTS community_comments_admin_read ON public.community_comments;
CREATE POLICY community_comments_admin_read ON public.community_comments
FOR SELECT TO authenticated
USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS community_comments_member_insert ON public.community_comments;
CREATE POLICY community_comments_member_insert ON public.community_comments
FOR INSERT TO authenticated
WITH CHECK (
  author_id = (SELECT auth.uid())
  AND status = 'published'
  AND EXISTS (
    SELECT 1 FROM public.community_posts p
    WHERE p.id = post_id AND p.status = 'published'
  )
);

DROP POLICY IF EXISTS community_comments_owner_update ON public.community_comments;
CREATE POLICY community_comments_owner_update ON public.community_comments
FOR UPDATE TO authenticated
USING (author_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
WITH CHECK (author_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS community_comments_owner_delete ON public.community_comments;
CREATE POLICY community_comments_owner_delete ON public.community_comments
FOR DELETE TO authenticated
USING (author_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS community_likes_public_read ON public.community_likes;
CREATE POLICY community_likes_public_read ON public.community_likes
FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.community_posts p
    WHERE p.id = post_id AND p.status = 'published'
  )
);

DROP POLICY IF EXISTS community_likes_member_insert ON public.community_likes;
CREATE POLICY community_likes_member_insert ON public.community_likes
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.community_posts p
    WHERE p.id = post_id AND p.status = 'published'
  )
);

DROP POLICY IF EXISTS community_likes_owner_delete ON public.community_likes;
CREATE POLICY community_likes_owner_delete ON public.community_likes
FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS community_reports_member_insert ON public.community_reports;
CREATE POLICY community_reports_member_insert ON public.community_reports
FOR INSERT TO authenticated
WITH CHECK (
  reporter_id = (SELECT auth.uid())
  AND (
    (post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.community_posts p WHERE p.id = post_id AND p.status = 'published'
    ))
    OR
    (comment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.community_comments c WHERE c.id = comment_id AND c.status = 'published'
    ))
  )
);

DROP POLICY IF EXISTS community_reports_owner_or_admin_read ON public.community_reports;
CREATE POLICY community_reports_owner_or_admin_read ON public.community_reports
FOR SELECT TO authenticated
USING (reporter_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- No direct browser updates to report status. Admin review workflow is a separate step.
REVOKE ALL ON public.community_posts, public.community_comments, public.community_likes, public.community_reports FROM PUBLIC;
GRANT SELECT ON public.community_posts, public.community_comments, public.community_likes TO anon, authenticated;
GRANT SELECT ON public.community_reports TO authenticated;
GRANT INSERT (reporter_id, post_id, comment_id, reason, details) ON public.community_reports TO authenticated;
GRANT INSERT (author_id, body, topic) ON public.community_posts TO authenticated;
GRANT INSERT (post_id, author_id, body) ON public.community_comments TO authenticated;
GRANT INSERT (post_id, user_id) ON public.community_likes TO authenticated;
GRANT DELETE ON public.community_posts, public.community_comments, public.community_likes TO authenticated;
GRANT UPDATE (body, topic) ON public.community_posts TO authenticated;
GRANT UPDATE (body) ON public.community_comments TO authenticated;

-- Author snapshot columns and report status remain writable only by trusted database code.
