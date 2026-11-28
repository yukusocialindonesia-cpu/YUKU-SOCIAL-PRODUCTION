-- Private application intake for professional-service providers.
-- Applicant documents never enter public buckets. Review permissions reuse the existing Talent admin scope.
create table if not exists public.professional_service_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references auth.users(id) on delete cascade,
  subcategory_id text not null references public.professional_service_subcategories(id) on delete restrict,
  service_description text not null check (char_length(trim(service_description)) between 30 and 3000),
  experience_years integer not null default 0 check (experience_years between 0 and 80),
  service_city varchar(120) not null,
  delivery_modes text[] not null check (
    cardinality(delivery_modes) > 0 and delivery_modes <@ array['online','offline']::text[]
  ),
  rate_amount bigint not null check (rate_amount > 0),
  pricing_unit text not null check (pricing_unit in ('per_hour','per_session','per_day','per_project')),
  credential_document_path text,
  supporting_document_path text,
  status text not null default 'pending'
    check (status in ('pending','under_review','approved','rejected','needs_revision')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_professional_service_applications_owner
  on public.professional_service_applications(applicant_id, created_at desc);
create index if not exists idx_professional_service_applications_review
  on public.professional_service_applications(status, created_at)
  where status in ('pending','under_review','needs_revision');

alter table public.professional_service_applications enable row level security;

drop policy if exists professional_service_applications_owner_read on public.professional_service_applications;
create policy professional_service_applications_owner_read
  on public.professional_service_applications for select to authenticated
  using (applicant_id = (select auth.uid()));

drop policy if exists professional_service_applications_owner_insert on public.professional_service_applications;
create policy professional_service_applications_owner_insert
  on public.professional_service_applications for insert to authenticated
  with check (
    applicant_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and admin_note is null
  );

drop policy if exists professional_service_applications_admin_read on public.professional_service_applications;
create policy professional_service_applications_admin_read
  on public.professional_service_applications for select to authenticated
  using (public.has_admin_permission('talent'));

drop policy if exists professional_service_applications_admin_update on public.professional_service_applications;
create policy professional_service_applications_admin_update
  on public.professional_service_applications for update to authenticated
  using (public.has_admin_permission('talent'))
  with check (public.has_admin_permission('talent'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'professional-service-documents',
  'professional-service-documents',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists professional_service_documents_owner_upload on storage.objects;
create policy professional_service_documents_owner_upload
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'professional-service-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists professional_service_documents_owner_read on storage.objects;
create policy professional_service_documents_owner_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'professional-service-documents'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.has_admin_permission('talent')
    )
  );

comment on table public.professional_service_applications is
  'Private provider onboarding submissions. Approval is not equivalent to publication; admin must create a corresponding approved listing only after reviewing required credentials.';

drop policy if exists professional_service_documents_owner_delete on storage.objects;
create policy professional_service_documents_owner_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'professional-service-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
