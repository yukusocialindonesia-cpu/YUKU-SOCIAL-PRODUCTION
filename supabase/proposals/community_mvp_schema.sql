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
  likes_count integer NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  comments_count integer NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
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

-- Keep public likes aggregate-only: never expose the list of member IDs.
CREATE OR REPLACE FUNCTION public.update_community_post_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_post_id uuid;
  v_delta integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_post_id := OLD.post_id;
    v_delta := -1;
  ELSE
    v_post_id := NEW.post_id;
    v_delta := 1;
  END IF;

  IF TG_TABLE_NAME = 'community_likes' THEN
    UPDATE public.community_posts
    SET likes_count = GREATEST(0, likes_count + v_delta)
    WHERE id = v_post_id;
  ELSE
    UPDATE public.community_posts
    SET comments_count = GREATEST(0, comments_count + v_delta)
    WHERE id = v_post_id;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.update_community_post_counters() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_community_like_counter ON public.community_likes;
CREATE TRIGGER trg_community_like_counter
AFTER INSERT OR DELETE ON public.community_likes
FOR EACH ROW EXECUTE FUNCTION public.update_community_post_counters();

DROP TRIGGER IF EXISTS trg_community_comment_counter ON public.community_comments;
CREATE TRIGGER trg_community_comment_counter
AFTER INSERT OR DELETE ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.update_community_post_counters();

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
DROP POLICY IF EXISTS community_likes_owner_read ON public.community_likes;
CREATE POLICY community_likes_owner_read ON public.community_likes
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

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
      SELECT 1
      FROM public.community_comments c
      JOIN public.community_posts p ON p.id = c.post_id
      WHERE c.id = comment_id
        AND c.status = 'published'
        AND p.status = 'published'
    ))
  )
);

-- Prevent repeated pending reports by the same member for the same target.
-- A member may report again after a moderator has reviewed or dismissed the earlier report.
CREATE UNIQUE INDEX IF NOT EXISTS community_reports_one_pending_post_per_reporter
  ON public.community_reports (reporter_id, post_id)
  WHERE status = 'pending' AND post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS community_reports_one_pending_comment_per_reporter
  ON public.community_reports (reporter_id, comment_id)
  WHERE status = 'pending' AND comment_id IS NOT NULL;

DROP POLICY IF EXISTS community_reports_owner_or_admin_read ON public.community_reports;
CREATE POLICY community_reports_owner_or_admin_read ON public.community_reports
FOR SELECT TO authenticated
USING (reporter_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- No direct browser updates to report status. Admin review workflow is a separate step.
REVOKE ALL ON public.community_posts, public.community_comments, public.community_likes, public.community_reports FROM PUBLIC;
GRANT SELECT ON public.community_posts, public.community_comments TO anon, authenticated;
GRANT SELECT ON public.community_likes, public.community_reports TO authenticated;
GRANT INSERT (reporter_id, post_id, comment_id, reason, details) ON public.community_reports TO authenticated;
GRANT INSERT (author_id, body, topic) ON public.community_posts TO authenticated;
GRANT INSERT (post_id, author_id, body) ON public.community_comments TO authenticated;
GRANT INSERT (post_id, user_id) ON public.community_likes TO authenticated;
GRANT DELETE ON public.community_posts, public.community_comments, public.community_likes TO authenticated;
GRANT UPDATE (body, topic) ON public.community_posts TO authenticated;
GRANT UPDATE (body) ON public.community_comments TO authenticated;

-- Author snapshot columns and report status remain writable only by trusted database code.


-- ---------------------------------------------------------------------------
-- ADMIN MODERATION (prototype review addendum)
-- Uses the existing Admin permission model. Support Admins may moderate;
-- this deliberately does not treat every Admin as a moderator.
-- ---------------------------------------------------------------------------

ALTER TABLE public.community_posts
  DROP CONSTRAINT IF EXISTS community_posts_status_check;
ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_status_check
  CHECK (status IN ('published', 'hidden', 'removed'));

ALTER TABLE public.community_comments
  DROP CONSTRAINT IF EXISTS community_comments_status_check;
ALTER TABLE public.community_comments
  ADD CONSTRAINT community_comments_status_check
  CHECK (status IN ('published', 'hidden', 'removed'));

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderation_note text;

ALTER TABLE public.community_comments
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderation_note text;

ALTER TABLE public.community_reports
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- Existing get_admin_access() confirms that permissions are stored in
-- private.admin_permissions(permission_key, admin_user_id), and that active
-- Admin accounts are checked by private.is_active_admin(uuid).
CREATE OR REPLACE FUNCTION public.community_can_moderate()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(
    private.is_active_admin(auth.uid())
    AND (
      private.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM private.admin_permissions ap
        WHERE ap.admin_user_id = auth.uid()
          AND ap.permission_key = 'support'
      )
    ),
    false
  );
$function$;

REVOKE ALL ON FUNCTION public.community_can_moderate() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_can_moderate() TO authenticated;

-- RLS: Support Admins and Super Admins can see hidden/removed content and reports.
DROP POLICY IF EXISTS community_posts_moderator_read ON public.community_posts;
CREATE POLICY community_posts_moderator_read ON public.community_posts
FOR SELECT TO authenticated
USING ((SELECT public.community_can_moderate()));

DROP POLICY IF EXISTS community_comments_moderator_read ON public.community_comments;
CREATE POLICY community_comments_moderator_read ON public.community_comments
FOR SELECT TO authenticated
USING ((SELECT public.community_can_moderate()));

DROP POLICY IF EXISTS community_reports_moderator_read ON public.community_reports;
CREATE POLICY community_reports_moderator_read ON public.community_reports
FOR SELECT TO authenticated
USING ((SELECT public.community_can_moderate()));

-- Only trusted RPCs may change moderation state or report decisions.
REVOKE UPDATE, DELETE ON public.community_reports FROM authenticated;
REVOKE UPDATE ON public.community_posts, public.community_comments FROM authenticated;
GRANT UPDATE (body, topic) ON public.community_posts TO authenticated;
GRANT UPDATE (body) ON public.community_comments TO authenticated;

CREATE OR REPLACE FUNCTION public.moderate_community_post(
  p_post_id uuid,
  p_action text,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.community_can_moderate() THEN
    RAISE EXCEPTION 'Tidak memiliki izin moderasi komunitas'
      USING ERRCODE = '42501';
  END IF;

  IF p_action IS NULL OR p_action NOT IN ('hide', 'remove', 'restore') THEN
    RAISE EXCEPTION 'Aksi moderasi tidak valid' USING ERRCODE = '22023';
  END IF;

  UPDATE public.community_posts
  SET status = CASE p_action
        WHEN 'hide' THEN 'hidden'
        WHEN 'remove' THEN 'removed'
        ELSE 'published'
      END,
      moderated_at = now(),
      moderated_by = auth.uid(),
      moderation_note = NULLIF(left(btrim(COALESCE(p_note, '')), 500), '')
  WHERE id = p_post_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Postingan tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.moderate_community_comment(
  p_comment_id uuid,
  p_action text,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.community_can_moderate() THEN
    RAISE EXCEPTION 'Tidak memiliki izin moderasi komunitas'
      USING ERRCODE = '42501';
  END IF;

  IF p_action NOT IN ('hide', 'remove', 'restore') THEN
    RAISE EXCEPTION 'Aksi moderasi tidak valid' USING ERRCODE = '22023';
  END IF;

  UPDATE public.community_comments
  SET status = CASE p_action
        WHEN 'hide' THEN 'hidden'
        WHEN 'remove' THEN 'removed'
        ELSE 'published'
      END,
      moderated_at = now(),
      moderated_by = auth.uid(),
      moderation_note = NULLIF(left(btrim(COALESCE(p_note, '')), 500), '')
  WHERE id = p_comment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Komentar tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_community_report(
  p_report_id uuid,
  p_decision text,
  p_admin_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.community_can_moderate() THEN
    RAISE EXCEPTION 'Tidak memiliki izin moderasi komunitas'
      USING ERRCODE = '42501';
  END IF;

  IF p_decision IS NULL OR p_decision NOT IN ('reviewed', 'dismissed') THEN
    RAISE EXCEPTION 'Keputusan laporan tidak valid' USING ERRCODE = '22023';
  END IF;

  UPDATE public.community_reports
  SET status = p_decision,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      admin_notes = NULLIF(left(btrim(COALESCE(p_admin_notes, '')), 500), '')
  WHERE id = p_report_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Laporan tidak ditemukan atau sudah diproses'
      USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.moderate_community_post(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moderate_community_comment(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_community_report(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderate_community_post(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_community_comment(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_community_report(uuid, text, text) TO authenticated;

-- IMPORTANT: this file remains a proposal. It has NOT been applied to Supabase.


-- Tighten comment reports: the parent post must still be publicly visible.
DROP POLICY IF EXISTS community_reports_member_insert ON public.community_reports;
CREATE POLICY community_reports_member_insert ON public.community_reports
FOR INSERT TO authenticated
WITH CHECK (
  reporter_id = (SELECT auth.uid())
  AND (
    (post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = post_id AND p.status = 'published'
    ))
    OR
    (comment_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.community_comments c
      JOIN public.community_posts p ON p.id = c.post_id
      WHERE c.id = comment_id
        AND c.status = 'published'
        AND p.status = 'published'
    ))
  )
);


-- Remove the earlier broad is_admin() read/delete rules. Only Support Admins
-- and Super Admins may inspect hidden items; all moderation changes go via RPC.
DROP POLICY IF EXISTS community_posts_admin_read ON public.community_posts;
DROP POLICY IF EXISTS community_comments_admin_read ON public.community_comments;

DROP POLICY IF EXISTS community_posts_owner_delete ON public.community_posts;
CREATE POLICY community_posts_owner_delete ON public.community_posts
FOR DELETE TO authenticated
USING (author_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS community_comments_owner_delete ON public.community_comments;
CREATE POLICY community_comments_owner_delete ON public.community_comments
FOR DELETE TO authenticated
USING (author_id = (SELECT auth.uid()));
