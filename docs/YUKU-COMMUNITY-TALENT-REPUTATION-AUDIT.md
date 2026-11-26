# YUKU — Community, Talent Profile & Reputation Audit

Audit date: 2026-11-26  
Branch: `feat/professional-services-categories`  
Scope: repository source review only. No Production database writes, deployment, or branch merge.

## Executive result

The existing platform has meaningful foundations for community moderation and Talent governance, but the public reputation and trust experience is not yet a single, fully connected system. Keep community reputation separate from paid-service reviews, and do not let likes, follower-style activity, or community popularity substitute for identity, credential, or service-quality verification.

## Confirmed foundations

### Talent profile and service governance

- `40_talent_management_hybrid.sql` establishes approval states for legacy Talent service rows and an audit/change-log table. New service rows default to pending.
- `41_talent_management_security_hardening.sql` removes direct authenticated write access to `talent_services` and routes changes through guarded RPCs. Talent can update only ordinary profile fields; display-name changes are submitted for Admin review.
- Public Talent visibility is intended to require Talent role, active account, 18+ attestation, verified KTP, and approved Talent profile. The public visibility helper is SECURITY DEFINER with an empty search_path.
- `65_talent_media_moderation_and_private_storage.sql` adds pending/approved/rejected media moderation, owner-folder path checks, Admin review audit fields, and a private `talent-media` bucket. The migration itself warns that it must not be applied until the client uses short-lived signed URLs for every media object.
- The professional-service application flow separately requires service-specific verification attestations and supporting evidence for reference-tier categories. This is distinct from generic Talent profile approval.

### Community

- `20261121105125_community_mvp.sql` provides posts, comments, likes, and reports with RLS; public reads are limited to published content.
- Author display names are assigned server-side from safe profile fields rather than trusted from the browser.
- Likes are exposed as aggregate counters; member-level like identities are not intended to be public.
- `20261121105216_community_moderation_helper_private.sql` moves moderation authorization into the private schema and restricts moderation to active Support-permission Admins or Super Admin.
- Moderation RPC locks a pending report, supports hide/remove/dismiss, records moderator and review timestamps, and stores a bounded moderation note.
- The UI currently offers topic filters, post/comment creation, likes, and reporting for Spam, Pelecehan, Konten tidak pantas, Penipuan, and Lainnya.

## Gaps and risks to close

1. **Community author identity is display-only.** Posts and comments show a display name, but the current feed contract does not expose a verified identity badge or a clear link to the author's public profile. Add a safe public author reference and profile navigation only after verifying the visibility policy; never expose email, phone, KTP, or private account metadata.
2. **Community activity is not service reputation.** Likes and comments can be gamed and are not tied to a completed paid booking. Do not combine them into the Talent star rating. Paid-service reviews must remain one-per-eligible-booking, tied to a completed booking and the correct customer/provider.
3. **Report workflow is basic.** The UI reports post/comment content and the RPC can hide/remove/dismiss, but the reviewed sources do not establish an end-user appeal flow, moderator SLA, repeat-offender escalation, or a complete user-block/mute system. These should be designed before scaling nationwide.
4. **Moderation visibility must be tested end-to-end.** The Admin panel loads pending reports through authenticated reads. Verify Support-permission Admin and Super Admin can read/process reports, while ordinary Admin, Talent-only Admin, Finance-only Admin, anon, and unrelated authenticated users cannot read report details or hidden content.
5. **Server-side content validation needs explicit regression coverage.** The page enforces 1,200-character post and 600-character comment limits, but client validation alone is insufficient. Confirm database constraints/RPC enforcement for blank/whitespace-only bodies, maximum lengths, allowed topics, and report reason/details. Do not rely on UI checks.
6. **Abuse controls need adversarial tests.** Existing UI handles duplicate report and rate-limit error codes, but verify limits are enforced server-side and atomically across concurrent requests. Test spam bursts, duplicate likes/reports, self-reporting, reports against removed content, and repeated creation after account suspension.
7. **Profile fields and media have different trust levels.** A verified KTP/profile must not imply every gallery item, bio claim, language, interest, or skill is verified. Show separate labels such as identity verified, service credential reviewed, and media approved; only issue a credential badge when the underlying evidence and review scope support it.
8. **Private media rollout dependency is critical.** Migration 65's own warning means bucket privacy cannot safely be enabled while any client still relies on permanent public URLs. Audit all gallery, avatar, preview, sharing, and admin-review consumers for signed-URL refresh, expiry, logout/account switch, and unauthorized object access before rollout.
9. **Public profile data minimization must remain consistent.** Keep the public profile column allowlist narrow. Never expose referral codes, contact details, identity documents, internal review notes, or moderation metadata through broad table selects or new profile joins.
10. **Professional and legacy Talent profiles need one coherent presentation.** Professional providers may hold regulated credentials and unit-based service listings; the profile should display the exact approved service, delivery mode, pricing unit, and verification level without implying that generic Talent approval is a professional license.
11. **No visible appeal route was confirmed for Talent moderation decisions.** Add a documented revision/appeal path with reason, evidence replacement, timestamps, and audit history; keep the listing unpublished while review is pending or requires action.
12. **Account suspension and content lifecycle must agree.** Test that suspended/banned accounts cannot publish, comment, like, report-abuse, upload media, or appear in public search, while historical records and Admin evidence remain available according to retention policy.

## Product decisions

- Keep three separate trust signals: **identity verification**, **service/credential verification**, and **community/service reputation**.
- Only completed, eligible YUKU bookings can produce paid-service reviews.
- Community likes/comments never change Talent rating, search rank, verification tier, or payout.
- Public profiles show only approved and intentionally public fields.
- Unapproved/rejected media is never public; private evidence remains accessible only to its owner and authorized reviewers.
- Moderation actions must be auditable, permission-scoped, and reversible only through an explicit reviewed action.

## Required test matrix

- RLS: anon, ordinary customer, Talent owner, unrelated Talent, Support Admin, Talent Admin, Finance Admin, Super Admin, suspended and banned accounts.
- Community: blank/oversized content, invalid topic, spoofed author ID/display name, duplicate like/report, race conditions, hidden/removed post and comment visibility, moderation audit.
- Profile: public column allowlist, hidden/inactive/suspended Talent exclusion, display-name request lifecycle, profile edits during review.
- Media: pending/rejected/approved read paths, owner-folder path traversal, cross-owner object access, signed URL expiry/refresh, bucket privacy, admin evidence access.
- Reputation: review eligibility, booking ownership, duplicate reviews, rating aggregation, no rating from cancelled/refunded/disputed bookings.
- Professional credentials: evidence required by verification tier, reviewer authorization, immutable attestation fields, resubmission and listing suspension on needs-action.

## Rollout boundary

This document records source-level findings and product requirements only. It does not certify that the SQL has been replayed on Staging, that RLS tests passed, or that the media bucket is already private in Production. Keep the feature branch unmerged until the existing Supabase migration-history mismatch and Staging validation gates are resolved.
