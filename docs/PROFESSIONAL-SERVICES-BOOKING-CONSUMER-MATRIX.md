# YUKU Professional Services — Booking Consumer Matrix

Audit date: 2026-11-26  
Source: read-only inspection of production Supabase catalogs/function definitions and repository frontend/Edge Function sources. No production writes were performed.

## Decision

Professional booking must be a new kind inside the existing `public.bookings` aggregate, with an additive immutable snapshot contract. Do not create a parallel payments/earnings/payout system and do not route a professional listing through `create_booking()`.

The first release must keep project bookings out of automatic escrow release until an explicit deliverable acceptance and timeout policy is designed.

## Database trigger inventory — confirmed on `public.bookings`

| Trigger | Timing | Compatibility work |
|---|---|---|
| `trg_calculate_booking_financials` / `calculate_booking_financials()` | BEFORE INSERT | Critical. Currently always reads legacy `talent_services`, `activity_categories`-related service rates and profile hourly rates; multiplies by `duration_hours`; writes 20%/80% financial snapshots. Must branch by booking kind and preserve the activity branch exactly. |
| `trg_enforce_approved_talent_service_for_booking` / `enforce_approved_talent_service_for_booking()` | BEFORE INSERT or UPDATE of Talent/category | Critical. Currently requires an approved active legacy `talent_services` row. Add professional-listing validation without weakening the activity check. |
| `trg_guard_booking_insert_status` / `guard_booking_insert_status()` | BEFORE INSERT | Keep all new bookings at pending-payment; professional RPC cannot set paid/approved state. |
| `trg_guard_booking_status_actor` / `guard_booking_status_actor()` | BEFORE UPDATE | Audit actor rules and transition matrix for professional acceptance, cancellation, dispute, refund, and Admin actions. |
| `trg_validate_booking_update` / `validate_booking_update()` | BEFORE UPDATE | Critical. Protects current financial fields, parties and legacy category, and freezes legacy schedule/location after payment. Extend to protect every professional snapshot, unit, quantity, scope, fee-policy version, delivery deadline, and amendment references. |
| `trg_handle_booking_refund_financials` / `handle_booking_refund_financials()` | AFTER UPDATE | Critical. Reverses/holds Talent earnings and referral rewards based on booking status. Preserve allocation/payout guards for professional bookings. |
| `trg_close_qris_submissions_on_booking_inactive` | AFTER UPDATE of status | Ensure professional status changes close pending payment proofs identically. |
| `trg_log_booking_status_change` | AFTER INSERT or UPDATE of status | Reuse audit history; ensure booking-kind snapshots are available to support/admin views. |
| `trg_notify_admin_on_new_booking`, `trg_notify_booking_status_change` | AFTER INSERT / status update | Add professional service title, unit and date context to notifications; do not expose private project/evidence data. |
| `trg_set_booking_completion_timestamps` | BEFORE UPDATE | Current completed status schedules escrow release immediately. Must not auto-release a project booking merely because its due date elapsed. |
| `trg_guard_active_account_write` | BEFORE INSERT/UPDATE/DELETE | Retain account suspension/banned-user protections for both booking kinds. |

## Confirmed database RPC and ledger dependencies

| Function | Existing behavior | Required professional behavior |
|---|---|---|
| `create_booking()` | Legacy activity-only RPC; category, hourly duration, schedule, Talent service and customer eligibility checks. | Leave unchanged for activity. Add separate `create_professional_service_booking()` with listing row lock, quantity/unit validation, eligibility, schedule/capacity, idempotency, and server-calculated totals. |
| `claim_booking_payment_route()` | Locks one payment route per booking; new checkout is limited to manual QRIS and bank transfer. | Keep route immutable, verify active method settings, and retain server-side amount/proof validation. Xendit is retired. |
| `settle_booking_payment()` | Server/service-role-only settlement; writes `payments` and moves booking to escrow-held. | Reuse only against frozen gross and fee snapshots; enforce payment amount/provider/charge idempotency for each kind. |
| `auto_generate_booking_financial_ledgers()` | On payment settlement, creates commission, Talent earning and optional referral reward using booking gross/platform fee/provider share; referral reward is currently calculated from platform fee. | Reuse the same ledgers, with professional fee-policy version and immutable fee/provider-share snapshots. Never recompute from current listing rate. |
| `submit_qris_payment_proof()`, `submit_bank_transfer_payment_proof()` | Customer-owned proof submission; exact amount equals booking gross; private storage object must exist. | Reuse after booking kind is represented; ensure proofs remain scoped to the booking and amount snapshot. |
| `admin_review_qris_payment()`, `admin_review_bank_transfer_payment()` | Locks submission/booking, verifies owner, exact amount, expiry and payment route, then settles manual payment. | Same checks for professional bookings; no special client-supplied amount authority. |
| `confirm_booking_completion()` | Two-party confirmation for `in_progress` booking. | For hour/session/day, retain dual confirmation or documented policy. For project, add deliverable submission, included revision count, customer acceptance window, and dispute path. |
| `admin_process_refund()`, `handle_booking_refund_financials()` | Refunds reconcile against payment, booking, cancellation case, earning and referral reward; guards against already allocated/paid earnings. | Reuse only with the original professional snapshots and allocation guards; project cancellation/refund must account for accepted milestones only if milestone support is later added. |
| Payout RPCs and allocation triggers | Payouts consume available Talent earnings and affiliate earnings, locking rows and preventing overspend. | Professional earning entries must be indistinguishable ledger-safe rows tied to the same booking; no direct balance mutation. |

## Confirmed frontend and Edge Function consumers

| Consumer | Current assumption | Required work |
|---|---|---|
| `src/pages/BookingHistoryPage.tsx` | `activity_category_id` is required; every row enriches from `activity_categories` and renders start time/duration as hours. | Discriminated view model; category lookup only for activity; professional snapshot label/unit/quantity/date/scope. Preserve existing payment, cancel, report, refund, and review actions. |
| `src/pages/TalentDashboardPage.tsx` | Booking model uses activity category, booking mode and duration; derives activity title and aggregates completed bookings. | Add professional snapshot display; ensure completed count and earnings aggregate both kinds without losing old activity display. |
| `src/pages/TalentDetailPage.tsx` | Creates legacy bookings through `create_booking()` with activity category and hourly duration; confirmation UI renders hours. | Keep this path activity-only. Add a distinct professional profile/checkout flow rather than adding professional options to this legacy form. |
| `src/components/chat/BookingChatModal.tsx` | Booking chat context displays `duration_hours` and schedule as hours. | Render professional service snapshot title, unit/quantity, and deadline/session window; retain booking_id chat isolation. |
| `src/components/booking/QrisAdminPanel.tsx` and `BankTransferAdminPanel.tsx` | Admin proof queues use booking IDs and status lookup; amount/proof are shown without service-kind details. | Payment approval remains booking-aggregate based, but add kind-aware summary and reconcile claimed amount to the same gross snapshot. |
| `src/types/database.ts` | Generated/manual TypeScript booking row type requires `activity_category_id` and hourly fields. | Regenerate/update the booking type with discriminated nullable legacy/professional references and snapshot fields only after the migration contract is approved. |
| `src/utils/supabaseMarketplace.ts` | Queries legacy `talent_services` and activity category IDs for marketplace availability. | Keep it limited to activity discovery; professional discovery must use separate taxonomy/listing queries. |
| `src/pages/AdminPage.tsx` | Admin booking rows and gross marketplace volume use generic bookings; service approval lists query legacy `talent_services`. | Show booking kind and snapshot details in support/finance views; include professional applications/listings in separate queue, not legacy service tables. |
| `account-management` Edge Function | Counts bookings/payments/refunds via `bookings` joins. | Keep aggregates booking-kind neutral; add kind-specific support detail only where needed. |
| Customer payment panels | Manual QRIS and bank transfer only. | Keep ownership, exact amount, expiry, private proof and Finance review checks. |
| Payment panels, chat, reviews, reports, exports and finance pages | Not fully enumerated in this pass. | Search all booking consumers before schema changes; do not treat this matrix as exhaustive. |

## New findings from this pass

1. **Two booking insert triggers hard-code legacy activity service logic.** Updating only the RPC or nullable category FK is insufficient: `calculate_booking_financials()` and `enforce_approved_talent_service_for_booking()` must be branched before any professional row is inserted.
2. **Financial snapshots are the ledger contract.** `auto_generate_booking_financial_ledgers()` reads `gross_amount`, `platform_fee_amount`, and `talent_gross_share` from the booking. The professional booking RPC must create those correctly and freeze them before payment settlement.
3. **The current fee rule is 20% YUKU / 80% Talent in the legacy calculation.** Do not silently assume this is approved for every professional service class. Product/Finance must approve the professional fee policy; store a policy version with the booking snapshot.
4. **Project acceptance is structurally different.** The current completion RPC requires `in_progress` and both customer and Talent confirmations; the completion timestamp trigger schedules escrow release immediately when status becomes completed. Project escrow needs a distinct reviewed acceptance path before it can be enabled.
5. **Current Xendit route lock intentionally blocks new Xendit selection when payment_route is null.** Existing checkout Edge Function still calls that route-claim RPC. Treat this as current payment configuration, not a reason to bypass the route lock for professional services.
6. **Frontend polymorphism is a broad migration.** Booking history and Talent dashboard are confirmed activity-specific; Admin and account-management views also consume generic booking rows. Chat, support, payment, export and finance consumers still need a complete repository-wide inventory.

## Safe implementation order

1. Finish the complete code/schema inventory (all `bookings` selects/updates, `bookings!` joins, triggers, RPCs, views, storage policies, Edge Functions, generated types, exports, chat and reports). Confirmed frontend files include BookingHistoryPage, TalentDashboardPage, TalentDetailPage, BookingChatModal, AdminPage, QrisAdminPanel, BankTransferAdminPanel, supabaseMarketplace and database.ts.
2. Approve the professional fee policy and initial project acceptance/cancellation policy with Product/Finance.
3. Add the booking discriminator and immutable snapshot fields additively; backfill all existing rows as `activity`. Do not drop NOT NULL from `activity_category_id` until every dependent object and client has migrated.
4. Refactor the two insert triggers and update immutability/status guards with an explicit activity path and a professional path.
5. Implement a dedicated idempotent professional booking RPC and booking-kind-aware availability/capacity locks.
6. Update payment, ledger, refund, dispute, payout, notification, chat, review, history, Talent, Admin and finance consumers.
7. Test both booking kinds, all four pricing units, concurrency, duplicate RPC requests, route locks, exact payment reconciliation, refunds and payout allocation in disposable Supabase.
8. Keep professional checkout disabled until all gates pass.

## Not done / not claimed

- This pass did not enumerate every repository reference to `bookings`, every view, every Edge Function, every storage policy, or every frontend workflow. The inventory is a confirmed high-risk subset and a continuation checklist.
- No migration, RPC, trigger, RLS policy, payment setting, or production row was changed.
- No CI, staging migration, payment sandbox, or end-to-end test is claimed as passing.


## Expanded consumer inventory — confirmed repository search (2026-11-26)

The following additional consumers were verified by searching the repository and reading the current source files. This is a source-level inventory, not proof of staging or production runtime behavior.

### Payment UI and proof review
- `src/components/booking/QrisCustomerPaymentPanel.tsx`: accepts a booking ID, amount and status; submits the client-provided amount as a claim to the proof RPC. The server RPC must continue to compare this claim to the immutable booking gross; professional UI must pass the booking snapshot amount only.
- `src/components/booking/BankTransferCustomerPaymentPanel.tsx`: obtains booking-scoped bank instructions and submits a proof with the amount. Must display the professional booking's frozen total and must not derive it from the current listing.
- `src/components/booking/XenditCustomerPaymentPanel.tsx`: invokes `create-checkout` with booking ID. Edge Function remains authoritative for ownership, pending state, expiry and amount.
- `src/components/booking/QrisAdminPanel.tsx` and `BankTransferAdminPanel.tsx`: review proof queues keyed by booking ID and query booking status. Add booking-kind and snapshot context to the review details, while retaining the existing server-side exact-amount checks.
- The current migration `20261124172000_block_new_xendit_route_claims.sql` deliberately blocks new Xendit route claims. Do not bypass this for professional services; payment-route activation is a separate release decision.

### Chat, admin and generated types
- `src/components/chat/BookingChatModal.tsx`: `ChatBookingSummary` currently requires `start_time` and `duration_hours`, and labels the activity title. Replace this with a discriminated summary using professional snapshots for session/day/project bookings.
- `src/pages/AdminPage.tsx`: `AdminBookingItem` currently requires legacy `booking_mode`, `start_time`, and `duration_hours`; the booking review table and finance context need kind-aware labels and schedule/scope.
- `src/types/database.ts`: the central `BookingRow` model currently represents the legacy required activity category and hourly duration. Update only alongside the additive database contract; avoid weakening types before the database constraint and consumers are migrated.
- `src/pages/BookingHistoryPage.tsx` and `src/pages/TalentDashboardPage.tsx` remain confirmed activity-specific consumers. Their customer/Talent actions must remain intact for legacy rows.

### Escrow and refund semantics
- `supabase/migrations/20_immediate_escrow_release_policy.sql` sets `escrow_release_scheduled_at` to the completion timestamp immediately when a booking transitions to `completed`; the scheduled worker in migration 33 releases held earnings once no open/investigating report exists. Therefore project deliverable acceptance cannot be represented by simply reusing the existing completion transition before acceptance.
- `supabase/migrations/24_hold_talent_earnings_during_customer_admin_review.sql` prevents cancellation reversal where earnings have already been allocated or paid and holds earnings during a retained-amount review. Professional cancellation/refund must preserve these allocation and payout guards.
- Migration 20 also updates historical completed bookings. Any professional-specific behavior must be gated strictly by booking kind so the activity release policy is unchanged.

### Release gates added by this expanded inventory
1. Keep the existing activity RPC, activity financial trigger branch, completion semantics and payment proof RPC behavior regression-tested.
2. Add booking-kind-aware view models to chat, booking history, Talent dashboard, Admin booking views and all payment proof surfaces before nullable legacy category references are introduced.
3. Keep professional projects out of the current immediate-completion/escrow-release path until deliverable submission, included revision count, customer acceptance, timeout and dispute rules are implemented and tested.
4. Keep Xendit unavailable while the current route-lock policy blocks new claims; do not create a frontend-only bypass.
5. Test the exact same frozen gross against checkout, manual QRIS/bank proof, webhook settlement, ledger generation, refund reversal, payout allocation and reconciliation.
6. Search results also identified reports, reviews, referral rewards, finance/admin RPCs and account-management booking joins. These remain in scope for a final exhaustive migration checklist; this document must not be treated as a claim that every booking consumer has already been updated.

## Consumer audit continuation — operational, finance and payout details (2026-11-26)

### Confirmed blockers from direct source inspection

| Surface | Concrete legacy coupling | Required change before professional checkout |
|---|---|---|
| Customer booking history | BookingHistoryPage builds category IDs from every booking, queries activity_categories, renders duration_hours as hours, and passes duration to chat. Payment panels use gross_amount and the existing payment route. | Filter category IDs to non-null activity rows; use booking-kind snapshots for professional title/unit/quantity/schedule; make duration optional; keep payment panels bound to frozen gross. |
| Talent dashboard | TalentDashboardPage selects activity_category_id, duration_hours, legacy booking mode/location and maps category title; action UI displays duration in hours. It uses shared talent_earnings and talent_affiliate_earnings ledgers for balances and payout history. | Add a professional discriminator and render the service snapshot/unit; keep action and earnings logic on the same booking/earning aggregate. Do not invent a duration for per-session/day/project rows. |
| Chat | ChatBookingSummary requires duration_hours; modal header formats duration_hours as hours. | Accept a discriminated summary with professional service label, pricing unit/quantity, and either booked slot or project deadline. Chat remains keyed by the same booking ID. |
| Admin booking list | Super Admin reads bookings.*; scoped Admin calls get_admin_bookings(), whose return contract explicitly includes booking_mode, start_time, duration_hours, and meeting location. | Extend the RPC with booking kind and safe professional snapshot labels; preserve current columns for activity rows and update Admin UI types/rendering in lockstep. |
| Admin finance / refund labels | Finance labels RPC returns only id, booking_code; finance screens join refunds and cancellation cases to this code. | Keep booking code stable; add a separate kind-aware, permission-scoped summary RPC if Finance needs service/unit/quantity context. Do not expose private project scope or uploaded verification evidence in finance labels. |
| Finance overview | Admin overview totals completed booking gross_amount and platform_fee_amount from loaded booking rows. | Confirm finance permission holders also receive the intended booking aggregate; explicitly include both booking kinds exactly once and reconcile totals to payments/ledger, not duplicated joins. |
| QRIS / bank-transfer admin review | Both queues fetch booking status by booking ID and only permit approval for pending_payment; the queue does not show service-kind context. | Preserve the status gate and exact amount server checks; show a safe booking summary so Finance can identify a professional service without reading private documents. |
| Payout ledger | Talent dashboard aggregates shared talent_earnings and affiliate ledger; payout allocation logic reserves rows from these ledgers. | Insert professional earnings into the existing booking earnings ledger only after settlement; maintain booking_id uniqueness, frozen net earning, dispute holds, allocation and reversal checks. No parallel professional wallet. |

### Additional confirmed database contract

- get_admin_bookings() is a typed table-returning RPC with legacy duration_hours and booking_mode fields. Its return contract must be changed with a coordinated drop/recreate or compatible versioned RPC; simply adding columns to the underlying table does not make its result polymorphic.
- get_admin_finance_booking_labels() and get_admin_finance_booking_statuses() are permission-gated SECURITY DEFINER RPCs scoped to finance; retain those guards if adding a kind-aware summary.
- 20_immediate_escrow_release_policy.sql schedules escrow release at completion_confirmed_at when a booking reaches completed, and its worker releases eligible held earnings when the schedule is due and there is no open/investigating report. Project completion therefore cannot reuse this status transition until acceptance/timeout policy is explicit.
- Existing payout allocation is ledger-based, not computed from booking rows at withdrawal time. This supports a single booking aggregate for both service kinds, provided professional booking settlement writes the same immutable earning and commission snapshots and refund/dispute paths preserve existing guards.

### Next implementation sequence

1. Finalize a booking snapshot schema with nullable legacy category only after all consumers are updated; include booking_kind, professional listing FK, immutable service/category labels, pricing unit, quantity, gross, fee, Talent share, delivery mode, and the appropriate booked slot or delivery deadline.
2. Update shared TypeScript booking types and view models; then update BookingHistory, TalentDashboard, chat, Admin list and payment-review summaries.
3. Keep existing booking completion, cancellation, refund, QRIS/bank proof, Xendit and payout paths unchanged for activity rows; add explicit professional branches with the same server-side ledger protections.
4. Add automated contract tests covering activity regression and professional hourly/session/day/project flows, including no accidental hour conversion and no early project escrow release.
5. Only after those checks, consider enabling professional checkout. This branch remains unmerged and production remains untouched.
### Final source checks in this pass — types and checkout settlement

- `src/types/database.ts` defines `BookingRow.activity_category_id: string` and `duration_hours: number` as required legacy fields. These must become a discriminated type only in the same change set as the database migration and all consumers; changing only the interface would conceal runtime nulls.
- `get_admin_bookings()` returns a fixed legacy row shape with duration and booking mode. A safe migration must version or recreate this RPC and update the scoped Admin consumer in the same release.
- `QrisCustomerPaymentPanel` and `BankTransferCustomerPaymentPanel` send the displayed amount as `p_claimed_amount`; the server remains authoritative and must compare it to the booking gross snapshot. Bank transfer instructions also return a server-calculated `gross_amount`.
- `create-checkout` reads booking ID, owner, status, gross and expiry, then asks the authenticated user client to claim the route before creating the Xendit invoice. `xendit-webhook` compares provider paid amount to `bookings.gross_amount` before calling service-role `settle_booking_payment()`.
- These checkout paths are structurally reusable if professional bookings are represented in the same bookings table and gross snapshot. They still require explicit kind eligibility, payment route availability, provider event/charge idempotency review, and exact currency validation before release.
- No evidence from this source inspection authorizes enabling Xendit: the current route-lock migration deliberately blocks new route claims. QRIS/bank transfer remain subject to their existing server-side exact-amount and pending-booking checks.

## Cancellation, refund, dispute and escrow audit — direct migration inspection (2026-11-26)

This is a source-level audit of the current activity booking financial lifecycle. It does not change the existing activity behavior and does not authorize production migration.

### Confirmed existing behavior

| Component | Current behavior | Professional-service compatibility |
|---|---|---|
| `request_customer_cancellation()` (migration 23) | Locks booking; allows pending payment, escrow-held and talent-confirmed states; rejects cancellation once `start_time <= now()`; unpaid bookings create a zero-value case; paid cancellation uses time remaining until `start_time`: >24h full refund, 6–24h half refund with retained amount pending Admin review, <6h no automatic refund and Admin review. | Not compatible as-is with per-day/per-session/project services. The policy is hard-coded to a single `start_time` and hour windows. Professional policy must use the immutable booking unit and its approved cancellation cutoff; do not map a project deadline or multi-day window into `start_time`. |
| `request_talent_cancellation()` (migration 22) | Allows only escrow-held or talent-confirmed bookings; creates a full refund request for the full settled payment; changes booking to `cancelled_by_talent`. | Can be reused only if the professional service policy approves full refund for Talent cancellation and the booking has a valid settled escrow payment. Future project/milestone work needs a different rule and cannot be silently treated as full unused service. |
| `admin_process_refund()` (migration 23 replacement) | Requires Admin/Finance, locks refund and payment, validates provider/bank reference, checks cumulative processed refunds do not exceed payment amount, and marks payment fully refunded only when cumulative processed amount reaches the payment total. | Reusable at payment aggregate level if partial refunds are allowed and every refund is tied to the frozen professional booking/payment. Add service-kind context to Admin review, not client authority. |
| `handle_booking_refund_financials()` (migration 21) | On refunded/customer-cancelled/Talent-cancelled status, marks the earning refund-adjusted and writes a reversal for the earning's net amount; cancellation handling is idempotency-guarded by existing reversal rows. | Shared ledger path is preferable, but partial customer refunds and retained amounts must reconcile against commission, Talent earning and referral reward. Existing reversal logic is not proof that arbitrary partial refunds are allocated proportionally. |
| `validate_booking_report_and_hold()` / `hold_booking_when_reported()` (migration 21) | A report tied to a booking must be made by a participant against the other participant. An open/investigating report moves eligible booking states to `disputed_hold`; earning/reward states are preserved for later restoration. | Reusable for professional bookings only if report categories and Admin resolution screens understand the professional service snapshot and private evidence. |
| `admin_resolve_report()` (migration 21) | Admin resolves report; if no other active report remains, restores prior booking and earning/reward states. | Keep the active-report guard and ledger restoration. Project disputes need deliverable/scope/revision evidence before a decision can release funds. |
| `set_booking_completion_timestamps()` / `process_escrow_release()` (migration 20) | Any transition to `completed` schedules release at the completion timestamp. The service-role cron worker makes held Talent earnings available and marks settled payment as released when no open/investigating report exists. | Safe only for service units whose completion signal is authoritative. Project must not transition to generic `completed` until accepted (or a formally approved timeout outcome) because the release is immediate. |
| `confirm_booking_completion()` (migration 21) | Requires `in_progress`; either participant confirms; booking completes only after both customer and Talent confirmations. | Suitable as a candidate for session-based service after the booked slot, but not for day/project unless the completion semantics are separately defined. |

### Concrete blockers

1. **Cancellation cutoff assumes `start_time` exists.** Per-session/day/project services need explicit unit-specific cancellation anchors and timezones. Multi-day cancellation should define whether refund is calculated on whole unused days, elapsed blocks, or a fixed policy; do not prorate by guessed hourly duration.
2. **Customer cancellation formula is activity-specific.** The >24h / 6–24h / <6h rules must not automatically apply to professional services. Approve a separate policy code and snapshot it when the booking is created.
3. **Talent cancellation assumes a full refund of the entire payment.** Keep this as a candidate default for a service that has not started, but define a separate policy for partially delivered work before any project feature is enabled.
4. **Partial refund and earning reversal are not yet a complete allocation contract.** The refund processor prevents over-refunding the payment, but the booking status trigger reverses the linked Talent earning as a whole. Do not support partial refund of a completed/partially delivered professional service until the retained amount, YUKU fee, Talent earning, referral reward, tax/transfer costs and already allocated payout are reconciled by a dedicated idempotent financial adjustment.
5. **Immediate escrow release is a critical project constraint.** Generic `completed` causes immediate release scheduling. Project delivery must use a separate acceptance state and cannot mark the booking completed until the accepted outcome is authoritative.
6. **Dispute hold is booking-wide.** The existing report workflow holds the entire booking and restores prior financial states when all active reports are resolved. Keep this behavior for the first professional release; do not introduce partial milestone release without a separate ledger design.
7. **Refund provider execution is manual.** Current Finance workflow records a real provider/bank refund reference after the refund is actually completed. Do not tell customers a refund is completed merely because a request or approval record exists.

### Required professional cancellation contract before checkout

- Snapshot a versioned cancellation policy on the booking, including service unit, timezone, cutoff anchor, refund bands, provider-cancellation rule and no-show rule.
- Per-session: use the booked session start and a separately approved cancellation window.
- Per-day: define calendar-day versus fixed work-block semantics and how cancellation of future unused days is calculated.
- Per-project: keep checkout disabled until scope acceptance, work-start rules, revision limits, partial-work refund treatment and dispute/acceptance outcomes are defined.
- Preserve one refund aggregate per payment with cumulative refund cap, provider refund reference and audit trail.
- Financial reversal must be idempotent and reconcile the actual retained/refunded split against Talent earning, YUKU fee, referral rewards and payout allocations. Reject changes if earnings have already been allocated/paid unless a verified recovery path exists.
- Keep the existing activity policy and its tests unchanged. Add a distinct professional policy branch rather than altering the legacy activity thresholds.
- Add tests for cancellation before/after cutoff, Talent cancellation, no-show, partial delivery, repeated RPC calls, concurrent cancellation/refund, open dispute, resolved dispute, payout already allocated, partial refund, and immediate escrow worker.

### Release decision

Professional booking checkout remains blocked until Product/Finance approves unit-specific cancellation and refund rules and the financial allocation path is tested in disposable Supabase. Project booking remains disabled until the separate acceptance/dispute workflow prevents premature escrow release.


## Notifications, reviews, referral and operational UI audit — direct source inspection (2026-11-26)

### Confirmed consumers and required changes

| Consumer | Existing source behavior | Required professional-service support |
|---|---|---|
| Booking status notifications — migration 13 | Notification trigger sends activity-specific copy such as "Sesi Aktivitas Dimulai", "Sesi Selesai", and says Talent's 80% compensation becomes available after 24 hours. It triggers on shared booking status. | Replace hard-coded activity wording with booking-kind-aware copy and accurate escrow policy. Do not tell users a 24-hour delay when the current release policy is immediate after valid completion. Keep the same notification table and booking deep-link metadata. |
| Customer booking history — `src/pages/BookingHistoryPage.tsx` | Loads activity category IDs and maps category title; booking card renders `start_time` and `duration_hours` as a session. It also loads review, report and refund rows by booking ID. | Render immutable professional service/category label and pricing unit/quantity snapshot; do not require an activity category join. Show correct date range/session/project status. Preserve report/refund/review relationships through the common booking ID. |
| Talent dashboard — `src/pages/TalentDashboardPage.tsx` | `TalentBookingItem` requires `activity_category_id`, `start_time`, `end_time`, `duration_hours`; booking cards display duration as hours. | Add a discriminated booking-kind view model. Activity branch remains unchanged; professional branch reads service snapshot, unit/quantity, schedule or project due date, delivery mode and location. Actions must call the same guarded RPC transitions, not direct status updates. |
| Admin booking list — migration 54 `get_admin_bookings()` | RPC returns a fixed activity-only shape: `booking_mode`, `start_time`, `duration_hours`, `meeting_location_name`; no service-kind or pricing snapshot. | Add a versioned/admin-safe read contract with booking kind and professional listing snapshot, but keep financial columns excluded from Booking Admin. Finance permission remains separate. |
| Reviews — migration 11 | Trigger verifies booking exists, customer/talent match and status is `completed`; it does not require an activity category. | Database relationship is already compatible with a shared booking ID, but UI copy and review prompts must say "layanan" generically and display the correct professional service. Define whether one review per booking is still the intended rule; enforce it at DB level if not already guaranteed. |
| Referral ledger — migration 45 | On first settled payment, records commission and Talent earning from booking snapshot fields; referral reward is a configured percentage of `platform_fee_amount`. | Shared ledger can support both booking kinds if the same frozen gross/fee/share fields are populated. Product/Finance must approve whether affiliate rewards apply to professional services and at what category-specific rate. Never calculate referral from a mutable listing price. |
| Dispute notifications — migration 13 | Notification includes report and booking IDs; status trigger notifies reporter. | Keep booking ID linkage; Admin/support UI must expose professional service snapshot, scope and private evidence to authorized reviewers. Notification text should not imply every case is a timed activity session. |
| Reports — existing `reports_complaints` | Report references nullable `booking_id`; booking hold checks active reports by booking ID. | Common booking reference is suitable. Add professional-service-specific report reasons/evidence prompts where needed without changing the booking-wide hold behavior for the first release. |

### Additional verified mismatches

1. Notification text in migration 13 says escrow compensation becomes available after 24 hours, while migration 20 sets the release schedule to the completion timestamp. The copy is stale even for the legacy activity path and should be corrected in a separately reviewed migration.
2. Review insert validation itself is not activity-specific; the customer-facing UI and wording are. This is a lower-risk adaptation than cancellation/refund but still needs a professional service display snapshot.
3. Referral creation is already generic around booking financial snapshots. Do not create a separate professional referral ledger. Confirm commercial policy before granting affiliate reward on professional categories.
4. Admin's minimal booking RPC is explicitly activity-shaped. Do not change its return type in place if generated client types or callers depend on it; introduce a backward-compatible v2 RPC or migrate every caller atomically.
5. Existing UI type interfaces are not database constraints, but they will fail to represent null legacy activity fields or professional bookings correctly. Use a discriminated union and preserve legacy fields until every consumer is migrated.

### Next implementation order

1. Define additive `booking_kind` and immutable service snapshot contract; retain legacy activity columns and their current semantics.
2. Add a backward-compatible Admin booking read RPC v2 and frontend typed union.
3. Update booking history and Talent dashboard to render both variants.
4. Update status notification copy to be kind-aware and correct the stale 24-hour message.
5. Adapt review prompts and Admin/support report detail.
6. Add referral eligibility/rate policy only after Product/Finance decision.
7. Run existing activity regression tests plus professional fixtures before any checkout flag is enabled.

No runtime schema, UI, or production behavior was changed by this documentation audit.


## Finance, escrow, refunds and payout consumer audit — direct source inspection (2026-11-26)

### What is already reusable

1. **One canonical transaction ledger:** `commission_records`, `talent_earnings`, and `referral_rewards` each use a unique `booking_id`. This is suitable for both booking kinds if a single shared booking row and frozen financial snapshot are created.
2. **Payment settlement:** `settle_booking_payment(p_booking_id,...)` reads the booking's `gross_amount` and creates/updates the one payment row for that booking. It does not need to understand hourly pricing if the professional checkout RPC writes a valid canonical gross amount.
3. **Escrow release:** `process_escrow_release()` works by booking ID and releases earning/reward/payment rows associated with the completed booking. Keep this single release worker; professional eligibility must gate when a booking can enter completed and when its release timestamp is set.
4. **Talent payout:** payout requests and allocation rows draw from `talent_earnings`, not activity-category tables. The existing payout experience can include professional earnings without a second payout system.
5. **Finance Admin:** refund and payout actions operate on payment/refund/payout IDs. Refund display resolves booking labels by booking ID. This is structurally reusable, but the booking label RPC should be extended compatibly to show professional service title/kind to Finance.
6. **Admin overview:** gross marketplace volume is summed from completed booking `gross_amount`; platform revenue from completed booking `platform_fee_amount`. This can include both kinds if financial snapshots are canonical and completion semantics are correct.

### Confirmed incompatibilities / financial blockers

1. **Ledger generation depends on booking snapshot fields.** The payment trigger creates commission and Talent earning records from booking financial values. The professional checkout must populate `gross_amount`, `platform_fee_amount`, and `talent_gross_share` server-side before payment settlement. It must also preserve the existing unique booking idempotency.
2. **Partial refund accounting is not complete for professional work.** `admin_process_refund()` correctly prevents cumulative processed refunds exceeding the payment amount and only marks the payment fully refunded after the cumulative total reaches the payment amount. However, the booking financial reversal trigger is driven by booking status becoming `refunded` or cancelled, and reverses the earning amount for the booking. There is no demonstrated proportional allocation of multiple partial refunds to Talent earning, platform fee, referral reward, and any already-reserved/paid-out payout allocations. Do not enable partial professional refunds until this reconciliation is designed and tested.
3. **Customer cancellation is activity-time based.** `request_customer_cancellation()` computes refund bands from hours before `start_time`, with fixed 24h / 6h thresholds and an activity-specific cancellation case shape. It cannot be reused unchanged for per-session, per-day, or per-project work.
4. **Talent cancellation assumes a full refund.** The booking status guard requires a refund request at least equal to the full booking gross amount for Talent cancellation. This must be explicitly retained for professional service provider cancellation or replaced with an approved unit-aware policy; it cannot handle partial delivery/project milestones as-is.
5. **Completion drives money movement.** Completion confirmation is currently a two-party confirmation model, and the escrow worker releases associated funds when the booking reaches completed and its schedule is due. For professional work, the unit-specific completion rule must be authoritative before this status transition: elapsed hour/session, end of booked day, or accepted project deliverables. Project work must not inherit activity auto-completion.
6. **Referral reward policy is global.** Referral reward is tied to the platform commission base and uses the shared booking ID. Product/Finance must explicitly decide whether professional bookings qualify and whether the current rate applies to every professional category. Do not silently apply affiliate incentives to new service categories.
7. **Payout dispute guard is linked through earning allocations.** The guard prevents payout completion when reserved underlying earnings are on dispute hold. Preserve this same chain for professional earning rows; do not create a separate professional balance.

### Required financial contract before implementation

- For every professional booking, server-side calculation must satisfy: `gross_amount = platform_fee_amount + talent_gross_share` (subject to the approved rounding rule); all values are integer rupiah and immutable after payment settlement.
- Exactly one payment row and one idempotent earning/commission ledger set per booking.
- Refund requests must carry an explicit allocation policy for customer refund, Talent earning reversal, platform fee reversal, referral reward reversal, and any reserved/paid-out amounts. Partial refund cannot simply mark the whole earning `refund_adjusted`.
- If money has already been allocated to a payout, the refund path must create an auditable debt/negative adjustment or block until Finance resolves it; never silently reduce a paid-out balance.
- Professional service cancellation snapshots must specify unit, timezone, cutoff anchor, refund bands, provider cancellation, no-show, and any milestone/partial-delivery rules.
- Referral eligibility and rate must be an explicit product/finance configuration, not inferred from activity defaults.
- Escrow release must be idempotent and dispute-aware for both booking kinds; project acceptance and dispute windows must be resolved before setting completion/release timestamps.

### Recommended implementation sequence

1. Keep the current financial tables and payout RPCs; do not fork a second ledger.
2. Implement the professional checkout RPC so canonical booking financial snapshots are complete before payment creation.
3. Add a professional-specific cancellation/refund policy snapshot and RPC path; keep activity cancellation unchanged.
4. Define full and partial refund allocation across Talent, platform, referral and payout ledgers, with idempotency and reversal tests.
5. Define unit-specific completion and release scheduling; project remains disabled until acceptance, revision, milestone and dispute rules are approved.
6. Add explicit referral eligibility configuration; default professional service referrals to disabled until approved.
7. Extend Finance booking label RPC in a backward-compatible version to include booking kind/service title, without exposing private documents or service scope to unauthorized Admin roles.
8. Run staging tests for full refund, partial refund, already-paid-out earning, active dispute, duplicate settlement webhook, duplicate escrow worker, and both booking kinds before enabling checkout.

No financial schema, RPC, production data, or payout behavior was changed by this audit.


## Payment rails and webhook audit — direct source inspection (2026-11-26)

### Confirmed protections already present

- **Single payment route lock:** `claim_booking_payment_route()` locks the booking row and permits only manual QRIS or manual bank transfer while the booking is pending and unexpired. Route switching is rejected; Xendit is retired.
- **Retired provider:** Xendit checkout and webhook functions are removed from the release branch. Historical provider enum values remain only for compatibility; the new booking route constraint and settlement RPC reject Xendit.
- **Settlement serialization/idempotency:** `settle_booking_payment()` locks the booking row; only pending bookings can be settled; already-paid/in-progress/completed bookings return success; payment row is upserted on unique booking ID; ledger generation is triggered from payment writes.
- **Manual QRIS:** one pending proof per booking is enforced by a partial unique index; upload is private and tied to an owned booking locked to manual QRIS; Finance review locks submission and booking; approval checks booking status and payment route before creating/updating the payment and moving booking to escrow.
- **Manual bank transfer:** one pending submission per booking is enforced; proof path is constrained to the booking folder; Finance approval verifies owner, exact claimed amount, booking expiry/status, locked route, saved account snapshot, non-empty unique transfer reference, and proof object existence. It writes an audit record.
- **Route separation:** QRIS, bank transfer, and Xendit are mutually exclusive for one booking; a QRIS/transfer booking cannot later create a Xendit invoice through the route claim.

### Gaps and risks to close before production activation

1. **Xendit callback does not validate currency or fetch the invoice from Xendit.** It checks the callback token, external ID, status and amount, but does not compare the invoice ID / currency / payer or independently retrieve the invoice. Add provider-side verification (at minimum invoice ID, external ID, IDR currency, amount and final status) before settlement; store the provider invoice ID distinctly from a charge ID if the provider payload semantics require it.
2. **The webhook idempotency key is booking-only.** Duplicate callbacks for the same booking are safe at the booking/payment-row level, but the database does not persist and uniquely enforce the provider event/invoice ID. Add a provider event/invoice receipt ledger with a unique provider + event/invoice identifier, payload hash, processed state and retry-safe transaction boundary. This also makes reconciliation auditable.
3. **Callback payload amount fallback is permissive.** `paid_amount ?? amount` should be checked against the exact documented Xendit callback contract for the configured invoice API version. Reject missing/non-numeric amount and non-IDR currency; do not silently accept a fallback field unless verified against provider docs and sandbox fixtures.
4. **Checkout route claim precedes the final expiry-window check.** A request with less than 60 seconds remaining can lock the booking to Xendit and then return an error without creating an invoice. Move the minimum invoice-duration check before route claim, while keeping expiry and route checks atomic server-side (ideally one checkout-preparation RPC).
5. **Xendit checkout accepts `pending_verification` accounts.** Review whether that status should be allowed to initiate payment. For the new professional service checkout, require the same fully active customer eligibility enforced at booking creation; do not broaden account access.
6. **Manual QRIS/bank transfer are human-reviewed, not provider-confirmed.** Finance approval is a privileged manual assertion. Keep audit logs, require evidence/reference and independent reconciliation; never describe an uploaded screenshot as automatic confirmation.
7. **Manual payment review and gateway settlement share the same `payments` row.** This is good for one ledger, but regression tests must cover route mismatch, duplicate transfer reference, two Finance reviewers racing, late callback after expiry, callback racing with manual approval, rejected-proof resubmission and repeated webhook delivery.
8. **Legacy settlement accepts provider types and stores raw webhook payload history.** Ensure raw payloads do not contain unnecessary personal/payment secrets, restrict read access, and set retention/redaction rules. Never expose payload history to Customer/Talent.
9. **Booking-level idempotency does not yet establish professional-specific eligibility.** New checkout must create a professional booking snapshot and validate listing/provider/account/document eligibility before a payment route can be claimed. Existing payment rails should only receive a booking after this succeeds.

### Required test matrix before enabling any professional checkout

- Xendit: success; duplicate callback; wrong token; wrong external ID; wrong invoice ID; wrong currency; amount too low/high; missing amount; expired invoice; late paid callback after booking expiry; provider API timeout; duplicate invoice create retry.
- QRIS: inactive settings; route race with Xendit/bank; upload to another booking folder; second pending proof; rejected proof then replacement; duplicate Finance approval; approval after expiry; wrong route.
- Bank transfer: inactive settings; route race; altered amount; duplicate transfer reference across bookings; missing/deleted proof; duplicate Finance approval; two Admin reviewers concurrently; approval after expiry; rejected proof then replacement.
- Shared ledger: payment row created once; commission/earning/referral ledger rows created once; no double escrow release; full refund and partial refund reconciliation; dispute hold; payout already reserved or completed.
- All tests must run in staging against the exact migration set. Current Edge Function headers explicitly state that Xendit sandbox has not yet been tested; do not mark this as verified.

No payment code, Edge Function, schema, production setting, or payment flag was changed by this audit.


## Role and data-access audit — Admin, Finance, Support, Talent, Customer (2026-11-26)

### Access boundaries confirmed in branch migrations

- **Admin model:** one Admin account can receive multiple explicit module permissions: `talent`, `booking`, `finance`, `support`; Super Admin has full access. The permission source is private schema tables, not public signup metadata.
- **Legacy generic Admin helper:** migration 62 changes `public.is_admin()` to true only for service_role or Super Admin. Anon EXECUTE is revoked; authenticated EXECUTE remains for internal compatibility. This prevents a scoped Admin from inheriting every legacy `is_admin()` path.
- **Booking Admin:** reads bookings through `get_admin_bookings()`, guarded by `booking` permission and returning a minimal operational shape. Direct booking-table admin SELECT/UPDATE is restricted to Super Admin; Finance does not receive direct booking table access.
- **Finance:** reads payment, refund, payout, earnings, payout allocations, QRIS and affiliate data through Finance-scoped RLS. Booking customer/talent labels and Talent labels are exposed through purpose-built RPCs. Finance does not receive direct access to the full booking row through the admin read RPC.
- **Support:** reports are scoped to Support. A separate RPC returns only booking ID, booking code and status for a report. It does not expose booking financial columns.
- **Talent moderation:** Talent permission controls Talent profiles/services/media and Talent KTP review. Customer KTP review requires Support permission. Storage KTP policy delegates to the same role-aware helper.
- **Customer/Talent ownership:** booking messages/history and payment visibility are tied to booking participants; payout/earning rows are scoped to the owning Talent or Finance; refund visibility is scoped to the owning Customer or Finance.
- **Super Admin-only controls:** Admin audit log, Admin account provisioning, branding, hero slides, promotions and activity-category management are restricted to Super Admin in the scoped migration set.
- **Private professional documents:** separate professional application review policies allow Super Admin and Talent-permission Admin; documents are not made public. Finance/Support do not inherit this access merely by being Admin.

### Important risks / verification gaps

1. **Trigger guards have broad module bypasses.** Migration 62 lets any active Admin with booking, finance, or support permission bypass the generic booking status actor guard and booking update validator. RLS and guarded RPCs still provide outer controls, but the trigger itself no longer distinguishes which state/column each module is allowed to change. Before launch, review every RPC/update path that can execute with SECURITY DEFINER and prove that Finance cannot change booking service details or status outside Finance RPCs, Support cannot alter money or booking details outside report resolution, and Booking Admin cannot alter financial snapshots.
2. **Role checks must remain inside every SECURITY DEFINER RPC.** A hidden frontend menu is not an access control. Keep explicit `has_admin_permission('finance')`, `('booking')`, `('support')`, or `('talent')` checks in each RPC and enforce ownership/target-role checks in the function body.
3. **Admin dashboard overview is Super Admin-only.** Do not accidentally reuse the aggregate dashboard RPC for scoped Admin modules; expose a module-minimal metric RPC only if a real operational need is approved.
4. **KTP approval changes age/account status.** The role-scoped KTP RPC updates `is_verified_18` and may activate a pending-verification account after approval. Keep this coupled to an actual KTP review, never use it as a general account activation or Admin provisioning mechanism.
5. **Finance booking labels are still sensitive personal data.** The Finance label RPC should return only the minimum name fields required for reconciliation; do not expand it to address, phone, identity number, private documents, or chat.
6. **MFA is currently an explicit product decision to defer.** This increases risk for payout/refund and Super Admin operations. At minimum require strong account security, audit every privileged action, and consider step-up confirmation before production financial actions.
7. **Staging/Production parity is not established.** Prior Admin rollout notes document that the scoped Admin model was applied/tested in Staging, while Production lacked the private Admin schema and had different RLS policies and RPC definitions. The current feature branch must not be treated as proof that Production is protected.

### Required authorization regression tests

- Customer A cannot read Customer B bookings, payments, refunds, reports, or private uploads; Talent A cannot read Talent B private earnings, payout requests, KTP or professional documents.
- Booking Admin can read operational booking fields but cannot read payment amount, platform fee, Talent earning, refund amount, bank details, QRIS proof, KTP or private professional documents.
- Finance can reconcile payment/refund/payout and see only necessary customer/talent labels; Finance cannot read full booking details, messages, KTP, professional credential files, or change booking lifecycle/service details.
- Support can read and resolve reports and Customer KTP cases; Support cannot access payout/payment ledgers or Talent KTP without Talent permission.
- Talent Admin can review Talent profile/service/Talent KTP and professional credential files; Talent Admin cannot read Customer KTP, Finance ledgers, or change payout/refund.
- Combined permissions are additive only for their modules; deactivated Admin loses all permissions immediately; Super Admin-only functions remain denied to scoped Admin.
- Test direct REST table access, Storage object paths, RPC calls, and UI routes separately. Include anon, ordinary authenticated user, deactivated Admin, each single-permission Admin, combined-permission Admin, and Super Admin.
- Specifically test that Finance/Support/Booking Admin cannot exploit the broad trigger bypass in migration 62 to update unrelated booking columns or status through any direct table or RPC path.

No access policy, RPC, UI, production data, or Admin account was changed by this audit.


## Customer–Talent communication and notification audit (2026-11-26)

### Confirmed flow

- Chat is intended to open after payment is secured in escrow (`paid_held_in_escrow`), before Talent confirmation, so both sides can discuss distance, meeting point, time and service details. It remains sendable after Talent confirmation and while in progress.
- Chat history remains readable after completion and during an active dispute; sending is disabled in those states. Cancelled/expired bookings are not exposed by the current chat component status allowlist.
- Database policy, not only UI, checks booking participant identity and allowed status for message SELECT/INSERT. Authenticated clients may INSERT only `booking_id`, `sender_id`, `message`; message ID, timestamp and read state cannot be forged. UPDATE is limited to `is_read`, and only the other participant can mark a message read.
- Booking messages are in Supabase Realtime publication. Notifications are also in Realtime publication. A chat message trigger creates an in-app notification for the other participant, with deep link to the relevant Customer or Talent page.
- Booking status triggers notify payment held, Talent confirmation, session start, completion, cancellation and dispute hold. Additional triggers notify QRIS rejection, refund processing, payout state, report state and professional-service application status.
- Notification reads and read-state changes are scoped to the current user's `user_id`. The bell displays latest 20 notifications and marks one or all read.

### Fix completed on this branch

- Chat push/in-app notification previously copied the first 120 characters of the private chat message into the notification body. Push notification previews may appear on a lock screen or device notification surface. Changed the message to generic text (“Anda menerima pesan baru pada booking … Buka YUKU untuk membaca percakapan.”), keeping booking/message metadata and route while not copying private chat content into notification payloads.
- File: `supabase/migrations/43_booking_chat_push_notifications.sql`.
- This is a branch-only migration edit; it has not been applied to Production or replayed against staging.

### Findings requiring follow-up

1. **Professional-service chat context is still activity-shaped.** `ChatBookingSummary` requires `start_time`, `duration_hours`, and `meeting_location_name`; UI always renders date + “j”. Per-day/per-session/per-project bookings need kind-aware snapshots and context rendering. Do not fake a one-hour schedule for professional services.
2. **Notification deep links are page-level, not booking-level.** Chat notification metadata contains `booking_id`, but the notification bell only navigates to `/dashboard-talent` or `/riwayat-booking`; it does not open the exact booking/chat. Improve by validating a booking ID and opening the correct detail/chat only after the destination page loads and confirms current-user participation.
3. **Admin notifications go to all Admin accounts.** Migration 42 helper `notify_all_admins` targets every non-suspended/non-banned Admin, not active module permission recipients. This may send Finance, KTP, report, and Talent review alerts to Admins who cannot action them. Replace with permission-aware recipient targeting (Finance→finance; KTP Customer/report→support; Talent/KTP Talent→talent; booking moderation→booking; Super Admin receives all) and avoid leaking sensitive metadata in notification body.
4. **Realtime presence and typing are convenience signals, not trusted identity.** The chat client broadcasts a `user_id` field and tracks presence. Never use typing/online payloads to authorize actions or infer verified identity; verify actual sender and booking membership through authenticated database policies. Consider private Realtime channels and explicit Realtime authorization policies before relying on presence privacy.
5. **Read receipts are broad per booking.** Opening chat marks every unread message from the other participant as read, which is acceptable for a two-party conversation but would need redesign if group chat/admin participants are introduced.
6. **Chat message content limits need server-side validation.** UI limits text to 1,000 characters, but the database policy currently validates participant/status/column permissions, not message length or empty/whitespace-only content. Add a DB CHECK/trigger or RPC validation so direct API clients cannot bypass the UI limit.
7. **Chat component has no kind-aware support/contact escalation.** For disputes, the read-only history remains available, but the UI should provide a safe “Hubungi Bantuan” route and preserve message evidence. Do not reopen chat or allow edits after completion/dispute.
8. **Booking lifecycle notifications use legacy activity wording.** Current messages say “sesi aktivitas”, “jadwal”, and “80% compensation” for generic booking statuses. New professional-service bookings need copy based on booking_kind and service unit; project/day work should not be described as a one-hour session.
9. **Admin alert recipient scoping and notification routing need tests.** Current bell trusts server-created `metadata.route` when it begins with `/`; continue to ensure clients cannot insert or modify notification metadata. Test all notification triggers with Customer, Talent, each scoped Admin, Super Admin, suspended user and banned user.
10. **Notification delivery is best-effort in some triggers.** Professional application notification trigger intentionally catches errors so an application submission/review is not rolled back. Keep the business action authoritative in database state/history; notification is an alert, not proof that a user has seen or accepted the action.

### Required regression tests

- Before payment: no chat UI and no SELECT/INSERT access to booking_messages.
- After escrow: only Customer and booked Talent can read/send; verify sender_id spoofing, booking_id substitution, other-user access and invalid status transitions are rejected.
- After completion/dispute: history readable to participants, message INSERT denied, message content immutable, only recipient read receipt can change.
- Cancelled/refunded/expired: chat inaccessible through both UI and direct API.
- Notification for chat: recipient only; no message body in notification or push payload; route correct for Customer and Talent; duplicate realtime delivery does not duplicate rows.
- Message length/blank validation is enforced server-side, not only by textarea.
- Admin notifications are sent only to Admins who can action the corresponding module, plus Super Admin; no KTP/document/bank details or private chat text in notifications.
- Professional booking notifications and chat context use immutable service snapshots and unit-aware labels, not legacy activity fields.
- Verify read receipts, reconnect/realtime failure, multiple open tabs, logout/account switch, and notification deep-link access.

No Production settings, database records, or deployed functions were changed by this audit.
