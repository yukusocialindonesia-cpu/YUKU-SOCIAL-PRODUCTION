-- Additive provider-service listings for YUKU Professional Services.
-- Existing talent_profiles, talent_services and bookings remain unchanged.
-- Public visibility is limited to active, approved listings and approved talent profiles.

create table if not exists public.professional_talent_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.talent_profiles(id) on delete cascade,
  subcategory_id text not null references public.professional_service_subcategories(id) on delete restrict,
  service_description text not null default '',
  experience_years integer not null default 0 check (experience_years between 0 and 80),
  service_city varchar(120),
  delivery_modes text[] not null default array['offline']::text[],
  rate_amount bigint not null check (rate_amount > 0),
  pricing_unit text not null default 'per_session'
    check (pricing_unit in ('per_hour','per_session','per_day','per_project')),
  approval_status text not null default 'pending'
    check (approval_status in ('pending','approved','rejected','suspended')),
  is_active boolean not null default false,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_talent_services_delivery_modes check (
    cardinality(delivery_modes) > 0
    and delivery_modes <@ array['online','offline']::text[]
  ),
  constraint professional_talent_services_provider_subcategory_unique unique (provider_id, subcategory_id)
);

create index if not exists idx_professional_talent_services_public
  on public.professional_talent_services(subcategory_id, service_city)
  where approval_status = 'approved' and is_active = true;

create index if not exists idx_professional_talent_services_provider
  on public.professional_talent_services(provider_id, created_at desc);

alter table public.professional_talent_services enable row level security;

drop policy if exists professional_talent_services_public_read on public.professional_talent_services;
create policy professional_talent_services_public_read
  on public.professional_talent_services
  for select to anon, authenticated
  using (
    approval_status = 'approved'
    and is_active = true
    and exists (
      select 1 from public.talent_profiles tp
      where tp.id = provider_id and tp.is_approved = true
    )
  );

comment on table public.professional_talent_services is
  'Public professional-service listings. Writes and approval transitions must be added only with a reviewed provider/admin workflow; no client write policy is intentionally granted yet.';
