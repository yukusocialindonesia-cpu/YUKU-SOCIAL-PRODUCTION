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
