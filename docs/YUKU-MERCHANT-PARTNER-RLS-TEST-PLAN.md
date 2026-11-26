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

- [ ] Only the active owner can invite an existing account as manager or staff.
- [ ] Manager and staff cannot invite, promote, or add memberships.
- [ ] Owner cannot invite themselves or create another owner through the invitation RPC.
- [ ] Unknown target account is rejected.
- [ ] Invitation starts as `pending_invitation`; it grants no business access before acceptance.
- [ ] Only the invited user can accept their invitation.
- [ ] Another user cannot accept or activate someone else's invitation.
- [ ] Accepted invitation becomes active and appears in that user's account snapshot as UI status `invited` before acceptance and `active` afterward.
- [ ] Re-invitation of an existing non-owner membership follows the intended role/status transition and leaves an audit trail in application logs.
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
- [ ] Admin can inspect the required review queue through a separately scoped Admin workflow.
- [ ] Non-admin cannot approve, reject, suspend, or publish a merchant business.
- [ ] Approved business becomes publicly visible only after explicit Admin review.
- [ ] Suspension removes public visibility without deleting the business or membership history.
- [ ] Review and membership changes are auditable; add append-only audit events before enabling operational Admin review.

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

The current branch includes a Merchant Center route and a clearly scoped account-menu entry for UI development. Until the migration is applied and the staging evidence is accepted, the page must fail closed with a clear backend-not-ready message; public merchant discovery and real onboarding must remain disabled.
