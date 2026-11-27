# YUKU Merchant Partner — RLS & RPC Test Plan

Status: staging release gate. This plan is not evidence that the tests have run.

## Test identities

Prepare isolated accounts with verified JWTs:
- Anonymous visitor (no JWT)
- Customer A (active)
- Merchant owner A (active)
- Merchant manager A (active)
- Merchant staff A (active)
- Merchant owner B (active; separate business)
- Invited staff (pending invitation)
- Suspended/revoked member
- Admin with the intended merchant-review permission
- Suspended account

Create Business A and Business B, each with at least two branches. Do not reuse Production customer data.

## Public directory boundary

- [ ] Anonymous can select approved business public columns and approved active locations.
- [ ] Anonymous cannot select a draft, pending-review, needs-revision, rejected, or suspended business.
- [ ] Anonymous cannot select inactive locations or locations belonging to a non-approved business.
- [ ] Anonymous cannot read `owner_user_id`, membership rows, invitation metadata, or internal review notes.
- [ ] Public business reads expose only the granted public columns; verify column-level privilege failures for `owner_user_id`.
- [ ] Public business reads do not expose Talent profiles, Professional Provider profiles, bookings, payment records, or customer data.

## Business and owner creation

- [ ] Unauthenticated caller cannot execute `create_merchant_business`.
- [ ] Suspended or non-active account cannot create a business.
- [ ] Active account creates a business with status `pending_review`.
- [ ] Owner membership is created atomically with the business.
- [ ] A failed owner-membership insert rolls back the business insert.
- [ ] Client cannot directly INSERT/UPDATE/DELETE business, membership, or location rows.
- [ ] User cannot change `owner_user_id`, self-approve, or assign themselves Admin.

## Branch access

- [ ] Owner can add a branch to their own business.
- [ ] Manager can add a branch to the business they manage.
- [ ] Staff cannot add a branch.
- [ ] Members of Business A cannot add or read private branch data for Business B.
- [ ] Anonymous sees only active branches under approved businesses.
- [ ] Invalid address, name, or non-object opening-hours JSON is rejected.

## Membership and invitation

- [ ] Only the active owner can invite an existing active YUKU account by email as manager or staff.
- [ ] Email lookup returns no user directory data and only exposes whether an active account can be invited to this owner.
- [ ] Manager and staff cannot invite, promote, or add memberships.
- [ ] Owner and manager can read the member roster for their own business only; email addresses are not exposed outside the scoped roster RPC.
- [ ] Staff cannot read the member roster or member email addresses.
- [ ] Owner can revoke manager/staff access, but cannot revoke or demote the owner.
- [ ] Revoked members lose business and branch access immediately.
- [ ] Invitation, re-invitation, acceptance, and revocation are recorded in membership history.
- [ ] A newly invited account receives an in-app notification through the existing notifications table, with route `/merchant-center` and no sensitive account data.
- [ ] When the invitee accepts, the business owner receives an in-app notification that the membership is active.
- [ ] Realtime notification and existing web-push delivery work without exposing private business data in lock-screen payloads.
- [ ] Notification clicks route to Merchant Center and the invitee sees the correct pending invitation for their own account.
- [ ] Only the invited user can accept the invitation from their own account; acceptance activates the membership.
- [ ] Owner cannot invite themselves or create another owner through the invitation RPC.
- [ ] Unknown target account is rejected.
- [ ] Invitation starts as `pending_invitation`; it grants no business access before acceptance.
- [ ] Only the invited user can accept their invitation.
- [ ] Another user cannot accept or activate someone else's invitation.
- [ ] Accepted invitation becomes active and appears in that user's account snapshot as UI status `invited` before acceptance and `active` afterward.
- [ ] Re-invitation of an existing non-owner membership follows the intended role/status transition and leaves an audit event in merchant_membership_history.
- [ ] Suspended/revoked memberships no longer grant branch or business access.
- [ ] One user can hold memberships in multiple businesses without cross-business access.

## Account snapshot

- [ ] Unauthenticated caller cannot execute `get_my_account_access_snapshot`.
- [ ] Snapshot contains only the caller's own merchant memberships.
- [ ] Snapshot includes only active and pending invitations; suspended/revoked memberships are omitted.
- [ ] Snapshot returns an empty array when no merchant memberships exist.
- [ ] Existing Customer, Talent, and Professional Provider capability values remain unchanged.
- [ ] RPC failure in the client continues to use the documented legacy fallback without granting merchant access.

## Admin and lifecycle

- [ ] Admin access is server-confirmed; client metadata cannot grant it.
- [ ] Only Super Admin can execute `admin_review_merchant_business`; a normal Admin, Talent Admin, Finance Admin, Support Admin, merchant owner and anonymous visitor are denied.
- [ ] Super Admin can read the review queue and locations for pending businesses.
- [ ] Approval requires at least one active branch and changes status to `approved`.
- [ ] Needs-revision, rejection and suspension require a meaningful decision note; note and actor role are recorded in review history.
- [ ] Owner can read only the review history for their own business; anonymous users cannot read review history or decision notes.
- [ ] Review history exposes no reviewer user ID to the client.
- [ ] Owner can resubmit only a draft or needs-revision business; resubmission is recorded in history.
- [ ] Rejected or suspended businesses remain hidden from public discovery.
- [ ] Non-admin cannot approve, reject, suspend, or publish a merchant business.
- [ ] Approved business becomes publicly visible only after explicit Super Admin review.
- [ ] Public directory returns only approved businesses and active locations; it never returns a business without an active location.
- [ ] Suspension removes public visibility without deleting the business or membership history.
- [ ] Review and membership changes are auditable through merchant_business_review_history and merchant_membership_history.

## Commercial isolation

- [ ] Merchant discovery and branch management do not create Talent bookings.
- [ ] Merchant RPCs do not mutate booking, escrow, payment, refund, Talent earnings, referral, or payout tables.
- [ ] No merchant checkout, voucher redemption, merchant commission, or settlement is enabled in this foundation.

## Required evidence before merge

Attach:
1. Migration dry-run output against a disposable/staging Supabase project.
2. RLS tests using real JWTs for every identity above.
3. RPC authorization tests, including negative cross-tenant and self-escalation cases.
4. Concurrency tests for duplicate invitations and simultaneous invitation acceptance.
5. TypeScript/build CI result and a separate SQL/static review.
6. Confirmation that no Production migration or payment/booking behavior was changed.

The current branch includes Merchant Center, public directory, and Super Admin review routes for UI development. Until migrations are applied and the staging evidence is accepted, pages must fail closed with clear backend-not-ready messages; do not enable live onboarding or announce merchant discovery as generally available.


## Public merchant data quality
- [ ] Branch opening hours are stored as a JSON object and displayed only as plain text in the public directory.
- [ ] Website URLs reject non-HTTP(S) schemes at the database boundary.

- [ ] Only the business Owner and Super Admin can read business review history and decision notes; Manager/Staff cannot read internal review notes.
- [ ] Owner receives an in-app notification for approved, needs_revision, rejected, and suspended review decisions, containing only the owner-facing decision note and linking to Merchant Center.

## Merchant offers lifecycle
- [ ] Only active Owner/Manager members can create or edit offers for their own approved business.
- [ ] Staff cannot create, edit, or submit offers.
- [ ] Only Owner can submit an offer for review.
- [ ] Public/anonymous users can read only approved offers whose parent business is approved and whose validity window is active.
- [ ] Draft, pending_review, needs_revision, rejected, and suspended offers are never public.
- [ ] Editing an approved offer returns it to draft and removes it from the public directory until it is reviewed again.
- [ ] Only Super Admin can approve, request revision, reject, or suspend offers; meaningful notes are required for non-approval decisions.
- [ ] Offer review decisions notify the business Owner and are written to the append-only offer history.
- [ ] Merchant offer redemption remains direct with the merchant; no YUKU checkout, coupon wallet, payment, commission, or settlement exists in this release.
- [ ] Expired offers cannot be submitted or approved; future-start offers remain hidden until their start time and expired offers disappear from public queries automatically.
- [ ] Merchant Owner A cannot read, edit, submit, or review offers belonging to Merchant B by substituting a foreign business/offer UUID.
- [ ] Manager can edit offers only for businesses where their active Manager membership exists; Staff cannot mutate offers.
- [ ] Direct INSERT/UPDATE/DELETE against merchant_offers and merchant_offer_history is denied to anon/authenticated clients; only scoped RPCs may mutate offers.
- [ ] Offer quota is never decremented, reserved, or represented as real-time availability; public copy explicitly tells customers to confirm directly with merchant.
- [ ] Offer funding source remains merchant-only in this release and cannot be changed to YUKU/platform-funded through client RPC input.
- [ ] One YUKU account can create and switch between multiple merchant businesses while also holding memberships in other businesses; creating a new business selects that new business without losing existing memberships.
- [ ] When a Manager edits an approved/live offer, the offer is hidden as draft and the business Owner receives an in-app notification to resubmit it.
- [ ] Authenticated users can read only their own raw merchant_memberships rows; Owner/Manager roster details are available only through get_merchant_business_members(business_id), scoped to that business.
- [ ] Raw merchant_memberships SELECT does not expose member_role, invited_by, accepted_at, or another member's user_id; only own membership identifiers/status are selectable.
- [ ] Public merchant offer queries can select eligibility, quota, and funded_by; these fields are explicitly granted and no internal review fields are exposed.
- [ ] Admin offer review queries can read the approved/pending offer fields and owner-only review history without exposing actor_user_id.
- [ ] Merchant business review decision RPC compiles and sends owner notifications for approve/revise/reject/suspend transitions.
- [ ] Owner roster RPC returns member emails for their own business; Manager roster RPC returns the same scoped roles/statuses but masks all member emails. Staff cannot call the roster RPC.
- [ ] Owner cannot submit a promo unless its parent business is currently approved; a business returned for revision or suspended cannot submit new promo reviews.
- [ ] Pending team invitations cannot be accepted after the parent business is rejected or suspended.
- [ ] Owner/Manager can edit branches only for businesses in draft/needs_revision; Manager cannot edit branches once business is approved.
- [ ] Only Owner can edit or deactivate a branch on an approved business; the business is moved to needs_revision and removed from public directory until re-approved.
- [ ] Editing/deactivating a branch cannot affect another business by supplying a foreign location UUID; at least one active branch is required for business approval.
- [ ] Owner can edit an approved business profile; saving any public identity change moves the business to needs_revision, writes a review-history event, and hides it until re-approved.
- [ ] Manager/Staff cannot edit business identity; edits are rejected while business review is pending or status is rejected/suspended.

## Read-only staging preflight

Run `supabase/ops/merchant_partner_staging_preflight.sql` only after applying draft migrations `20261127002000` through `20261127005100` to a disposable or Staging project. The script checks required tables/functions, RLS flags, selected column grants, direct table mutation denial, and anonymous RPC execution denial. It does not modify data and does not replace the role/JWT, cross-tenant, concurrency, notification, or UI acceptance tests above.

This preflight has not been executed. No migration has been applied to Staging or Production.
- [ ] Legacy `invite_merchant_member(uuid,uuid,text)` RPC is not executable by authenticated/anon; all invitations use the email-scoped audited flow with notification.
- [ ] Every exposed Merchant Partner SECURITY DEFINER RPC is callable only by authenticated (never anon/public), checks `auth.uid()`, validates the caller's business role or Super Admin status, and uses an empty search_path with schema-qualified relations. Advisor findings for intentional per-user RPCs must be reviewed and documented rather than blindly ignored.
- [ ] Creating a branch for a draft/needs_revision business is allowed to Owner/Manager; pending_review/rejected/suspended businesses reject branch creation.
- [ ] Creating a branch for an approved business is Owner-only and atomically moves the business to needs_revision with a review-history event; Manager branch creation is denied.
- [ ] Branch creation cannot race with Super Admin review to publish an unreviewed address; business row lock serializes branch creation and review decisions.
- [ ] Legacy `invite_merchant_member(uuid,uuid,text)` is not executable by authenticated clients; all invitations must use the audited email-based RPC.
- [ ] Run `supabase/ops/merchant_partner_staging_preflight.sql` after applying migrations 02000–05000 in disposable Staging; all required tables, functions, column grants, RLS flags, and privilege assertions pass.
- [ ] Owner cannot invite Manager/Staff while the business is rejected or suspended; invitation acceptance remains scoped to the invited user's own active account.
- [ ] Concurrent business suspension/revision and offer approval serialize on the parent business row; no offer is newly approved against a non-approved parent.
- [ ] Approved offers are publicly visible only while the parent business is approved and the offer validity window is active; verify visibility after business suspension, needs-revision, and re-approval.
- [ ] Manager edits to an approved offer return it to draft and notify the Owner; only Owner can resubmit it.

## Multi-profile navigation acceptance
- [ ] An active account with Customer + Talent capabilities opens Customer Profile from the mobile bottom-nav Profile action; it must not force the Talent dashboard.
- [ ] Customer-capable accounts open Booking History from the mobile Orders action, even when they also have Talent, Professional Provider, or Merchant memberships.
- [ ] When the access snapshot explicitly marks Customer unavailable but Talent approved, the mobile Profile action opens the Talent dashboard.
- [ ] A Professional Provider-only account without Customer/Talent capability opens the Professional Provider workspace.
- [ ] A Merchant-only account without Customer/Talent/Professional capability opens Merchant Center when it has an active merchant membership.
- [ ] Pending merchant invitations do not grant Merchant Center workspace access through the mobile Profile action; the account can still open the invitation from the account menu/notification.
- [ ] Admin navigation remains highest priority and opens the Admin workspace.
- [ ] If a signed-in account has no resolved capability snapshot, the mobile Profile action opens the account menu rather than assuming a Customer or provider role.
- [ ] Verify all five bottom-navigation items remain tappable at 320px viewport width and with device safe-area insets.

## Merchant Center stale-session and fail-closed UI checks
- [ ] If the signed-in user changes or signs out while Merchant Center is mounted, the previous account's business, branch, offer, team, invitation, and review-history state is cleared before another account can see the page.
- [ ] If loading the caller's own membership rows fails, Merchant Center clears all previously loaded workspace data and shows the backend/access error; it must not leave a prior business or team visible.
- [ ] If loading the business rows fails after membership lookup, Merchant Center clears the selected business and all dependent workspace data instead of rendering stale locations, offers, team members, or review history.
- [ ] After a membership is revoked or an invitation is declined/expired, refreshing Merchant Center removes the business workspace and any stale invitation action.
- [ ] Switching between two businesses never displays the previous business's locations, offers, team roster, or review history under the newly selected business, including during loading.

## Customer profile and booking multi-profile acceptance
- [ ] An account with Customer + Talent capabilities can open and edit Customer Profile; the legacy users.role = talent value must not redirect it away when the server capability snapshot grants Customer.
- [ ] An account with Customer + Professional Provider or Customer + Merchant membership can open Customer Profile without losing its other workspace access.
- [ ] An account whose snapshot explicitly says Customer unavailable cannot load or save Customer Profile; legacy fallback applies only while the snapshot RPC is unavailable.
- [ ] When the authenticated user changes or signs out while Customer Profile is mounted, the previous user's profile fields and avatar are cleared before the next profile is shown.
- [ ] A booking submission requires a signed-in account with Customer capability; a Talent/Professional/Merchant-only account without Customer capability is stopped in the UI.
- [ ] Customer capability is not treated as identity/KTP verification: server-side create_booking checks remain authoritative and unverified/ineligible customers are rejected.
- [ ] Customer-facing discovery cards and homepage companion cards continue hiding prices; prices are visible only after opening the Talent detail page.
- [ ] Customer + Talent accounts can still view both their customer-side and talent-side booking records in Booking History, with the role filter selecting the correct side.

## Professional provider account-switch acceptance
- [ ] Open Professional Service Application as account A, then sign out or switch to account B; account A's profile fields, application rows, review history, and private document references must be cleared before account B's data appears.
- [ ] Delay account A's category/application/history requests, switch to account B, then allow A's requests to finish; stale A responses must not overwrite B's workspace.
- [ ] Open the application page while signed out after a previous authenticated session; no prior provider identity, application status, or document path remains in component state.
- [ ] Professional provider identity and application history remain scoped to the authenticated applicant; a Talent profile is not required to submit or manage a Professional Services application.
- [ ] Approved Professional Services listings are visible only when the provider profile is complete, the individual service is approved and active, and the public RLS policy permits visibility.
- [ ] Editing/revising a service application does not expose its credential or supporting-document storage paths through public directory/profile queries.


## Independent Professional Provider hardening acceptance
- [ ] Insert/update attempts cannot forge `is_profile_complete`; the database trigger derives completeness from display name, city, headline, and bio, including historical rows after backfill.
- [ ] An incomplete or edited provider profile cannot remain publicly eligible; changing identity fields returns it to pending review and removes public visibility.
- [ ] Anonymous and authenticated public reads of provider profiles/listings do not recurse through RLS and reveal only approved, active, category-compatible listings.
- [ ] A provider with an approved listing is visible only when the provider account is active and the profile is complete; a listing in an inactive category or unsupported delivery mode remains hidden.
- [ ] An active Professional-only provider with a complete provider profile can upload evidence to their own private folder without a Talent profile; another user's folder and inactive/incomplete profiles are rejected.
- [ ] Super Admin can read provider profiles for review without a separate Talent permission; ordinary users can read only their own private provider profile.
- [ ] Run all cases with real anon/authenticated/Admin JWTs and verify storage object ownership, bucket privacy, MIME and size restrictions in isolated Staging.

These cases are acceptance criteria only; no Staging execution is claimed.
