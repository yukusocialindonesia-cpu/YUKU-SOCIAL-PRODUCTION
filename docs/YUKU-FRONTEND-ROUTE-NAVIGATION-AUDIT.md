# YUKU Frontend Route & Navigation Audit

Date: 2026-11-26
Branch: `feat/professional-services-categories`

## Finding fixed

The mobile bottom navigation was hidden on the existing Talent detail route, but remained visible on the equivalent Professional Provider detail route. It also remained visible during the Professional Service application and KTP verification forms. This created inconsistent navigation and could compete with form actions on small screens.

Branch change in `src/layouts/MainLayout.tsx`:
- Hide bottom navigation on `/jasa-profesional/:id`, matching Talent detail.
- Hide bottom navigation on `/daftar-jasa-profesional` and `/verifikasi-ktp`, matching focused form flows.

## Route architecture review

- `App.tsx` uses an explicit route switch and lazy-loads secondary pages; homepage remains eager.
- Dynamic Talent and Professional Provider IDs are stored separately and mapped from URL path segments.
- Browser back/forward re-parses pathname and query filters.
- Suspense fallback provides a visible loading state.
- Query parameters for Talent browse preserve activity, city and online/offline mode.

## Validation limitations

This pass was a source-level review. The GitHub Actions build workflow is configured for source changes, but this docs/source commit has not yet been run through CI. No browser E2E tests or mobile viewport tests were available through the current repository connector. No Production deploy or Supabase change was made.

## Next integration checks

1. Execute `npm ci`, `npm run lint`, and `npm run build` in CI.
2. Test direct URL entry and browser back/forward for all dynamic routes.
3. Test mobile safe-area layout and keyboard behavior on registration, KTP verification and booking forms.
4. Verify professional service listings never expose a booking CTA until the shared booking contract and payment lifecycle are complete.


## Finding fixed — Xendit checkout presentation

The booking history previously rendered an actionable Xendit checkout panel for pending bookings even though the current Production payment-route claim rejects new Xendit checkout claims and the Xendit Edge Functions are not active in the Production inventory. This could invite customers into a checkout path that cannot complete.

Branch fix in `src/components/booking/XenditCustomerPaymentPanel.tsx`:
- Remove the checkout invocation and payment CTA.
- Show a clear temporary-unavailable message for pending bookings where Xendit would otherwise be offered.
- Direct customers only to another method that is visibly active for that booking, or YUKU Admin support.
- Keep existing booking/payment records and database route-lock controls unchanged.

Validation: source-level review only. No checkout, payment, Production database, or deployment operation was performed. Build and browser regression tests remain required.
