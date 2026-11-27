# YUKU Security & Privacy Release Blockers

Date: 27 November 2026
Baseline: read-only Production inspections recorded in the existing security audit documents.
Status: prioritized findings and acceptance criteria; no Production remediation performed by this document.

## Executive decision

Do not treat the current account, identity, media, and Admin workflows as fully launch-ready. Several branch migrations address confirmed Production gaps, but branch presence is not deployment. Apply only through reviewed migrations after clean Staging replay and negative tests.

## P0/P1 findings

### P1 — Approved Talent media can be overwritten in Production

Evidence recorded in `docs/YUKU-RLS-STORAGE-SECURITY-AUDIT.md`:
- Production has `talent_media_bucket_owner_update` on `storage.objects`.
- An owner can UPDATE bytes of an existing approved object while its moderation row remains approved.
- Frontend `upsert: false` is not an authorization boundary.

Branch remediation already identified:
- `20261127001300_make_talent_media_objects_immutable.sql` drops the owner UPDATE policy.
- New unique upload creates a new moderation-pending row; owner delete remains scoped.

Acceptance:
- Owner UPDATE/upsert existing approved object fails at Storage API.
- New unique upload succeeds and enters pending moderation.
- Owner can delete only own object; unrelated user cannot read/write.
- Talent Admin moderation still works.
- Confirm effective combined Storage policies contain no permissive UPDATE path.

### P1 — Public Talent profile exposes excluded columns

Production ACL inspection recorded:
- `anon` has table-level SELECT on `public.talent_profiles`, including `referral_code` and other columns not intended for public catalogue access.
- RLS limits rows but does not limit columns.

Branch migration:
- `20261127000300_limit_public_talent_profile_columns.sql` replaces broad table SELECT with an explicit column allowlist.

Acceptance:
- `has_table_privilege('anon', 'public.talent_profiles', 'SELECT')` is false.
- Explicit allowed public columns remain readable.
- `has_column_privilege` for `referral_code` and every excluded field is false for anon.
- Authenticated owner/admin access remains only as required.

Product decision:
- The current allowlist still makes rates queryable to anonymous visitors, while the product requirement is to reveal price only after opening a Talent profile. Decide whether public rate data is acceptable; align SQL projection and UI behavior before release.

### P1 — KTP selfie is uploaded but not linked to identity review

Source-to-Production comparison recorded:
- Client uploads KTP and selfie to private `ktp-documents`.
- `user_identities` stores only `ktp_storage_path`; no selfie path/evidence record exists.
- Admin review UI cannot retrieve the selfie from the identity submission.
- Partial upload or DB failure can leave orphaned sensitive files; resubmission can leave superseded files.

Acceptance:
- Persist both evidence objects against one versioned submission (dedicated selfie path or normalized evidence table).
- Owner and correctly scoped reviewer can obtain short-lived URLs; unrelated users, anon, and wrong Admin module cannot.
- Failure injection after each upload and DB write leaves no orphan objects.
- Define retention/deletion for superseded/rejected submissions and audit every reviewer access/decision.
- Never put NIK, signed URLs, or raw identity content in audit logs.

### P1 — Talent approval can override suspended/banned account status

Production `admin_review_talent()` was observed to set account status to active on approval and pending_verification on rejection without preserving suspended/banned states.

Acceptance:
- Only allowed onboarding statuses can transition through Talent review.
- Suspended/banned/closed accounts remain unchanged and cannot become publicly visible or bookable through review.
- Concurrent review decisions serialize and create one attributable audit event.

### P1 — KTP review allows incomplete evidence and weak rejection audit

Production observations:
- Talent review can mark KTP verified/18+ without a persisted retrievable KTP path or durable alternative-verification evidence.
- Customer KTP review accepts a rejected decision with nullable reason and does not append an audit log in the same transaction.

Acceptance:
- Standard KTP verification requires persisted KTP evidence and selfie evidence.
- Alternative verification must be a distinct method with mandatory evidence type, reviewer, timestamp, and notes; do not label it KTP-verified.
- Rejection requires non-empty sanitized reason.
- Review status change and append-only audit event commit atomically.

### P1 — Report moderation write path bypasses audited RPC

Production grants direct authenticated UPDATE on report status, internal notes, and reviewer attribution, even though the intended workflow is the scoped `admin_resolve_report()` RPC.

Acceptance:
- Revoke direct app-role UPDATE on moderation-only fields.
- Keep reporter INSERT and scoped SELECT separate.
- RPC enforces Support permission, row lock, allowed transitions, and writes audit event atomically.
- Reporter notification must never contain internal `admin_notes`.

### P1 — Trigger-only SECURITY DEFINER helper is directly executable

Production inventory found `guard_talent_media_moderation_fields()` directly executable by anon/authenticated despite being a trigger-only helper. Branch migration `20261127001200_revoke_talent_media_trigger_helper_execute.sql` revokes direct execution while trigger invocation remains available.

Acceptance:
- `has_function_privilege('anon', ...)` and authenticated are false.
- Trigger continues to enforce moderation metadata immutability on INSERT/UPDATE.
- Do not blanket-revoke all SECURITY DEFINER functions; four narrow public boolean helpers are intentionally used by RLS/Storage and require role-matrix tests.


### P2 — Production booking validator is behind the hardened repository migration

Read-only Production inspection on 27 November 2026 found:
- Live `public.validate_booking_update()` still returns early when the caller has Booking, Finance, or Support permission. That skips the trigger's financial snapshot, participant, schedule, and status-transition checks.
- The current `bookings_update_parties_or_admin` RLS policy limits direct UPDATE to booking participants or Super Admin. Scoped Admins who are not booking participants therefore remain blocked by RLS; this inspection did **not** establish a direct scoped-Admin exploit.
- Repository `main` already contains `20261127000500_narrow_scoped_admin_booking_trigger_bypass.sql`, which removes the broad scoped-permission bypass from both booking trigger guards and limits Support's dispute handling to the report-resolution transitions.
- The live `supabase_migrations.schema_migrations` inventory did not contain that migration name/version at inspection time, and the live validator definition still matches the older implementation. Repository presence is not Production application.

Required action:
- Treat this as Production schema drift and a defense-in-depth gap, not as proof that an ordinary scoped Admin can currently update arbitrary bookings.
- Reconcile the exact migration ledger and duplicate-version history before applying anything; do not manually run the SQL or assume a filename version equals the ledger version.
- Replay the ordered migration chain on clean Staging, then test Customer, Talent, Booking Admin, Finance Admin, Support Admin, Super Admin, and service_role against financial columns, participant IDs, paid schedule fields, dispute snapshot, and every allowed status transition.
- Recheck effective RLS and trigger definitions after the controlled migration rollout.

## P2 privacy minimization

### Public reviews expose raw identifiers

Production public SELECT on `reviews` includes `customer_id` and `booking_id`. These UUIDs are not names or contact details, but permit stable correlation and expose internal booking identifiers.

Preferred remediation:
- Public-safe view/RPC returns only review display fields and a non-identifying display label.
- Raw table SELECT limited to roles that need internal identifiers.
- Preserve moderation and owner access.

### KTP evidence cleanup and consent evidence

- Store Terms/age consent policy version and server timestamp; UI checkbox alone is not durable legal evidence.
- Password recovery URL should remove consumed sensitive parameters after auth client processing; test expired/replayed links and session cleanup.
- Confirm Auth leaked-password protection, CAPTCHA, rate limits, SMTP, and redirect allow-list in project settings; previous metadata inspection could not verify these settings.

## Existing positive controls to preserve

- KTP bucket is private; owner/reviewer SELECT is scoped.
- Public Talent visibility checks role, active account, age flag, verified KTP, approved profile, and at least one approved active service.
- Booking RPC independently rechecks Customer and Talent eligibility and approved service.
- Exact Talent coordinates are stored privately and not directly readable by anon/authenticated.
- Admin permissions are stored in private schema and scoped by module; Super Admin provisions scoped Admins.
- Do not broaden private schema policies or replace scoped helpers with caller-supplied user IDs.

## Staging release gate

Run a complete clean migration replay, then test each finding with anon, owner, unrelated Customer, Talent, Talent Admin, Finance Admin, Support Admin, Super Admin, and service_role as appropriate. Test direct REST/Storage calls, not only UI.

Required concurrency/failure tests:
- Two simultaneous Admin reviews of one identity/report.
- Media overwrite vs moderation approval.
- KTP and selfie parallel upload failures, DB failure, resubmission.
- Suspended account review attempts.
- Report notification with internal notes.
- Public review projection does not expose internal UUIDs.
- Security Advisor plus effective ACL/policy checks after migrations.

## Explicit safety boundary

This document does not apply migrations, modify policies/functions, inspect object contents, read KTP/customer data, change Auth settings, deploy functions, or touch Production. All findings must be revalidated against the current Production schema immediately before a controlled release; historical snapshots are not live proof.


### Fresh read-only verification — report moderation write path (27 Nov 2026)

Production was rechecked against the current schema:
- Table: `public.reports_complaints` (not `public.reports`).
- `authenticated` has column-level UPDATE on `status`, `admin_notes`, and `resolved_by_admin_id`, even though table-level UPDATE is false.
- The permissive `reports_update_admin` policy still exists for `has_admin_permission('support')`.
- `public.admin_resolve_report(uuid, report_status_type, text, boolean)` exists, row-locks the report, updates status/notes/reviewer, and writes `admin_audit_logs`.
- The current `notify_on_report_status_change()` trigger includes `NEW.admin_notes` in the reporter's notification text. This can disclose internal moderation notes.
- The Admin UI currently calls `admin_resolve_report`; no direct frontend update call was found in the inspected AdminPage source.

**Required remediation before release:** revoke the three column-level UPDATE grants from `authenticated`; drop `reports_update_admin`; retain the audited RPC as the only moderation write path; remove internal notes from reporter notification text; add regression checks proving a Support Admin cannot directly update columns but can resolve via the RPC, and that reporter notifications never include `admin_notes`. This remains a release blocker; no Production change was made.


## Production revalidation snapshot — 27 Nov 2026 (read-only)

The following P1 findings were rechecked directly against the linked Production database after the initial audit:

1. **Talent media overwrite is still possible by policy.** Storage policy `talent_media_bucket_owner_update` remains permissive for authenticated owners in bucket `talent-media`. The branch-only migration `20261127001300_make_talent_media_objects_immutable.sql` has not been applied.
2. **Public Talent column exposure remains.** `anon` still has table-level SELECT on `public.talent_profiles`; the current column grants include `referral_code`, `hourly_rate`, and `online_chat_rate`. The column-allowlist migration is not yet deployed. Public rates are also queryable outside the intended detail-page UI path; this must be treated as a product/API exposure decision, not just a card-rendering issue.
3. **Selfie evidence is not persisted in Production schema.** `public.user_identities` has `ktp_storage_path`, `ktp_number`, and `ktp_verification_status`, but no `selfie_storage_path` column. The #295 migration exists in the canonical source branch only.
4. **Talent approval can still reactivate sanctioned accounts.** The live `admin_review_talent(uuid,boolean,ktp_status_type,text)` implementation sets `account_status` to `active` or `pending_verification` without preserving `suspended` or `banned`. The #294 fix is source-only until the ordered migration chain is safely deployed.
5. **Report moderation write path and notification privacy remain P1.** Authenticated retains column-level UPDATE on report `status`, `admin_notes`, and `resolved_by_admin_id`; the Support UPDATE policy remains. The audited RPC exists, but the status-change notification still concatenates internal `admin_notes` into the reporter message.

These results confirm that green GitHub builds do not mean the Production database is remediated. All fixes remain gated on complete migration-history reconciliation, clean isolated Staging replay, role-matrix/negative tests, and explicit release approval. No Production writes were performed.


## Canonical branch remediation — 28 Nov 2026

The canonical integration branch now includes:
- `20261127191000_revoke_direct_report_moderation_updates.sql`: revokes table/column UPDATE from PUBLIC, anon and authenticated; drops the direct Support UPDATE policy; keeps SECURITY DEFINER `admin_resolve_report()` as the intended write path.
- `20261127001050_stop_leaking_internal_report_notes.sql`: unique migration version correcting a prior duplicate timestamp and removing internal notes from reporter notifications.
- Stage C contract checks C17–C19: direct grants/policy absence, Support RPC guard/row lock/audit, and notification text exclusion.

These are source-only. They have not been applied to Production or tested on isolated Staging. Public Talent rate-column exposure, migration-history mismatch, identity evidence, media policy, sanctioned-account state, and Realtime/chat findings remain release blockers pending full Staging replay and negative tests.


## Production advisor snapshot — 28 Nov 2026 (read-only)

Supabase Security Advisor returned these findings on the linked Production project:
- 5 `SECURITY DEFINER` functions executable by `anon`, including `guard_talent_media_moderation_fields()`, `can_read_talent_media_object(text)`, `has_admin_permission(text)`, `is_super_admin()`, and `is_talent_publicly_visible(uuid)`.
- 61 `SECURITY DEFINER` functions executable by `authenticated`. This is not automatically a vulnerability: each function needs a permission/body review; Admin RPCs commonly use an internal permission gate. Do not blanket-revoke grants without mapping client and policy dependencies.
- Auth leaked-password protection is disabled (one warning); enable after checking the Auth setting and communicating the sign-in behavior change.
- Three private-schema tables have RLS but no policies (`private.admin_accounts`, `private.admin_permissions`, `private.talent_service_locations`); verify they are intentionally inaccessible through exposed API roles.

Performance Advisor snapshot:
- 34 RLS policies re-evaluate auth/current_setting expressions per row (wrap stable auth calls in scalar SELECT where correct).
- 11 foreign keys have no covering index.
- 2 tables have multiple permissive SELECT policies.
- 45 indexes are currently unused; do not remove without workload and retention analysis.

Health Advisor returned no findings. These advisor snapshots are advisory and were read-only. They are not evidence that all application paths are secure; the five anon-executable functions, the 61 authenticated-executable definer functions, and password protection remain explicit review items. No Production setting, grant, policy, function, or migration was changed.

## Staging dependency

The Supabase project exposes only the `main` development branch, currently marked `MIGRATIONS_FAILED` (preview project status `ACTIVE_HEALTHY`). There is no separate healthy Staging branch to validate the 129-entry Production migration history and the current canonical PR migrations. Creating a dedicated development branch can incur hourly compute charges; do not create it until the organization and quoted cost are confirmed.


### Function-level review of anon-executable SECURITY DEFINER findings — 28 Nov 2026

Read-only inspection of Production function bodies and ACLs clarified the five warnings:
- `guard_talent_media_moderation_fields()` is a trigger-only helper. Its revoke migration already exists in this branch at `20261127001200_revoke_talent_media_trigger_helper_execute.sql`, but Production still shows default PUBLIC execution; Staging must verify the revoke, then the migration can be included in a controlled release.
- `can_read_talent_media_object(text)` is used by public Storage access logic and deliberately checks approved media/public visibility or the owner/Admin; do not revoke blindly because it can break media reads. Review path-guessing exposure and test exact Storage policies.
- `is_talent_publicly_visible(uuid)` supports public discovery and returns only eligibility visibility; it appears intentionally public but requires abuse/rate-limit review.
- `has_admin_permission(text)` and `is_super_admin()` return boolean checks based on `auth.uid()`; anon calls resolve without a signed-in identity. They are not privileged write RPCs, but can reveal permission-state booleans for authenticated callers. Consider moving client checks behind a minimal scoped RPC or tightening grants only after call-site/policy dependency mapping.

Do not treat the advisor's 5 anon warnings as five confirmed exploitable vulnerabilities. One is a known trigger-helper grant that has a source migration but is not yet applied; the other four require behavior-aware review. The 61 authenticated SECURITY DEFINER warnings also need allowlist/permission review; no blanket revoke is safe.
