-- Explicit Data API grants for professional services.
-- RLS policies remain the row-level authorization boundary.
grant select on public.professional_service_categories to anon, authenticated;
grant select on public.professional_service_subcategories to anon, authenticated;
grant select on public.professional_talent_services to anon, authenticated;
grant select, insert, update on public.professional_service_applications to authenticated;
grant select on public.professional_service_application_status_history to authenticated;
