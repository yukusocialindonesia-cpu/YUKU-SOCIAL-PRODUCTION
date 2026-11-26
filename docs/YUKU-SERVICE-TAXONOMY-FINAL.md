# YUKU Service Taxonomy — Final Product Structure

## Brand architecture

YUKU is a social super app with two paid service lines and one non-paid social layer:

1. **Social Experience** — Paid Companion: a person is paid to accompany a customer and share an activity or experience.
2. **Professional Services** — a provider is paid for professional knowledge, qualifications, a defined task, or a work output.
3. **Community** — social interaction, groups, and discussion; not a paid-service category.

One YUKU account may eventually hold a Social Experience provider profile, a Professional Services provider profile, or both. Neither service line should require enrollment in the other.

## Social Experience — Paid Companion

Activity categories:
- Social & Hangout: coffee, casual hangouts, conversation.
- Food & Dining: eating out and culinary exploration.
- Travel & Exploration: city walks, leisure trips, and Travel Companion.
- Sports & Hobbies: recreational sports and shared hobbies, not coaching.
- Entertainment & Events: cinema, concerts, celebrations, and event companionship.
- Online Experience: chat, voice calls, and gaming together.

The current six legacy activity-category records remain the Social Experience discovery taxonomy. Their labels/examples should be updated in place to preserve existing category IDs and booking references.\n\nEach Talent may submit a custom service title and description under a YUKU category, with an optional custom rate. Admin approval is required before the custom offer is shown on the public Talent profile. The current legacy data model allows one offer per Talent per category; do not add multiple same-category listings until booking is redesigned to reference a specific service ID.

## Professional Services

Professional service groups and existing subcategories:
- Travel & Tourism: Tour Guide, Penerjemah Wisata.
- Caregiving & Childcare: Perawat, Caregiver Lansia, Pendamping Pasien, Babysitter.
- Personal Assistance: Personal Assistant, Personal Shopper.
- Transportation: Driver Pribadi, Chauffeur.
- Home Services: ART / Housekeeper, Cleaning Service, Perawatan Taman.
- Business & Consulting: Konsultan Bisnis, Konsultan Hukum, Konsultan Pajak.
- Creative & Digital: Desainer Grafis, Fotografer, Videografer & Editor.
- Events & Hospitality: MC & Host Acara, Event Crew & Usher.
- Beauty & Wellness: Makeup Artist, Personal Trainer.
- Pet Services: Pet Sitter, Dog Walker.
- Technical & Repairs: Teknisi AC, Teknisi Elektronik.
- Language & Education: Tutor Privat, Penerjemah.

Travel Companion is not a Professional Service. The legacy professional taxonomy row is retained for referential integrity/history but deactivated; new discovery and applications must not offer it.

## Classification rule

- Paid for companionship and shared experience => Social Experience.
- Paid for expertise, professional guidance, a qualification, or a defined work result => Professional Services.

Examples:
- Travel Companion => Social Experience; Tour Guide => Professional Services.
- Recreational sports buddy => Social Experience; Personal Trainer => Professional Services.
- Shopping companion => Social Experience; Personal Shopper => Professional Services.
- Study companion => Social Experience; Tutor Privat => Professional Services.

## Implementation boundaries

- Preserve existing IDs and historical records; use soft deactivation instead of deleting referenced taxonomy rows.
- The taxonomy migration is a proposed branch migration and must not be applied to production without the required approval.
- The current Professional Services application/listing relationship still depends on `talent_profiles`. Independent provider onboarding for Professional Services is a separate schema/workflow change and is not solved by this taxonomy-only change.
- Do not enable booking or payment for Professional Services as part of this taxonomy change.
