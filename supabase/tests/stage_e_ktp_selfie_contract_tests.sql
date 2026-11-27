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
     OR position('customer' IN lower(v_protect)) = 0 THEN
    RAISE EXCEPTION 'STAGE E failed: identity protection trigger function does not include Customer selfie rules.';
  END IF;

  SELECT pg_get_functiondef('public.guard_ktp_verified_requires_valid_identity()'::regprocedure)
    INTO v_guard;
  IF position('selfie_storage_path' IN lower(v_guard)) = 0
     OR position('o.owner = new.id' IN lower(v_guard)) = 0
     OR position('o.owner_id = new.id::text' IN lower(v_guard)) = 0 THEN
    RAISE EXCEPTION 'STAGE E failed: verified identity guard lacks selfie/Storage ownership checks.';
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
