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
