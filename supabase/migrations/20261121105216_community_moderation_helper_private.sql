-- Keep the moderation permission helper out of the exposed public API schema.
CREATE OR REPLACE FUNCTION private.community_can_moderate()
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

GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE ALL ON FUNCTION private.community_can_moderate() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.community_can_moderate() TO authenticated;

-- Keep one SELECT policy per role/action to avoid overlapping permissive policies.
DROP POLICY IF EXISTS community_posts_public_read ON public.community_posts;
DROP POLICY IF EXISTS community_posts_moderator_read ON public.community_posts;
CREATE POLICY community_posts_public_read ON public.community_posts
FOR SELECT TO anon USING (status = 'published');
CREATE POLICY community_posts_authenticated_read ON public.community_posts
FOR SELECT TO authenticated
USING (
  status = 'published'
  OR author_id = (SELECT auth.uid())
  OR (SELECT private.community_can_moderate())
);

DROP POLICY IF EXISTS community_comments_public_read ON public.community_comments;
DROP POLICY IF EXISTS community_comments_moderator_read ON public.community_comments;
CREATE POLICY community_comments_public_read ON public.community_comments
FOR SELECT TO anon
USING (
  status = 'published'
  AND EXISTS (
    SELECT 1 FROM public.community_posts p
    WHERE p.id = post_id AND p.status = 'published'
  )
);
CREATE POLICY community_comments_authenticated_read ON public.community_comments
FOR SELECT TO authenticated
USING (
  (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = post_id AND p.status = 'published'
    )
  )
  OR author_id = (SELECT auth.uid())
  OR (SELECT private.community_can_moderate())
);

DROP POLICY IF EXISTS community_reports_owner_or_admin_read ON public.community_reports;
DROP POLICY IF EXISTS community_reports_moderator_read ON public.community_reports;
CREATE POLICY community_reports_owner_or_moderator_read ON public.community_reports
FOR SELECT TO authenticated
USING (
  reporter_id = (SELECT auth.uid())
  OR (SELECT private.community_can_moderate())
);

-- The public RPC is not needed; policies call the helper in the private schema.
CREATE OR REPLACE FUNCTION public.process_community_report(
  p_report_id uuid,
  p_action text,
  p_admin_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_report public.community_reports%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT private.community_can_moderate() THEN
    RAISE EXCEPTION 'Tidak memiliki izin moderasi komunitas'
      USING ERRCODE = '42501';
  END IF;

  IF p_action IS NULL OR p_action NOT IN ('hide', 'remove', 'dismiss') THEN
    RAISE EXCEPTION 'Aksi moderasi tidak valid' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_report
  FROM public.community_reports
  WHERE id = p_report_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Laporan tidak ditemukan atau sudah diproses'
      USING ERRCODE = 'P0002';
  END IF;

  IF p_action <> 'dismiss' THEN
    IF v_report.post_id IS NOT NULL THEN
      UPDATE public.community_posts
      SET status = CASE p_action WHEN 'hide' THEN 'hidden' ELSE 'removed' END,
          moderated_at = now(),
          moderated_by = auth.uid(),
          moderation_note = NULLIF(left(btrim(COALESCE(p_admin_notes, '')), 500), '')
      WHERE id = v_report.post_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Postingan laporan tidak ditemukan' USING ERRCODE = 'P0002';
      END IF;
    ELSIF v_report.comment_id IS NOT NULL THEN
      UPDATE public.community_comments
      SET status = CASE p_action WHEN 'hide' THEN 'hidden' ELSE 'removed' END,
          moderated_at = now(),
          moderated_by = auth.uid(),
          moderation_note = NULLIF(left(btrim(COALESCE(p_admin_notes, '')), 500), '')
      WHERE id = v_report.comment_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Komentar laporan tidak ditemukan' USING ERRCODE = 'P0002';
      END IF;
    ELSE
      RAISE EXCEPTION 'Laporan tidak memiliki target yang valid' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.community_reports
  SET status = CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'reviewed' END,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      admin_notes = NULLIF(left(btrim(COALESCE(p_admin_notes, '')), 500), '')
  WHERE id = p_report_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.community_can_moderate() FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.community_can_moderate();
