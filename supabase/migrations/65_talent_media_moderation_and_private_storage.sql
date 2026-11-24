-- YUKU migration 65: Talent media moderation and private object access.
-- This migration is intentionally staged in Git only. Do not apply to Production
-- until the client uses short-lived signed URLs for every talent-media object.

-- Backfill only when the moderation column is first introduced. Re-running this
-- migration must never auto-approve media uploaded after the rollout.
DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'talent_media'
      AND column_name = 'moderation_status'
  ) THEN
    ALTER TABLE public.talent_media
      ADD COLUMN moderation_status text NOT NULL DEFAULT 'pending';
    UPDATE public.talent_media
    SET moderation_status = 'approved';
  END IF;
END;
$block$;

ALTER TABLE public.talent_media
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'talent_media_moderation_status_check'
      AND conrelid = 'public.talent_media'::regclass
  ) THEN
    ALTER TABLE public.talent_media
      ADD CONSTRAINT talent_media_moderation_status_check
      CHECK (moderation_status IN ('pending', 'approved', 'rejected'));
  END IF;
END;
$block$;

CREATE INDEX IF NOT EXISTS idx_talent_media_storage_path
  ON public.talent_media (storage_path);
CREATE INDEX IF NOT EXISTS idx_talent_media_moderation_created
  ON public.talent_media (moderation_status, created_at DESC);

CREATE OR REPLACE FUNCTION public.guard_talent_media_moderation_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Storage object paths must always remain inside the owning Talent's folder.
  -- Without this invariant, an owner could point their row at another Talent's object.
  IF NEW.storage_path IS NULL
     OR btrim(NEW.storage_path) = ''
     OR split_part(NEW.storage_path, '/', 1) <> NEW.talent_id::text THEN
    RAISE EXCEPTION 'Path media harus berada di folder milik Talent.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.moderation_status := 'pending';
    NEW.moderation_reason := NULL;
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
    RETURN NEW;
  END IF;

  IF (
    NEW.moderation_status IS DISTINCT FROM OLD.moderation_status
    OR NEW.moderation_reason IS DISTINCT FROM OLD.moderation_reason
    OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
    OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
  ) AND NOT (
    auth.uid() IS NOT NULL
    AND (public.is_super_admin() OR public.has_admin_permission('talent'))
  ) THEN
    RAISE EXCEPTION 'Status moderasi media hanya dapat diubah oleh Admin Talent.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_talent_media_moderation_fields ON public.talent_media;
CREATE TRIGGER guard_talent_media_moderation_fields
BEFORE INSERT OR UPDATE ON public.talent_media
FOR EACH ROW
EXECUTE FUNCTION public.guard_talent_media_moderation_fields();

DROP POLICY IF EXISTS talent_media_select_public_or_owner ON public.talent_media;
CREATE POLICY talent_media_select_public_or_owner
ON public.talent_media
FOR SELECT
USING (
  (moderation_status = 'approved' AND public.is_talent_publicly_visible(talent_id))
  OR auth.uid() = talent_id
  OR public.is_super_admin()
  OR public.has_admin_permission('talent')
);

CREATE OR REPLACE FUNCTION public.can_read_talent_media_object(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.talent_media tm
    WHERE tm.storage_path = p_object_name
      AND split_part(tm.storage_path, '/', 1) = tm.talent_id::text
      AND (
        (tm.moderation_status = 'approved' AND public.is_talent_publicly_visible(tm.talent_id))
        OR auth.uid() = tm.talent_id
        OR public.is_super_admin()
        OR public.has_admin_permission('talent')
      )
  );
$function$;

REVOKE ALL ON FUNCTION public.can_read_talent_media_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_talent_media_object(text) TO anon, authenticated;

DROP POLICY IF EXISTS talent_media_bucket_public_select ON storage.objects;
DROP POLICY IF EXISTS talent_media_bucket_select_approved_or_owner ON storage.objects;
CREATE POLICY talent_media_bucket_select_approved_or_owner
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'talent-media'
  AND public.can_read_talent_media_object(name)
);

-- Private bucket prevents public object URLs from bypassing the Storage policy.
-- Public gallery access will be provided by short-lived signed URLs after approval.
UPDATE storage.buckets
SET public = false
WHERE id = 'talent-media';

CREATE OR REPLACE FUNCTION public.admin_review_talent_media(
  p_media_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_media public.talent_media%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF auth.uid() IS NULL
     OR NOT (public.is_super_admin() OR public.has_admin_permission('talent')) THEN
    RAISE EXCEPTION 'Akses ditolak: izin Talent diperlukan.';
  END IF;

  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Keputusan moderasi tidak valid.';
  END IF;

  IF p_decision = 'rejected' AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Alasan penolakan wajib diisi.';
  END IF;

  SELECT *
  INTO v_media
  FROM public.talent_media
  WHERE id = p_media_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Media Talent tidak ditemukan.';
  END IF;

  UPDATE public.talent_media
  SET moderation_status = p_decision,
      moderation_reason = CASE WHEN p_decision = 'rejected' THEN v_reason ELSE NULL END,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = p_media_id;

  INSERT INTO public.admin_audit_logs (
    admin_user_id, action_type, target_table, target_id, old_data, new_data
  ) VALUES (
    auth.uid(),
    'talent_media_review',
    'talent_media',
    p_media_id::text,
    jsonb_build_object(
      'moderation_status', v_media.moderation_status,
      'moderation_reason', v_media.moderation_reason
    ),
    jsonb_build_object(
      'moderation_status', p_decision,
      'moderation_reason', CASE WHEN p_decision = 'rejected' THEN v_reason ELSE NULL END
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_review_talent_media(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_talent_media(uuid, text, text) TO authenticated;
