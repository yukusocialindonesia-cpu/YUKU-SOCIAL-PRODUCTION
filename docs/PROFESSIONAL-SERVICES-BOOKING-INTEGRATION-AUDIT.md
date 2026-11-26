# Professional Services Booking — Integration Audit

## Scope and safety
This audit is based on read-only inspection of the production Supabase schema and function definitions. No SQL was executed against production except SELECT queries. No production rows, policies, functions, or schema were changed.

Professional-service listings remain browseable only. Do not enable booking/payment actions until all integration gates below pass.

## Confirmed legacy booking contract

The current `public.bookings` table requires all of the following:
- `activity_category_id` is NOT NULL and belongs to the legacy activity taxonomy.
- `booking_mode`, `start_time`, `end_time`, and `duration_hours` are required.
- `hourly_rate_snapshot`, `gross_amount`, `platform_fee_amount`, and `talent_gross_share` are required.
- Payment expiry, lifecycle timestamps, dispute state, and payment route are stored on the booking.

The current `public.create_booking` RPC:
- Requires an authenticated active customer, verified-18 flag, and verified KTP.
- Requires an active, verified-18 Talent user, approved Talent profile, and public visibility.
- Requires an active legacy activity category and an approved/active `talent_services` row.
- Derives online/offline mode from the legacy category and Talent profile.
- Uses hourly pricing, calculates a 20% YUKU fee / 80% Talent share, and accepts a maximum duration of five hours.
- Requires a start time at least two hours in the future.
- Uses Asia/Jakarta daily availability slots; configured schedules cannot cross midnight.
- Rejects creation if the customer already has any unexpired pending-payment booking.

These rules cannot represent professional service units such as per-session, per-day, or per-project without changing the booking contract.

## Financial and lifecycle dependency map

| Component | Current dependency | Professional-service requirement |
|---|---|---|
| `calculate_booking_financials` trigger | Reads legacy `talent_services`, profile hourly rates and `duration_hours`; writes financial snapshots | Branch by booking kind; never overwrite or reinterpret legacy hourly fields |
| `enforce_approved_talent_service_for_booking` trigger | Requires approved legacy service and active legacy category | Add professional listing validation while preserving legacy checks |
| `auto_generate_booking_financial_ledgers` | On payment settlement, writes `commission_records`, `talent_earnings`, and optional referral rewards | Continue using the same ledger with immutable professional price snapshots |
| `claim_booking_payment_route` | Locks one of Xendit/manual QRIS/manual bank transfer for a pending booking | Reuse only after the booking row can unambiguously identify its service kind |
| QRIS/bank proof RPCs | Require exact equality to `bookings.gross_amount`, pending state, and private proof object | Keep the same booking gross amount as the authoritative snapshot |
| `settle_booking_payment` | Server-only settlement; writes `payments` and changes booking to escrow-held | Keep server-only settlement and idempotency; validate professional booking kind and amount |
| `handle_booking_refund_financials` | Reverses or holds Talent earnings and referral rewards on dispute/cancel/refund | Preserve payout-allocation safeguards and referral behavior |
| Completion and payout | Booking completion and escrow release feed Talent earnings/payout allocations | Professional delivery acceptance must use the same completion and escrow safeguards |
| Status, notifications, chat, reviews | Multiple triggers and pages assume `public.bookings` | Audit every status consumer and UI label for service kind and pricing unit |

Other confirmed database functions in the booking lifecycle include:
- `expire_stale_booking_reservations`
- `confirm_booking_completion`
- `guard_booking_insert_status`
- `guard_booking_status_actor`
- `validate_booking_update`
- `log_booking_status_change`
- `close_qris_submissions_on_booking_inactive`
- `notify_admin_on_new_booking`
- `notify_on_booking_status_change`
- `guard_payout_completion_during_dispute`
- `admin_process_refund`
- `admin_review_qris_payment`
- `admin_review_bank_transfer_payment`

## Additional frontend dependency findings (branch audit)

The booking-history UI is not currently polymorphic:
- `src/pages/BookingHistoryPage.tsx` types `activity_category_id` as a required string.
- It builds `categoryIds` directly from every booking and queries `activity_categories` using those IDs.
- It renders `activityTitle`, `booking_mode`, `start_time`, and `duration_hours` as if every booking were an hourly activity.
- The same activity title and duration are passed into the booking chat context.
- The history page also owns customer payment panels, cancellation/report/review actions and status-specific UI. These must remain available for legacy activity bookings while professional service cards use their own snapshot label and unit/quantity.

Consequences:
- Making `activity_category_id` nullable before updating the history query and render model can produce invalid category lookups, blank labels, or incorrect activity assumptions.
- A professional booking cannot be represented safely by setting `duration_hours = 1` as a placeholder for a session/day/project. That would corrupt the booking display and can mislead finance/support.
- Do not expose a professional booking CTA merely because a professional listing is approved. The current public page correctly states that booking and payment are not open.

## Required frontend compatibility work

Before enabling professional booking:
1. Introduce a discriminated booking view model (`activity` vs `professional_service`) with a safe label and price-unit snapshot.
2. Make category enrichment conditional: only activity rows query `activity_categories`; professional rows enrich from immutable booking snapshots, not the current listing.
3. Update Booking History, chat context, customer/talent details, payment panels, cancellation/report/review UI, admin booking views, exports and finance summaries to render the correct kind.
4. Preserve legacy activity labels, rates, durations, payment instructions and state actions exactly.
5. Ensure customer and Talent views both resolve the provider/customer and service title without requiring a legacy activity category.

## Newly confirmed release blockers

- `bookings.activity_category_id` is a NOT NULL foreign key, and the legacy booking history currently assumes it is always populated.
- `calculate_booking_financials()` recalculates every inserted booking from legacy `talent_services` and profile hourly rates. It must branch by booking kind before any professional row can be inserted.
- The current `create_booking()` RPC only accepts a legacy activity category and hourly duration, with a five-hour cap. It must not be overloaded with fake category IDs or placeholder durations.
- The settlement ledger reads the booking's stored gross, platform fee and Talent share. This is reusable only after the professional booking RPC has frozen those values and the payment amount is checked against the same snapshot.
- The existing booking-history category lookup and chat payload must be migrated together with the database contract; changing only the database will leave frontend assumptions behind.

## Required additive data model

Preferred direction: extend the existing booking aggregate, not a parallel payment system.

Add a booking discriminator such as `booking_kind` with values `activity` and `professional_service`, plus a nullable `professional_talent_service_id` foreign key. Add a check constraint so each row has exactly one valid service reference:
- activity: legacy `activity_category_id` required, professional service ID null;
- professional service: professional service ID required, legacy category ID null.

Only after all dependent functions, constraints, policies, views, generated types, and clients have been updated should the legacy category column become nullable. Existing rows must be backfilled as `activity` and retain all original values.

Add immutable professional booking snapshots:
- service title and subcategory label;
- provider and customer IDs;
- pricing unit and unit rate;
- quantity and total gross;
- platform fee and provider share;
- selected delivery mode;
- service scope/description snapshot;
- start/end or agreed delivery deadline;
- cancellation and acceptance policy version.

Never calculate a historical professional booking from the provider's current listing price.

## Pricing semantics

- `per_hour`: quantity is hours, with an explicit maximum and time-slot conflict check.
- `per_session`: quantity is one session. Define duration or an agreed time window before accepting payment.
- `per_day`: quantity is whole/partial days under a documented rule. Support multi-day date ranges and overlap checks.
- `per_project`: quantity is one project or explicitly defined milestone. Store scope, deliverables, revisions, acceptance evidence and deadline before payment.

The provider must not be able to alter a booking's price, scope, delivery mode or deadline after payment. Any post-payment changes need an auditable amendment/consent flow.

## Mandatory implementation sequence

1. Inventory all foreign keys, check constraints, RLS policies, triggers, views, RPCs, Edge Functions, frontend queries, admin pages, finance reports and generated TypeScript types that reference `bookings` or legacy activity columns.
2. Design the additive schema and data backfill; do not apply it to production.
3. Refactor booking validation and financial snapshot calculation to branch on booking kind while preserving the exact activity path.
4. Add a dedicated professional booking RPC with row locks, customer eligibility checks, provider/listing/category approval checks, mode validation, schedule rules, duplicate pending-payment protection and server-calculated totals.
5. Update all payment, proof review, settlement, escrow, completion, cancellation, refund, dispute, commission, referral, payout, notification, chat, review, history, reporting and admin consumers.
6. Add automated tests for anonymous/customer/provider/admin/service-role actors and all four pricing units.
7. Run regression tests for every existing activity booking and payment route, including historical records.
8. Perform staging end-to-end testing and finance reconciliation before enabling any professional-service booking CTA.

## Release gate

No professional-service booking or payment CTA may be enabled until:
- Migration is validated in a disposable Supabase project.
- Existing activity booking regression suite passes.
- New pricing-unit calculations reconcile exactly across booking, payment, commission and earnings ledgers.
- Refund, dispute, cancellation and payout-allocation tests pass.
- RLS, RPC grants, SECURITY DEFINER search paths and server-only settlement permissions are reviewed.
- Mobile, Talent, customer, Admin and Finance workflows are signed off.

## Consumer matrix reference

The latest confirmed trigger/RPC/frontend/Edge Function consumer inventory is maintained in [`PROFESSIONAL-SERVICES-BOOKING-CONSUMER-MATRIX.md`](./PROFESSIONAL-SERVICES-BOOKING-CONSUMER-MATRIX.md). It records the confirmed high-risk subset and explicitly lists the remaining unverified surfaces; it is not yet a claim of exhaustive repository coverage.

## Current state
Professional-service taxonomy, provider applications, private document handling, admin review and public approved listings are in the feature branch. Booking/payment remains intentionally disabled. The production database has not been modified for this feature.


## Additional audit notes — latest branch pass

- Confirmed in the production schema (read-only) that `talent_profiles.id` is a foreign key to `public.users.id`. The application applicant ID therefore matches the Talent profile key model used by the professional listing FK; this specific mapping is not a blocker.
- The admin professional-service review page currently fetches only the newest 100 applications and filters the selected status in the browser. Older pending or needs-revision applications can be hidden when the queue exceeds 100 rows. This remains a release blocker for operational completeness; add server-side pagination or status-scoped pagination before launch.
- The admin review page previously ignored errors from the secondary Talent-profile hydration query and rendered a misleading “Talent tidak ditemukan” fallback. The feature branch now surfaces this query failure as an explicit warning instead.
- The review RPC and admin UI use a verification attestation. This is a human reviewer record, not automatic credential validation; the operating procedure must retain issuer, holder identity, validity, and scope checks.

No production writes were made during this pass. The schema check was read-only; the frontend warning fix and audit note are committed only to the feature branch.


## Admin queue pagination follow-up

The review page now applies the selected status filter in the database, retrieves 20 rows per page with an exact count, and uses created_at plus id as stable ordering keys. This replaces the previous newest-100 client-side filtering behavior. Concurrent inserts and review status transitions can still shift offset pages; a cursor-based pagination improvement may be appropriate at higher scale.


## Notification and applicant status follow-up

- Added an additive migration that uses the existing `public.notifications` table for new professional-service application confirmations, admin queue alerts, and applicant status-change notifications.
- Applicant notifications link to `/daftar-jasa-profesional`, where the applicant can read the current status and Admin note. Admin alerts link to `/admin/jasa-profesional`.
- Status notifications cover review started, needs revision, approval, rejection, and resubmission back to pending. Admins are also notified when a corrected application returns to the review queue.
- Notification trigger errors are caught and logged as warnings so a notification delivery problem cannot roll back an application submission or review.
- The existing notification bell already subscribes to inserts on `public.notifications` and routes using metadata; its empty-state copy now includes professional-service application updates.
- This is an in-app notification trail, not yet a dedicated immutable application-event ledger. A formal status-history timeline with actor and timestamp remains a separate enhancement if operations require audit-grade history.
- The migration is committed to the draft branch only. It has not been applied to production Supabase; runtime notification delivery and RLS/realtime behavior still require disposable-environment validation.


## Immutable application status history

- Added `professional_service_application_status_history`, an append-only record created by database triggers when an application is submitted or its status changes.
- Each event records the previous and new status, the note visible at that decision, actor user ID when available, actor class (Talent, Admin, or system), and timestamp.
- The table grants authenticated users read access only through RLS: applicants can see history for their own applications; Super Admins and admins with Talent permission can review the full queue history.
- No client insert, update, or delete policy is provided. The trigger function is SECURITY DEFINER with an empty search path; status and history writes commit atomically.
- Talent application history and Admin review cards now render the chronological timeline with actor class, timestamp, status transition, and recorded note.
- This is an application-status audit trail, not a full record of every field edit or a legal credential verification record.
- Migration is branch-only and has not been applied to production. RLS tests, actor attribution tests through the review RPC, and concurrent update tests remain part of staging validation.


## Provider eligibility and inactive taxonomy guard

- The final publication guard now rejects approved/active listings unless the provider has an approved Talent profile, the linked user account is not suspended or banned, the category and subcategory are active, and the listing delivery modes remain a subset of the subcategory's allowed modes.
- The public-read RLS policy independently applies the same account-status and taxonomy checks, so existing listings from suspended/banned accounts are hidden even if their listing row remains marked approved.
- The browse and application category queries now filter inactive subcategories from their embedded category results; inactive service types are not offered as selectable choices.
- The database trigger is a defense-in-depth guard for future write paths, not a substitute for reviewing the human credentials/attestation workflow.
- This migration is branch-only; no production database changes were made. Validate trigger behavior, account-status enum values, nested PostgREST filtering, and anon/authenticated RLS in a disposable Supabase project before rollout.


## Public provider directory pagination

- The professional-service discovery page no longer fetches only the first 100 listings. It now requests 40 rows per page with an exact count and a stable created_at/id order, then offers a load-more action.
- The count is based on listing rows (not unique Talent accounts), matching the one-card-per-service presentation.
- The UI relies on database RLS for provider approval/eligibility and does not silently discard fetched rows client-side, keeping the offset aligned with the number of rows actually fetched.
- Offset pagination can still shift if new listings are inserted while a user is paging; cursor pagination is a future scale improvement.


## Evidence access must succeed before approval

- The admin review UI already generates short-lived signed URLs for private credential and supporting documents and blocks approval when a required credential URL is unavailable.
- Hardened the approval action so it also blocks when any attached credential or supporting document cannot be opened through its signed URL. The same condition disables the approval button and is rechecked in the action handler, preventing accidental approval through a stale UI state.
- This remains a UI-level safeguard backed by the existing private-bucket RLS and RPC evidence-existence checks. It does not establish that a document is authentic or legally valid; an authorized reviewer must inspect issuer, holder identity, scope, and expiry.
- The signed URL is short-lived (5 minutes at generation). If it expires before inspection, the admin should refresh the queue to obtain a fresh link before approving. A future improvement is on-demand signed URL generation at the moment the reviewer opens an attachment.
- File MIME/size allowlists are configured on the private bucket and checked in the form, but browser-provided MIME metadata is not proof of file contents. Manual review remains mandatory; malware scanning and file-signature validation are not yet implemented.


## Cancellation, refund, commission and payout audit — 2026-11-26

This section is based on direct source inspection of migrations 21–29 and 45–46, plus finance RPC migrations 57–58. It is a repository-code audit, not a live transaction simulation.

### Confirmed existing rules

**Completion**
- Migration 21 requires both customer and Talent completion timestamps before a booking can become `completed`.
- `confirm_booking_completion` locks the booking row and records each participant's confirmation. The second confirmation completes the booking.
- Migration 20 schedules escrow release immediately on the transition to `completed`; migration 33 invokes the release worker every minute. Active open/investigating reports block release.
- This means the existing completion contract is two-party confirmation, not a 24-hour customer review period. Project delivery acceptance cannot safely be inferred from a due date or generic completion click.

**Talent cancellation**
- Migration 22 only permits Talent cancellation for paid/confirmed bookings whose payment is still `settled_held`.
- It creates a full refund request for the payment amount and changes the booking to `cancelled_by_talent`.
- Finance must perform the actual refund externally and record a provider/bank reference before the refund is marked processed. The database workflow itself does not transfer money.

**Customer cancellation**
- Migration 23 bases cancellation on `start_time` and remaining hours:
  - unpaid pending booking: cancellation without refund;
  - more than 24 hours: full refund;
  - 6–24 hours: half refund and half retained for Admin review;
  - under 6 hours: no automatic refund; full amount retained for Admin review.
- A customer cancellation case is unique per booking. The booking is then marked `cancelled_by_customer`.
- Migration 24 holds/reverses Talent earnings according to the retained amount and blocks reversal if payout has already been allocated or paid.
- Migration 26 provides Admin resolution for retained cancellation funds, records decisions and requires a real provider refund reference when returning funds.
- These time windows are activity-oriented and cannot be copied blindly to per-session, per-day, or project services. In particular, a project may have a due date rather than a single service `start_time`.

**Refund and ledger**
- Migration 29 makes ledger generation idempotent for a payment entering `settled_held`, including recovery from a previously failed payment. It independently inserts commission, Talent earning and referral reward rows.
- Refunds are manual operational workflows today. The code records provider references; it is not an integrated automatic provider refund API.
- Financial reversal checks protect earnings already allocated to payouts or paid out. A professional refund design must preserve these guards and handle partial refunds without marking the entire payment refunded prematurely.

**Commission and affiliate**
- The booking financial ledger stores gross booking amount, platform commission, Talent gross share, reserved referral payout and net platform revenue.
- Migration 45 configures a one-tier Talent affiliate commission (default 10% of platform commission, configurable and enable/disable). Migration 46 mirrors credited referral rewards into a separate affiliate earning ledger and lets the shared payout allocator allocate booking and affiliate earnings.
- Affiliate rewards are distinct from the service provider's booking earning. They must not be conflated with professional-service provider share.
- The affiliate percentage is read when payment settles; it is not visibly frozen as a booking-time policy field in the inspected function. If policy changes between booking and settlement, the resulting affiliate allocation follows the settlement-time setting. Decide whether that is intentional before extending to professional services.

### New professional-service risks / required changes

1. **Cancellation basis:** replace the assumption that every booking has one meaningful `start_time` with unit-aware policy inputs: start/end for hour/session, date range and defined working hours for day, and milestone/due-date plus work-start evidence for project.
2. **Partial refund accounting:** snapshot the agreed cancellation policy at booking creation; use a cumulative refund ceiling per payment; make repeated Admin actions idempotent; never exceed the original paid amount; keep partial refunds distinct from full payment-refunded status.
3. **Project work state:** add deliverable submission, revision count, acceptance, timeout and dispute states. Customer cancellation after work begins must not be decided using the activity's under-six-hour rule.
4. **Escrow:** only map professional work to `completed` after its own completion authority is satisfied. For projects, acceptance must be an explicit validated prerequisite before the generic release worker can see the booking as completed.
5. **Commission:** persist the exact professional fee-policy version and amounts at booking creation. Clarify whether affiliate commission is based on platform fee, whether it applies to all professional categories, and whether the percentage is fixed at booking or settlement.
6. **Payout:** preserve the single shared payout allocator and its row locks / available-balance checks. Verify that refund/dispute transitions can reverse both booking earnings and any affiliate reward without touching already allocated/paid amounts.
7. **Finance/admin:** extend booking kind, service unit, scope, cancellation policy and refund breakdown in finance views and exports; current finance RPCs return only booking code and status, which is insufficient context for project disputes.

### Product and policy decisions still required
- Cancellation/refund schedule for hourly, session, day, and project services.
- Whether professional services have the same two-party completion rule or a separate customer acceptance window.
- Project cancellation compensation after work starts, including partial work and non-refundable milestones (milestones remain out of MVP until separately modelled).
- Whether affiliate commission applies to professional services and which frozen base/rate applies.
- Whether the existing 20% platform fee applies to every professional category. Do not infer this from the legacy activity financial function.

### Release blockers
- No professional booking kind or booking RPC exists in the current implementation.
- No professional cancellation/refund policy snapshot exists.
- No project deliverable/acceptance state machine exists.
- No professional-specific finance/export view model exists.
- No automated provider refund integration was identified in the inspected migrations.
- Professional checkout must remain disabled until these are implemented and tested in a disposable/staging Supabase project.


## Support, disputes, evidence and admin operations audit — 2026-11-26

Source inspection: migrations 05, 12, 21, 25, 49–51 and professional-application migrations 20261126143000 / 20261126183000, plus the professional applicant/admin pages. This is a source review, not a live RLS penetration test.

### What already exists

- Booking-linked reports are restricted by a trigger to the booking's customer or Talent, and the reported user must be the other participant.
- Creating an open/investigating booking report automatically moves eligible booking states into `disputed_hold`. Earnings are also moved into a non-payable hold state.
- The report resolver can restore the prior booking/earning/referral states when no other open/investigating report remains.
- Scoped Admin permissions distinguish Support (reports), Finance (refunds/payout), Talent (provider verification), and Super Admin (global audit-log read).
- Professional-service applications have private evidence storage, applicant/admin-scoped read access, short-lived signed URLs, reviewer notes, and append-only status history. Applicant and Admin pages render the application status timeline.
- Approval requires a verification attestation note and the reviewer UI checks that required evidence can be opened before enabling approval.

### High-priority gaps found

1. **Report UPDATE can bypass the audited resolver.** Migration 12 grants authenticated UPDATE on `status`, `admin_notes`, and `resolved_by_admin_id`; migration 49 scopes that direct UPDATE policy to Support permission. The intended RPC `admin_resolve_report` writes an audit-log row and restores booking/earning state, but a Support user can also update those columns directly under RLS. That direct path can bypass the resolver's audit insert and its dispute restoration logic. Before launch, revoke direct UPDATE from authenticated and require status changes through the permission-checked RPC only.
2. **Report decision history is not append-only.** `reports_complaints` stores current status, current admin note, and one resolved-by user. The resolver writes an Admin audit log, but the report itself has no dedicated immutable event history for assignment, status transitions, evidence review, decision, or reopening. Add a report-event history table with actor, timestamp, prior/new status, note, and evidence references.
3. **Evidence contract is weakly modelled.** The base report table stores `evidence_urls TEXT[]`. The inspected report migrations do not define a dedicated private evidence bucket, ownership-scoped object path, MIME/size policy, retention rule, or signed-link review flow. Do not assume those text URLs are private or safe. Professional-service disputes need private, access-logged evidence objects, not public URLs.
4. **Resolver accepts broad status inputs.** The resolver accepts the report enum as `p_new_status` and permits an optional note; there is no explicit transition matrix or mandatory decision note in the inspected function. Define valid transitions (open → investigating → resolved/dismissed), require reason and outcome, and disallow ambiguous re-open/terminal transitions without an explicit new event.
5. **Support case operations are incomplete for professional work.** No professional deliverable evidence, revision-request thread, milestone acceptance, service-specific incident type, SLA/assignment, or customer-visible dispute timeline is present in the reviewed professional-service workflow. Existing booking reports cannot by themselves represent project acceptance and partial-work disputes.
6. **Verification lifecycle needs ongoing controls.** Application approval records the reviewer attestation, but the inspected application flow does not model credential expiry, revalidation reminders, suspension when a license expires, or an auditable re-check. A one-time approval must not be treated as permanent proof for credentials with expiry.
7. **Document review links are short-lived.** The Admin page creates signed URLs with a 300-second lifetime during queue loading. A reviewer who leaves the page open may encounter expired links. Add on-demand URL refresh when the reviewer opens a document and log document access; do not lengthen the signed URL lifetime as a substitute for access controls.

### Required admin/support workflow before professional checkout

- Case queue with owner/assignee, severity, SLA, status, booking/service context, and separate Support vs Finance actions.
- Immutable event timeline covering report creation, evidence upload/view, assignment, status changes, notes, decisions, refunds, compensation, and payout holds.
- Private evidence upload with applicant/participant ownership checks, object-level RLS, file allowlist and size cap, signed URL on demand, and retention/deletion policy.
- Professional project evidence model: deliverables, versioned revisions, customer acceptance/rejection reason, response deadline, and escalation to Support.
- One transactional resolution RPC coordinating report state, booking state, escrow/earning hold, refund/compensation ledger, and audit event. No direct client status updates.
- Credential expiry/revalidation and immediate listing suspension when a required authorization is expired, revoked, or under review.

### Release blocker
The Support direct-UPDATE bypass is a concrete authorization/audit-integrity gap in the reviewed migration chain. Close it and test Support-vs-Finance-vs-Talent-vs-Super-Admin role matrices in staging before enabling professional-service checkout. The existing application status-history feature is useful but does not replace a dispute/case event log.


## Account security, abuse prevention and customer/Talent protection audit — 2026-11-26

Source inspection: `AuthContext`, LoginPage, AccountManagementPanel, the `account-management` Edge Function, community moderation services/migrations, active-account session migration, review/report schema, and the live Supabase Security Advisor. This is a source/configuration audit; no penetration test, load test, or production write was performed.

### Controls already present

- Login verifies the matching `public.users` row and rejects accounts outside `active` / `pending_verification`; AuthContext re-checks role and account status and signs out restricted accounts.
- The account-management Edge Function validates the bearer token with Auth, confirms the acting Admin account is active, and requires Super Admin access. It prevents self-suspension through this panel, requires a reason, updates the database status with an optimistic condition, applies an Auth ban, and writes an Admin audit event. It attempts compensating rollback if Auth or audit persistence fails.
- Migration `20261124081950_enforce_active_account_sessions.sql` adds a restrictive authenticated RLS policy using `private.is_current_user_active()` to RLS-enabled public tables (except the self-readable `users` table), and a BEFORE write trigger across public table roots plus Storage objects. This is important defense in depth: a still-unexpired access token should not, by itself, allow authenticated table reads/writes after the account status becomes suspended/banned. The Auth ban blocks new login/session refresh; existing access tokens can remain cryptographically valid until expiry, but database policy/trigger checks are intended to deny their application access.
- Professional-service publication has a separate database guard that blocks active public listings when the provider is suspended/banned, unapproved, or the taxonomy/delivery mode is no longer eligible.
- Community content has bounded text lengths, owner-scoped insert/update, report target ownership, one pending report per reporter per target, and a Support/Super Admin-only moderation RPC. Moderation writes the actor, time, and note onto the content/report record.
- Booking reviews are unique per booking and rating is constrained to 1–5. Review visibility is controlled through RLS, with Talent-permission Admin read access.

### Gaps and release risks

1. **Pending-verification accounts pass the generic active-account guard.** The global helper treats both `active` and `pending_verification` as eligible for authenticated table access and writes. This may be intentional for onboarding, but it is broader than a blanket abuse-prevention rule. Define a table/action matrix for pending accounts; community posting/commenting, likes, reports, booking, payment, messaging and payouts should each have explicit verification requirements. Keep the stricter checks in the domain RPCs even if the generic guard remains permissive.
2. **No app-level abuse throttling was verified in the inspected community service.** Community posts/comments have length bounds and duplicate pending reports are prevented for the same target, but the client service simply submits inserts; no per-account/IP rate limit, cooldown, spam score, new-account posting limit, or automated abuse detection was found in the inspected code. Confirm Supabase Auth rate limits/CAPTCHA settings separately and add server-side throttling for public interaction endpoints. Client-side disabling alone is not a security control.
3. **Account ban is not instant cryptographic token revocation.** The UI correctly discloses that an already-issued access token may remain valid until expiry. The active-account RLS/write guards materially reduce this risk, but every SECURITY DEFINER RPC and Edge Function that reads or mutates private data must be checked for an explicit current-account-status gate, because SECURITY DEFINER can bypass ordinary RLS. Do not treat the global trigger as proof that all privileged read RPCs are covered.
4. **SECURITY DEFINER inventory needs manual authorization review.** The live Security Advisor (observed 2026-11-26 06:14 UTC) reports 5 SECURITY DEFINER functions executable by `anon` and 60 executable by `authenticated`. This lint is a permission inventory, not proof that all 65 functions are exploitable: some authenticated RPCs are intentionally callable and enforce role/ownership checks internally. Nevertheless, inspect each function body and grants, especially media access, Admin permission helpers, account summaries, payment instructions, booking, payout and moderation RPCs. Revoke anonymous EXECUTE wherever public access is not intended; keep only deliberately public, non-sensitive helpers.
5. **Leaked-password protection is disabled.** Supabase Auth Advisor explicitly reports compromised-password checking disabled. Enable leaked-password protection and confirm password strength, email confirmation, recovery flow, MFA policy for Admins, and Auth rate-limit/CAPTCHA settings in the Supabase Auth dashboard before public launch.
6. **Community moderation history is not fully append-only.** Moderation currently stores latest status/actor/note on the content/report row. There is no immutable event stream for repeat reports, moderator actions, appeals, or user sanctions. Add append-only moderation events and a separate account-sanction history with reason, scope, expiry, actor, appeal status and reversal.
7. **Community reports are not an account sanction system.** A moderator can hide/remove a post or comment or dismiss a report, but the reviewed RPC does not automatically warn, rate-limit, suspend, or ban an abusive account. Add graduated enforcement and an appeal path; do not auto-ban solely from raw report counts without anti-brigading safeguards.
8. **Booking review integrity requires staging tests.** The review table has one review per booking and a 1–5 constraint, but the inspected base table definition alone does not prove that every insert path verifies the booking is completed, paid, and belongs to the stated customer/Talent. Confirm the exact review insert RLS/trigger/RPC chain and test attempts to review another user's booking or an unpaid/cancelled booking.
9. **Credential and identity controls need operational lifecycle.** KTP/Talent verification and professional credential review exist, but credential expiry/revocation, re-verification schedule, document-access audit, and fast suspension/reinstatement procedures remain to be completed as noted above. Never expose KTP, bank details, or professional evidence through public buckets or unrestricted signed URLs.
10. **Edge Function CORS is wildcarded.** The account-management function returns `Access-Control-Allow-Origin: *`. Bearer-token and Super Admin checks still protect its actions, so wildcard CORS alone is not an authorization bypass; nevertheless, restrict allowed origins to the production app domains as hardening and verify no secrets are exposed to browser clients.

### Security Advisor interpretation

- Three RLS-enabled private tables (`private.admin_accounts`, `private.admin_permissions`, `private.talent_service_locations`) have no policies. This is deny-by-default, not evidence of public exposure; access should remain through narrowly permission-checked functions.
- Five anonymous SECURITY DEFINER grants require function-by-function review. Trigger-only functions should not be callable through the exposed RPC API.
- Sixty authenticated SECURITY DEFINER grants also require manual review, but the advisor warning does not establish that the functions lack authorization checks. Verify actor identity, role/permission, ownership, active account status, safe `search_path`, input validation and audit behavior for each.
- Leaked-password protection is explicitly disabled and should be enabled.

### Required pre-launch acceptance tests

- Suspended/banned user with an old access token cannot read private rows, write any application table, upload/download private Storage objects, call any privileged RPC, send messages, create bookings, submit payment proofs, request payout, or use referral/review/community actions.
- Pending-verification user can perform only the explicitly allowed onboarding actions; all other writes are denied server-side.
- Customer and Talent cannot spoof each other's IDs in booking, chat, review, report, payment, identity, or payout requests.
- Duplicate/replayed requests do not duplicate bookings, reports, reviews, payment proofs, ledger rows, or payouts; rate limits/cooldowns apply server-side.
- Admin permission matrix is tested for Support, Finance, Talent, Booking and Super Admin, including denied cross-permission actions and inactive Admin accounts.
- Review insertion requires a legitimate completed booking and exact participant IDs; one review per booking remains enforced.
- Abuse report brigading, false reports, moderator appeal, sanction expiry and reinstatement are tested.
- Auth leaked-password protection, email confirmation, recovery, CAPTCHA/rate limits, Admin MFA, CORS allowlist, and session lifetime are verified in project configuration.

### Current decision

Account status enforcement has meaningful database-level protection already; do not describe the old access-token lifetime as an unmitigated bypass. The release blockers are the unreviewed SECURITY DEFINER inventory, disabled leaked-password protection, unclear pending-verification permissions, and missing server-side anti-spam/rate-limit and sanction/appeal controls. Professional-service checkout remains disabled until the booking/finance/support gates and these account-safety gates pass staging.


## Focused live database review: identity, payout, booking chat and reviews — 2026-11-26

Read-only inspection of the connected production schema and function definitions. No test writes, migrations, or policy changes were performed.

### Confirmed payout authorization gap — HIGH PRIORITY

- `request_talent_payout(bigint,text,text,text,uuid)` is a SECURITY DEFINER RPC executable by authenticated users only. It checks `auth.uid()`, Talent role, active account, age verification, approved Talent profile, verified KTP, minimum Rp100,000, bank-field lengths, idempotency and exact reuse of idempotency key.
- However, the live `payout_requests` RLS also has `payout_requests_insert_talent` allowing an authenticated user to insert a row where `talent_id = auth.uid()`. Authenticated has column-level INSERT grants for payout_number, talent_id, amount, bank name/account/holder, payout_provider and payout_status. The table defaults idempotency_key and payout_status; the row can therefore be inserted without using the stricter RPC.
- The `validate_payout_request_before_insert()` trigger enforces minimum Rp100,000, locks the Talent profile and earning rows, checks available ledger balance, and rejects over-allocation. It does **not** repeat the active Talent + approved profile + age/KTP verified eligibility checks performed by the RPC. Other triggers force manual provider, reset some payout state fields, and allocate the requested amount to earnings.
- Therefore the direct INSERT path can bypass the RPC's identity/approval eligibility gate while still being constrained by available ledger balance and payout minimum. This is a confirmed policy/function mismatch, not merely an advisor warning.
- Recommended fix before any public payout launch: revoke direct INSERT privileges from authenticated and remove the owner INSERT policy; keep payout creation exclusively through the eligibility-checking SECURITY DEFINER RPC. Ensure RPC is the only public entry point and retain the ledger allocation trigger as defense in depth. Validate with role-matrix tests for active verified Talent, unverified Talent, pending Talent, customer account, suspended account, insufficient balance, duplicate idempotency and concurrent payout attempts.

### Identity data protection — controls verified

- Live `user_identities` has owner INSERT/UPDATE policies and column-level grants, but a BEFORE UPDATE trigger `protect_and_verify_user_identities()` blocks a non-reviewing owner from changing legal name, DOB, KTP number or KTP storage path once status is `pending_review` or `verified`. It also blocks applicant changes to reviewer decision fields. A separate trigger prevents self-assignment of verified status and clears reviewer fields on applicant insert.
- A further trigger ensures a row marked verified has an adult DOB, legal name, applicant-owned KTP document path and an existing object in the private KTP bucket.
- This means the broad owner UPDATE policy is not, by itself, a confirmed way to alter verified KTP identity data. Preserve and regression-test these trigger protections; do not remove them when refactoring the identity form.
- Residual operational gap: sensitive identity reads by authorized Admins should have explicit document-access logging, least-privilege access review, and a defined retention/deletion process. The inspected row policies do not themselves provide a dedicated immutable KTP view/download audit trail.

### Booking chat — participant scope present, abuse controls incomplete

- INSERT policy requires `sender_id = auth.uid()` and that the sender is either customer or Talent on the referenced booking.
- SELECT is limited to booking participants plus Admins with Booking permission. UPDATE is restricted to the other participant's message row, consistent with read-recipient updates.
- Message body is constrained to 1–1000 characters.
- No per-booking or per-account message frequency cap, flood cooldown, link/attachment abuse detection, block/mute control, or server-side spam throttle was identified in the live policies/constraints inspected. Add server-side throttling and abuse-report hooks; keep the participant RLS checks unchanged. Verify Admin access is logged and limited to legitimate support cases.

### Reviews — important integrity controls present

- INSERT policy binds `customer_id` to `auth.uid()`.
- BEFORE INSERT trigger checks that the booking exists, customer_id and talent_id exactly match that booking, and booking status is `completed`.
- Rating has a 1–5 constraint and booking review uniqueness was previously verified. This is a stronger control than a client-only review form; retain it and add tests for forged participant IDs, non-completed bookings and duplicate reviews.
- Residual gap: the reviewed schema does not establish a full anti-brigading or review-dispute workflow (for example, immutable moderation events and appeal evidence).

### Updated priority list

1. Remove direct authenticated INSERT on `payout_requests`; require the eligibility-checking payout RPC only. **Confirmed release blocker.**
2. Add immutable Admin document-access logs for KTP and bank details, plus retention and access-review controls.
3. Add server-side chat throttling and customer/Talent block/report controls.
4. Regression-test identity trigger protections and completed-booking review validation.
5. Continue the remaining SECURITY DEFINER inventory review function-by-function; current checks cover the named payout, identity, review and chat areas, not every privileged function in the project.


## Focused live payment-path audit: QRIS, bank transfer, Xendit — 2026-11-26

Read-only inspection of the connected production schema and the current PR branch Edge Functions/migrations. No payment was initiated, no files uploaded, no configuration changed, and no migration was applied.

### Current production configuration observed

- Server-side `system_feature_flags.payment_checkout` is currently **enabled**.
- QRIS setting is currently **active**.
- Bank transfer setting is currently **inactive**.
- The new-booking route claim function rejects a new Xendit route when `payment_route` is NULL; already-locked legacy Xendit bookings can retain their historical route.
- QRIS proof bucket and bank-transfer proof bucket are both private, with 5 MiB object limits and JPEG/PNG/WebP/PDF MIME allowlists. QRIS display bucket is public by design.
- These are live configuration observations, not a recommendation to toggle anything. No production configuration was changed.

### Controls verified

1. **Customer booking amount**
   - `create_booking(...)` calculates gross amount, platform fee and Talent share on the server from the approved Talent service rate and duration.
   - Customer is required to be active, age-verified, KTP-verified and a customer-role account; Talent must be active, age-verified, approved and publicly visible.
   - One active pending-payment booking per Customer is enforced.
   - `bookings` authenticated UPDATE grants are limited to `status`, `cancellation_reason` and `updated_at`; financial columns, booking parties, schedule and payment route are not directly writable by the browser.
   - The booking status actor trigger rejects a Customer/Talent attempting to mark a booking `paid_held_in_escrow`, `refunded` or `expired` directly. It requires backend/Admin authority for these states. Customer/Talent cancellation and Talent session transitions have separate actor checks.

2. **QRIS proof submission and approval**
   - Submission rows cannot be inserted/updated directly by authenticated clients; authenticated has SELECT only. The customer submission RPC verifies ownership, pending-payment state, expiry, exact `claimed_amount = bookings.gross_amount`, actual proof object existence, QRIS route lock, active QRIS configuration and one pending review at a time.
   - Finance approval RPC locks submission and booking rows, rechecks owner, amount, booking state, expiry, route and proof object, requires a transaction reference, prevents reuse of a reference, writes the payment at the database-calculated booking gross, moves payment to `settled_held` and booking to escrow, and writes an audit event.
   - The underlying QRIS review function is revoked from authenticated/anon; the Finance-checked wrapper is the supported client entry point.

3. **Bank-transfer proof submission and approval**
   - Submission rows likewise expose SELECT only to authenticated; writes are through the submission RPC.
   - The RPC checks booking owner, pending-payment state, expiry, exact claimed amount, bank-transfer route, saved account snapshot, proof object existence and pending-submission uniqueness.
   - Finance approval locks submission and booking, rechecks exact amount, expiry, route, account snapshot, proof object and transaction-reference uniqueness before creating/updating payment and moving booking into escrow. It writes an audit event and requires a non-empty admin note.

4. **Payment records and settlement**
   - Authenticated users have SELECT only on `payments`; no direct client INSERT/UPDATE grant was found.
   - Unique constraints enforce one payment row per booking, unique idempotency key and unique provider charge ID.
   - `settle_booking_payment` is not executable by anon/authenticated and is granted to service_role. It checks the provider allowlist, locks the booking, enforces expiry and payment-route consistency, calculates payment amount from `bookings.gross_amount`, and moves it to escrow.
   - The status guard prevents ordinary booking participants from manufacturing the paid/escrow state through direct table updates.

### Gaps and risks

- **QRIS upload policy is broader than the submission RPC:** the live Storage INSERT policy checks that the first folder segment is a pending booking owned by the uploader, but does not require `payment_route = 'manual_qris'`. The submission RPC later rejects the wrong route, so this does not itself approve or settle a payment; it can allow orphan/unsubmitted files to be uploaded against the user's other pending booking. Tighten the Storage INSERT policy to require the QRIS route lock and add per-booking upload/retry limits.
- **Repeated proof upload abuse:** both proof buckets allow multiple unique object paths while the booking is pending. The one-pending-submission partial unique index limits active review rows, not total uploaded objects or resubmission frequency after rejection. Add upload count/size quotas, retry cooldown and cleanup/retention for orphan/rejected proof objects. Keep the buckets private.
- **MIME metadata is not content validation:** Storage MIME allowlists and size limits are useful controls, but they do not prove the uploaded bytes match the declared file type or are malware-free. Add file-signature validation and malware scanning/quarantine before Finance reviewers open attachments.
- **Xendit has not been sandbox-verified:** both Edge Function source headers and prelaunch checklist explicitly state that sandbox end-to-end testing remains outstanding. The webhook checks callback token, external ID format, paid status, booking existence and exact amount, then calls a server-only settlement RPC. It does not explicitly assert callback currency is `IDR`, nor does it retrieve the invoice from Xendit to independently compare invoice ID/status/currency. Add currency validation and provider-side invoice reconciliation where supported before enabling this route. Test invalid token, wrong amount/currency, wrong route, expiry, duplicate callback, replay, provider timeout and concurrent callbacks.
- **Xendit route policy is intentionally disabled for new bookings:** `claim_booking_payment_route` rejects Xendit when a booking has no route yet; only an already-locked legacy Xendit booking can continue. Do not bypass this guard merely because the checkout Edge Function still exists in the repository.
- **Checkout readiness is not proven by a feature flag:** production server flag is currently true and QRIS active, but no live payment test was performed in this audit. Keep professional-service checkout disabled until the dedicated booking, settlement, refund, escrow, dispute and payout flow has passed staging acceptance tests.

### Payment audit acceptance tests

- Customer cannot change gross amount, fee, Talent share, customer/Talent IDs, or payment route through direct table updates.
- Customer/Talent cannot set paid, refunded or expired booking status; valid cancellation/session transitions remain available only to the correct actor.
- QRIS/transfer submission cannot claim an amount different from the booking gross; wrong owner, wrong route, expired booking, missing proof object and duplicate pending submission all fail.
- Finance-only approval; Support/Talent/Booking roles cannot approve payments. Duplicate transaction references fail.
- Payment row is unique per booking; duplicate/replayed settlement does not duplicate ledger/earnings or release escrow twice.
- QRIS and bank-transfer proof reads remain limited to the owner and Finance; no public proof URL; delete while pending review is blocked.
- QRIS upload against a booking not locked to QRIS is rejected; upload flood and repeated rejected-proof uploads are throttled and cleaned up.
- Xendit sandbox: callback token mismatch, invalid external ID, wrong amount, wrong currency, wrong invoice, expired invoice, wrong payment route, duplicate/replay and concurrent webhook tests.
- Verify live flag and provider settings against the intended launch plan before any launch change; do not rely on frontend environment flags alone.


## Focused live financial-ledger, escrow, referral and payout audit — 2026-11-26

Read-only production inspection. No financial records were changed and no payout/escrow operation was executed.

### Controls verified

1. **Payment-to-ledger idempotency**
   - On transition to `settled_held`, the payment trigger creates one `commission_records` row and one `talent_earnings` row per booking using `ON CONFLICT (booking_id) DO NOTHING`.
   - Referral reward is created at most once per booking. It uses the referral relationship active at payment settlement, and the configured affiliate percentage is constrained to 0–100%.
   - Booking, commission, Talent earning and referral reward ownership/amount relationships are protected by unique keys, foreign keys and database-side calculation.
   - Authenticated users have no direct INSERT/UPDATE/DELETE grants on the ledger, commission or payout-allocation tables.

2. **Escrow release**
   - `process_escrow_release()` is service-role-only for normal application execution.
   - It selects completed bookings whose scheduled release time has arrived, excludes bookings with open/investigating reports, requires a settled-held payment, held Talent earning and commission record, and uses `FOR UPDATE ... SKIP LOCKED`.
   - It moves Talent earnings to available, credits pending referral rewards (which then synchronize to the affiliate ledger), and marks the payment released. State predicates make repeat processing effectively idempotent.
   - Dispute resolution restores prior booking/earning/referral states when the last active report closes. Payout completion is separately blocked when a reserved allocation contains an earning in `disputed_hold`.

3. **Payout allocation**
   - The payout insert trigger locks the Talent profile and eligible earning rows, computes available balance from both Talent and affiliate ledgers, then reserves exact amounts in allocation rows. If it cannot fully allocate the requested amount, the transaction raises and rolls back.
   - Allocation rows enforce exactly one source earning, positive amount and foreign keys. Earning rows constrain allocated plus paid-out totals not to exceed the earning amount.
   - Payout completion converts reserved allocations to settled and increments paid-out amounts; rejection/failure releases reservations. Finance status changes require the Finance permission, valid state transition and a provider reference to complete. Audit logs capture old/new payout request state.
   - Concurrent requests are serialized on the Talent profile row in the insert trigger.

4. **Referral relationship and rewards**
   - Self-referral is blocked in both RPC and database constraint; one referral relationship per invited Talent is enforced by a unique key.
   - Referral rewards and affiliate earnings are unique per booking/reward. The affiliate ledger is only created when the reward becomes credited at escrow release.
   - The current production integrity snapshot returned zero mismatches for commission arithmetic, Talent earning ownership/amount, referral reward relationship/booking/commission base, affiliate reward ledger amount/owner, and non-terminal payout allocation totals. Five commission rows were present in that snapshot. This is a consistency snapshot only, not a proof of future correctness.

### Confirmed release blocker (reconfirmed)

- Live `payout_requests` still has an authenticated owner INSERT RLS policy and column-level INSERT grants. The trigger checks minimum amount and available ledger balance and reserves funds, but it does not repeat the payout RPC's eligibility checks (active Talent role, approved Talent profile, age verification and verified KTP). A caller can therefore bypass the stronger `request_talent_payout(...)` validation by inserting directly, subject to the balance/minimum constraints.
- Required remediation remains: revoke authenticated direct INSERT on `payout_requests`, remove the owner INSERT policy, and retain the SECURITY DEFINER payout RPC as the only client entry point. Keep the balance/reservation trigger as defense in depth. Add tests proving unverified, pending, suspended and non-Talent accounts cannot create payout requests by either route.
- This was observed in production metadata but was not changed in production or this audit pass.

### Additional controls to tighten

- `admin_process_payout` records the Finance actor and provider reference, but the current manual workflow relies on the Finance operator entering a reference. Add a second-person approval or reconciliation evidence for high-value payouts, and a daily bank-statement/provider reconciliation before treating the state as final.
- Referral application RPC checks that the referee has a Talent profile and prevents self-referral/reuse, but does not explicitly require the referrer to be an active, approved Talent at relationship creation. Define whether inactive/unapproved referrers should be eligible; if not, enforce that at creation and recheck eligibility at reward-credit time.
- Keep a dedicated immutable payout event history (requested, processing, rejected/failed, provider-confirmed, reservation rows) and reconcile it to provider/bank statements. Existing Admin audit log is useful but not a replacement for a domain event ledger.
- Commission and affiliate settings should be snapshotted per booking at settlement (the current referral percentage is read at payment settlement). Confirm whether that is the intended commercial rule; if a booking quote must lock the affiliate rate, snapshot it at booking creation instead.

### Financial acceptance tests

- Replaying a paid webhook cannot create duplicate commission, Talent earning, referral reward or affiliate earning rows.
- Escrow release skips open/investigating reports, runs safely under concurrent workers, and cannot release twice.
- Refund/dispute transitions cannot leave an earning available while its booking/payment is held or refunded; already allocated/paid-out earnings must enter Finance review rather than silently decrement.
- Parallel payout requests cannot reserve the same earning twice; rejected/failed requests release exactly their own reserved allocations; completed payout settles each allocation once.
- Direct authenticated INSERT into payout_requests is denied after remediation; payout RPC enforces active Talent, approved profile, age and KTP checks.
- Referral self-referral, second referral assignment, inactive/unapproved referrer (per policy), duplicate reward and duplicate affiliate-ledger creation are rejected.
- Daily reconciliation: payout request amount equals reserved/settled allocations; each earning satisfies `allocated + paid_out <= earning amount`; commission arithmetic and referral reserve remain within platform commission.
