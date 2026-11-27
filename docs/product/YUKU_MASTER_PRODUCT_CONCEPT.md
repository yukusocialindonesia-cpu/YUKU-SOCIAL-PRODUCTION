# YUKU — Master Product Concept

**Brand:** YUKU  
**Tagline:** Real Friends. Real Moments.  
**Positioning:** Social Experience & Professional Services  
**Product type:** Mobile-first social experience, professional services, and merchant discovery platform.

> This document is the product source of truth for concept, information architecture, business rules, and implementation priorities. It describes the target product, not a claim that every feature is already implemented.

## 1. Product vision

YUKU helps people discover companions for shared activities, hire professional providers, discover local businesses and offers, and connect through community.

The product has **three business engines and one social layer**:

1. **Social Experience** — paid companionship for shared activities and experiences.
2. **Professional Services** — paid expertise, skilled services, and defined work.
3. **Merchant Partner** — business profiles, places, offers, and vouchers.
4. **Community** — free social interaction that supports discovery, trust, and retention; it is not a paid-service category.

These pillars must have distinct catalogs, provider identities, transaction rules, dashboards, and moderation policies where their business models differ.

## 2. Positioning and classification rules

### Social Experience
Customers pay for a companion to accompany them or share an activity. The value is companionship and shared experience, not professional expertise.

Initial categories:
- Social & Hangout
- Food & Dining
- Travel & Exploration
- Sports & Hobbies
- Entertainment & Events
- Online Experience

Examples: hangout companion, culinary companion, shopping companion, travel companion, event companion, recreational sports buddy, online chat or gaming companion.

### Professional Services
Customers pay for skill, expertise, qualifications, guidance, or a defined work output.

Initial groups and examples:
- Travel & Tourism: Tour Guide, Penerjemah Wisata
- Education & Language: Tutor Privat, Penerjemah
- Business & Consulting: Konsultan Bisnis, Hukum, Pajak
- Creative & Digital: Desainer Grafis, Fotografer, Videografer & Editor
- Health & Care: Perawat, Pendamping Pasien, Caregiver Lansia, Babysitter
- Personal Assistance: Personal Assistant, Personal Shopper
- Home Services: ART / Housekeeper, Cleaning Service, Perawatan Taman
- Transportation: Driver Pribadi, Chauffeur
- Events & Hospitality: MC & Host Acara, Event Crew & Usher
- Beauty & Wellness: Makeup Artist, Personal Trainer
- Technical & Repairs: Teknisi AC, Teknisi Elektronik
- Pet Services: Pet Sitter, Dog Walker

Classification test:
- Paid to accompany and share an experience = Social Experience.
- Paid for expertise, professional guidance, qualifications, or work output = Professional Services.

Travel Companion belongs to Social Experience. Tour Guide belongs to Professional Services. A user may offer both only as separately described and approved services.

### Merchant Partner
Merchant is a business partner directory and offers/voucher program, not a talent category and not yet a full product marketplace.

Initial merchant verticals:
- Food & Beverage
- Hotel & Stay
- Travel & Tourism
- Entertainment
- Sports & Recreation
- Retail and other eligible local businesses

Merchant profile supports business identity, description, images, address/location, opening hours, contact details, branches, verification status, and active offers.

Merchant onboarding and offer publication require admin review. Initial merchant registration and offer creation may be free. Merchants define discount, quota, validity, eligible branches, terms, and redemption rules.

Initial voucher journey:
1. Merchant submits business and offer details.
2. Admin verifies the business and approves the offer.
3. Customer claims an available voucher.
4. YUKU issues a unique, non-reusable voucher code.
5. Merchant validates it through an authenticated YUKU redemption interface.
6. Voucher is marked redeemed and an auditable redemption record is stored.

Voucher states: available, claimed, redeemed, expired, cancelled. Prevent duplicate redemption, forged codes, and unauthorized merchant access.

**Merchant payment boundary:** In the initial model, YUKU distributes offers/vouchers; the customer pays the merchant directly for the underlying product or service. Do not route merchant checkout through talent booking or apply talent commission to merchant sales. A full product cart/checkout is a separate future product decision.

### Community
Community is a free social layer: feed, posts, photos/videos subject to moderation, comments, likes, follows, groups, discussions, saves, reports, and blocking. Community can link to public provider profiles, merchant pages, and offers, but community engagement is not itself a paid service.

## 3. Account and identity model

Use **one YUKU account with multiple roles and separate service/business profiles**.

A person may be:
- customer/member only;
- Social Experience provider;
- Professional Services provider;
- both provider types;
- merchant owner/staff under a merchant organization, subject to role permissions.

Do not require someone to become a Social Experience talent before registering as a professional provider. Provider profiles and merchant business profiles are separate entities from the user's social profile.

A provider may submit multiple service offers, including multiple offers in the same category. Each offer has its own stable ID, title, description, pricing model, terms, schedule/coverage, status, owner, and approval history.

## 4. Navigation and information architecture

Primary mobile navigation:
1. Beranda
2. Jelajah
3. Community
4. Pesanan
5. Profil

Jelajah is the discovery hub with three distinct entry points:
- Social Experience
- Professional Services
- Merchant Partner

Keep the primary navigation compact; do not add Merchant as a separate primary tab initially.

Beranda order:
1. Hero and brand promise.
2. Social Experience as the lead service line.
3. Activity categories / discovery shortcuts.
4. Featured Social Experience providers.
5. Professional Services.
6. Merchant Partner offers / local discovery.
7. Community highlights.
8. How it works, trust and safety, provider CTA, and supporting content.

Mobile-first rules:
- compact, app-like layout;
- clear hierarchy and useful density;
- avoid oversized cards and excessive whitespace;
- use the two main brand colors from the approved logo palette;
- do not show Social Experience prices on homepage or discovery cards; show price in provider/service details before booking;
- make the service type unmistakable on every result and profile.

## 5. Discovery and provider profiles

Search and filters must be specific to the selected catalog.

Social Experience filters: activity, online/offline, city/area, date/availability, rating, and other lawful/relevant preferences.

Professional Services filters: service type, skill/specialization, service area, online/offline, availability, rating, and verified qualifications where applicable.

Merchant filters: business category, location, open hours where reliable, offer type, validity, and participating branch.

Public result cards show relevant identity, location/coverage, category, rating/review context, and verification labels. Do not show companion pricing on homepage or browse cards. Do not imply identity verification guarantees service quality or professional competence.

Provider profile:
- one social/user identity;
- separate Social Experience and Professional Services storefronts;
- each storefront has its own approved service listings, descriptions, rates, schedules, service areas, and relevant evidence;
- separate service-specific reputation and review context;
- users can operate either storefront independently or both.

Professional credentials must be reviewed when required for the profession. Regulated services must not be published until applicable licensing and legal requirements are satisfied.

## 6. Service submission and moderation

Provider-submitted services are not public or bookable until approved.

Submission fields should include:
- service line and category;
- title and description;
- delivery method and service area;
- price/rate and pricing unit;
- duration or scope;
- availability;
- optional portfolio and supporting documents;
- required credentials for regulated or credential-dependent services.

Statuses: draft, pending review, approved/active, rejected (with reason), paused, archived.

Allow edited rejected submissions to be resubmitted. Admin decisions and changes must be auditable.

## 7. Booking and transaction model

The customer books a **specific service offer**, never merely a category or generic provider profile.

A booking must reference:
- customer ID;
- provider identity/profile;
- unique service offer ID;
- service line and category;
- schedule, duration, location or online method;
- agreed scope/notes;
- price snapshot and fee/commission snapshot;
- applicable terms and cancellation policy;
- payment and booking status history.

Changing a provider's current price or description must not rewrite historical bookings. Store transaction snapshots.

Suggested booking lifecycle:
- pending payment;
- payment verified;
- awaiting provider acceptance where applicable;
- accepted;
- in progress;
- completed;
- cancelled;
- disputed;
- refund processing;
- refunded.

Exact transitions depend on service type and payment provider capability. Do not claim escrow or hold customer funds unless the payment provider and legal arrangement explicitly support it. Refunds, payouts, chargebacks, and dispute handling must be auditable.

## 8. Revenue model

Initial revenue focus:
- commission on successfully completed Social Experience and Professional Services bookings;
- optional paid merchant promotion/featured placement as a later, clearly labelled product;
- business partnerships and campaigns.

Commission rates are configuration, not a hard-coded product assumption. Any percentage used in prototypes is illustrative until unit economics, payment fees, taxes, and legal requirements are reviewed.

Initial Merchant Partner offers do not create a talent booking commission. Do not require customers to top up a YUKU wallet in the initial experience. Use a compliant payment provider for booking payments and payouts; do not build an unlicensed stored-value or escrow system.

## 9. Dashboards

### Customer
- bookings and order history;
- payment/refund history;
- messages and notifications;
- favorites/saved providers and offers;
- reviews and support requests;
- account and privacy settings.

### Provider / Talent Center
- incoming bookings and schedule;
- separate Social Experience and Professional Services storefronts;
- service offer submission and approval states;
- pricing and availability;
- earnings, pending/available payout states, payout history;
- reviews and service performance;
- verification and credential status.

### Merchant Center
- business profile and branch management;
- offer creation and approval status;
- voucher quota and claim/redemption reporting;
- secure voucher validation;
- staff roles and audit trail.

### Admin
- user and role management;
- provider and credential verification;
- service and category moderation;
- merchant and branch verification;
- offer approval and voucher monitoring;
- bookings, payment exceptions, refunds, payouts, disputes;
- community moderation and reports;
- configuration, analytics, and audit logs.

Super Admin permissions must be separate from ordinary admin permissions and checked server-side.

## 10. Trust, safety, privacy, and compliance

- Identity verification for providers and appropriate merchant verification.
- Clear distinction between identity verified, service approved, and credential verified.
- Safety guidance for in-person Social Experience meetings.
- Rules against harassment, fraud, coercion, illegal services, and off-platform payment evasion where YUKU transaction protection applies.
- Professional credential checks appropriate to each regulated service.
- Reporting, blocking, dispute tickets, evidence handling, and appeal process.
- Privacy controls, least-privilege access, secure document storage, retention/deletion rules, and admin audit logs.
- Server-side authorization for every sensitive operation; never rely only on hiding UI controls.
- Voucher codes must be unique, expiring, scoped to eligible branches, and atomically redeemable only once.

## 11. Technical product invariants

1. Every service offer has a stable unique ID.
2. Booking references service offer ID, not just provider/category.
3. Service approval is enforced server-side and in database policies.
4. Social Experience and Professional Services provider identities are independently supported.
5. One user can own both provider profiles without duplicate accounts.
6. Merchant organizations, branches, offers, voucher claims, and redemptions are separate from talent/provider tables.
7. Booking price, fees, and terms are snapshotted at transaction time.
8. Payment, refund, payout, and voucher redemption records are immutable/auditable where appropriate.
9. RLS and server-side role checks protect private data and privileged actions.
10. Existing production data and active services must be preserved through additive, tested migrations and a rollback plan.

## 12. Delivery phases

### Phase 0 — Audit and specification
- map existing pages, tables, RPCs, RLS, storage, and booking/payment flows;
- reconcile existing PRs and migrations;
- document gaps and data dependencies;
- create acceptance criteria and staging test plan.

### Phase 1 — Core marketplace foundation
- account/role model;
- independent provider profiles;
- service-offer IDs and approval workflow;
- discovery for both service lines;
- booking linked to service ID;
- payment/refund/payout integration and auditability;
- customer/provider/admin dashboards.

### Phase 2 — Merchant Partner
- merchant organization and branch profiles;
- verification and offer moderation;
- voucher claim and secure redemption;
- merchant dashboard and reporting;
- merchant discovery within Jelajah and Beranda.

### Phase 3 — Community
- feed and media moderation;
- follow, groups, discussion, comments, likes, saves;
- links from community content to provider and merchant public pages.

### Phase 4 — Growth
- featured placements, campaigns, partnerships;
- advanced recommendations and analytics;
- mobile app only when justified by usage and product economics.

## 13. Implementation guardrails

- Do not perform direct production schema changes as part of concept work.
- Implement in isolated feature branches and additive migrations.
- Test migrations, RLS, storage policies, booking/payment regressions, and rollback in staging.
- Preserve current active Social Experience services and existing booking history.
- Do not mark Merchant, Professional Services booking, or other modules as live until their complete end-to-end flows are implemented and tested.
- A successful frontend build is not proof of a deployed preview or working production feature.

## 14. Definition of product completeness

A feature is not complete merely because its page exists. It must have:
- clear customer and provider/admin journeys;
- validated data model and permissions;
- server-side business rules;
- loading, empty, error, and success states;
- accessibility and mobile layout;
- tests for normal, edge, and abuse cases;
- operational visibility and auditability;
- staging acceptance before production release.
