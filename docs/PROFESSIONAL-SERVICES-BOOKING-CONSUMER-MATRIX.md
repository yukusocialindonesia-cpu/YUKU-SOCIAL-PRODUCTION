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
| `claim_booking_payment_route()` | Locks one payment route on the booking; current code rejects selecting Xendit for a new booking when route is null. | Reuse route lock only after booking-kind checks and payment feature flag are explicit. Keep route immutability. |
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
| `supabase/functions/create-checkout/index.ts` | Reads booking owner/status/gross, claims route, creates Xendit invoice. | Validate supported booking kind and exact snapshot amount; keep customer ownership, pending status and expiry checks. Current route-claim implementation rejects a new Xendit route when none is locked; preserve this deliberate current behavior unless payment configuration is separately approved. |
| `supabase/functions/xendit-webhook/index.ts` | Reads booking gross and checks paid amount before calling server-only settlement RPC. | Confirm payment intent/booking kind, currency, provider charge uniqueness and idempotent replay behavior against the immutable snapshot. |
| `account-management` Edge Function | Counts bookings/payments/refunds via `bookings` joins. | Keep aggregates booking-kind neutral; add kind-specific support detail only where needed. |
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
- `supabase/functions/create-checkout/index.ts`: reads the booking gross and calls route-claim logic before invoice creation.
- `supabase/functions/xendit-webhook/index.ts`: compares provider paid amount with booking gross before server-side settlement. The webhook must also retain provider event/charge idempotency and reject unsupported currencies/amount mismatches.
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
