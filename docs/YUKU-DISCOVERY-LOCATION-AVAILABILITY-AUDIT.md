# YUKU — Discovery, Location & Availability Audit

Audit date: 2026-11-26  
Branch: `feat/professional-services-categories`  
Scope: source-level review of marketplace discovery, GPS radius search, city filters, and availability display. No Production writes, deployments, or merges.

## Executive result

YUKU already has a nationwide city catalog, server-side text search, GPS-based nearby discovery, and weekly/specific-date availability. The main remaining risks are consistency between discovery and booking eligibility, timezone correctness across Indonesia, stale availability, and clarity about what “available” actually guarantees.

## Confirmed implementation

1. `fetchTalentsFromSupabase` selects an explicit public Talent profile field allowlist, applies server-side name/headline/bio search, uses stable ordering and pagination, then joins public service-category mappings.
2. `BrowseTalentPage` merges the normal marketplace page with profiles returned by the GPS nearest-search RPC. It excludes the signed-in user's own Talent profile and applies activity, city, gender, and online/offline filters.
3. `LocationFilter` builds city choices from currently loaded Talent city values and highlights cities with visible Talent counts. It includes a nationwide “Semua Kota di Indonesia” option.
4. GPS exact coordinates for Talent are stored in the private `private.talent_service_locations` table. Direct table access is revoked from public, anon, and authenticated roles.
5. Talent location updates require an authenticated active Talent account, valid latitude/longitude, and radius 5/10/20 km. Talent can read back only their own saved location through `get_my_talent_service_location()`.
6. `find_nearest_talents` returns only Talent IDs and rounded distance, not Talent coordinates. Migration 68 restricts it to active Customer callers and active, approved, offline-capable Talent within their configured service radius.
7. Public availability reads are gated by the public Talent visibility helper; owners and authorized Talent Admins retain their scoped access.
8. The UI's “Hari ini” chip is computed from currently loaded schedule rows. Specific-date rows override weekly rows; no schedule is not represented as “available today”.

## Gaps and risks

1. **GPS discovery and normal catalog eligibility need one canonical predicate.** The nearest RPC checks active account, approved profile, service mode, active GPS location and radius. Ensure it also requires at least one approved, active service/listing and the same KTP/age/public-visibility predicate used by normal public catalog RLS. Otherwise the GPS result can contain an ID whose profile or service is not actually discoverable.
2. **City counts are page-scoped, not nationwide counts.** `LocationFilter` derives options from the currently loaded Talent array. With pagination and a 100-row fetch batch, a city with active Talent outside the first page may be missing or have an understated count. Use a server-side distinct-city/count RPC or a separate aggregate endpoint for trustworthy nationwide city options.
3. **GPS result cap is 500.** A dense area can have more than 500 nearby providers; the client cannot page beyond the RPC's returned IDs. Prefer server-side distance pagination with a stable cursor and a bounded maximum radius.
4. **GPS coordinates are customer-supplied.** The server validates coordinate ranges and caller role, but cannot prove that the submitted Customer coordinates are their actual device location. Treat distance as approximate discovery, not proof of physical presence or fraud prevention. Apply rate limiting and avoid logging exact coordinates.
5. **Location freshness and consent need explicit UX.** Talent can activate a saved service location, but the reviewed schema does not show an automatic expiry or periodic re-confirmation. Display when location was last updated, allow immediate pause, and consider stale-location expiry. Customer GPS should be opt-in and must not persist after permission denial or explicit reset.
6. **Distance means service-radius eligibility, not travel time.** Straight-line distance is not road distance and does not account for traffic, ferry crossings, restricted areas, or travel costs. Label it “perkiraan jarak”, and let both parties confirm the actual meeting point in booking chat.
7. **Timezone is not explicitly unified in client availability helpers.** `TalentQuickFilter` derives “today” using the device's local date/time, while Talent and Customer may be in different Indonesian time zones (WIB/WITA/WIT). Availability should be evaluated using the service location's timezone, or the UI should clearly state the timezone used. Do not assume the Customer device timezone equals the Talent's service timezone.
8. **“Available today” is weaker than bookable.** It checks whether a schedule slot ends after the current local clock time; it does not reserve capacity, account for an existing paid booking, or guarantee the requested duration fits. Label it as schedule availability only; final availability must be checked atomically in the booking RPC.
9. **No schedule is treated as permissive by the legacy helper.** `checkBookingAgainstAvailability` returns `hasSchedule:false, isAvailable:true` when no slots exist. Confirm the booking RPC applies a separate safe policy and does not interpret missing schedule as unlimited availability. If missing schedule should mean closed, enforce that server-side before checkout.
10. **Stale availability can be shown.** The “Hari ini” query runs for the currently loaded Talent IDs and updates when the ID list changes, not necessarily when the clock crosses a slot boundary or the user leaves the page open. Refresh at local date/slot boundaries or show the timestamp and revalidate at checkout.
11. **GPS and city filters can conflict.** When GPS is active, city filtering still applies. This is logically valid but may surprise users who choose a city while GPS remains active. The UI should show active filters clearly and provide one-tap reset.
12. **Professional listings need unit-aware discovery.** Current legacy Talent search maps `talent_services.activity_category_id`; professional-service listings live in a separate taxonomy and have per_hour/per_session/per_day/per_project units. Do not silently map them into legacy activity IDs or display hourly assumptions. A unified search result needs a discriminated listing type, exact service title, pricing unit, delivery mode, and eligibility state.
13. **Ranking needs transparent separation.** Current default order prioritizes verification, review count, rating, completed hours, and registration date. GPS sorting overrides it for nearby offline Talent. Define explicit relevance modes (nearest, recommended, rating, newest) and avoid letting raw review count dominate quality without a minimum eligible-review policy.
14. **Error fallback must not imply success.** If GPS RPC fails, the page returns to city-based search; make the fallback visible and do not retain a misleading distance label. If schedule loading fails, hide the “Hari ini” claim rather than treating missing data as available.

## Product decisions

- Nationwide discovery uses city/province filters independent of GPS permission.
- GPS is optional; exact coordinates remain private and only approximate distance is returned.
- Radius is controlled by Talent and is limited to the configured 5/10/20 km options.
- A distance badge is informational and never guarantees booking acceptance.
- “Available today” is a schedule hint, not a reservation guarantee.
- Booking checkout must re-check active account, public visibility, approved service, schedule, capacity, and conflicts server-side in one transaction.
- Professional-service search must preserve each listing's pricing unit and delivery mode.
- The Customer and Talent confirm exact location, meeting point, and distance through the existing post-payment coordination chat; no off-platform price or duration change is authorized by chat.

## Required regression tests

- GPS RPC: anon, logged-out, Customer, Talent, Support Admin, Finance Admin, Super Admin, suspended/banned Customer; invalid coordinates, null coordinates, radius boundary, antimeridian, duplicate IDs, >500 nearby results, disabled location.
- Eligibility parity: hidden profile, unapproved profile, inactive account, KTP/age not verified, no approved active service, online-only provider, inactive service, professional-only provider.
- Privacy: direct read of private location table denied; Talent can read/update only own location; Customer receives only ID and rounded distance, never coordinates or location label.
- City search: cities beyond first page, empty cities, spelling/alias normalization, province grouping, zero active providers.
- Availability: WIB/WITA/WIT date boundary, daylight/timezone parsing, specific-date override, weekly fallback, missing schedule, overlapping slots, stale cache, clock crossing slot end.
- Booking race: two Customers attempt same provider/time; schedule changes after browse; provider deactivates location or service between search and checkout; server RPC rejects stale availability.
- Professional search: per_hour/per_session/per_day/per_project label, no fabricated hourly price, exact delivery mode, inactive listing excluded.
- Ranking: nearest vs recommended vs rating vs newest; stable pagination without duplicate/missing profiles when rating or review count changes.

## Rollout boundary

This is a repository source audit, not runtime certification. No claim is made that the migrations have been replayed on Staging, that RLS regression tests passed, or that the GPS and availability paths were verified against live Production data. Keep the feature branch unmerged until migration-history reconciliation and Staging validation are complete.
