-- Remove the original unrestricted SELECT policy from migration 06.
-- Migration 41 introduced talent_services_select_scoped but did not drop this
-- legacy permissive policy. PostgreSQL combines permissive policies with OR,
-- so the old USING (TRUE) made every service row publicly readable.
DROP POLICY IF EXISTS talent_services_select_public ON public.talent_services;

COMMENT ON TABLE public.talent_services IS
  'Service rows are readable under the scoped talent_services_select_scoped policy: approved+active rows publicly, own rows to the owner, and rows to authorized Talent reviewers.';
