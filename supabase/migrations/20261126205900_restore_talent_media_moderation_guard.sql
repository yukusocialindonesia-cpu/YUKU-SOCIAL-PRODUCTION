-- The legacy numbered migration 65 creates this trigger function, but Supabase
-- timestamp replay applies timestamped migrations first. Create the function here
-- so the immediately following ACL-hardening migration can revoke API execution.
CREATE OR REPLACE FUNCTION public.guard_talent_media_moderation_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
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
