-- STAGE E: Customer KTP/selfie SQL contract checks.
-- Run only in STAGING after migrations 20261127001600 and 20261127170000.
-- These checks are read-only and validate deployed schema/function/policy contracts.
-- They do not replace dynamic tests with real fixture users and Storage objects.

DO $stage_e_contract$
DECLARE
  v_owner_type TEXT;
  v_owner_id_type TEXT;
  v_protect TEXT;
  v_guard TEXT;
  v_delete_policy TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_identities'
      AND column_name = 'selfie_storage_path'
      AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'STAGE E failed: user_identities.selfie_storage_path text column is missing.';
  END IF;

  SELECT data_type INTO v_owner_type
  FROM information_schema.columns
  WHERE table_schema = 'storage' AND table_name = 'objects' AND column_name = 'owner';

  SELECT data_type INTO v_owner_id_type
  FROM information_schema.columns
  WHERE table_schema = 'storage' AND table_name = 'objects' AND column_name = 'owner_id';

  IF v_owner_type <> 'uuid' OR v_owner_id_type <> 'text' THEN
    RAISE EXCEPTION 'STAGE E failed: unexpected Storage owner types (owner %, owner_id %).', v_owner_type, v_owner_id_type;
  END IF;

  SELECT pg_get_functiondef('public.protect_and_verify_user_identities()'::regprocedure)
    INTO v_protect;
  IF position('selfie_storage_path' IN lower(v_protect)) = 0
     OR position('public.customer_profiles' IN lower(v_protect)) = 0
     OR position('v_user_role' IN lower(v_protect)) > 0 THEN
    RAISE EXCEPTION 'STAGE E failed: identity protection must require selfie by Customer profile, not legacy primary role.';
  END IF;

  SELECT pg_get_functiondef('public.guard_ktp_verified_requires_valid_identity()'::regprocedure)
    INTO v_guard;
  IF position('selfie_storage_path' IN lower(v_guard)) = 0
     OR position('public.customer_profiles' IN lower(v_guard)) = 0
     OR position('v_user_role' IN lower(v_guard)) > 0
     OR position('o.owner = new.id' IN lower(v_guard)) = 0
     OR position('o.owner_id = new.id::text' IN lower(v_guard)) = 0 THEN
    RAISE EXCEPTION 'STAGE E failed: verified identity guard lacks Customer-profile selfie/Storage ownership checks.';
  END IF;

  SELECT qual INTO v_delete_policy
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'ktp_documents_owner_delete_unreferenced';

  IF v_delete_policy IS NULL
     OR position('exists' IN lower(v_delete_policy)) = 0
     OR position('user_identities' IN lower(v_delete_policy)) = 0 THEN
    RAISE EXCEPTION 'STAGE E failed: orphan-only Storage delete policy is missing or incomplete.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.user_identities'::regclass
      AND tgname = 'trg_require_complete_ktp_evidence'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'STAGE E failed: complete KTP evidence trigger is missing.';
  END IF;

  RAISE NOTICE 'STAGE E contract checks passed. Dynamic identity/Storage ownership tests are still required.';
END;
$stage_e_contract$;


-- Stage E.1: the earlier verification trigger is syntactically complete and
-- requires selfie evidence only when a real Customer profile exists.
DO $$
DECLARE
  v_guard TEXT;
  v_sanction TEXT;
BEGIN
  v_guard := pg_get_functiondef(
    'public.require_complete_ktp_evidence_before_verification()'::regprocedure
  );
  IF position('customer_profiles' IN v_guard) = 0
     OR position('^[0-9]{16}$' IN v_guard) = 0
     OR position('selfie_storage_path' IN v_guard) = 0 THEN
    RAISE EXCEPTION 'KTP evidence guard must validate 16-digit NIK and Customer selfie profile capability';
  END IF;

  v_sanction := pg_get_functiondef(
    'public.prevent_scoped_admin_sanction_override()'::regprocedure
  );
  IF position('suspended' IN v_sanction) = 0
     OR position('banned' IN v_sanction) = 0
     OR position('is_super_admin' IN v_sanction) = 0 THEN
    RAISE EXCEPTION 'Sanction guard must protect suspended/banned accounts from non-Super-Admin changes';
  END IF;
END;
$$;
