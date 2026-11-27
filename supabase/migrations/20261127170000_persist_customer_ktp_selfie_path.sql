-- Persist the Customer selfie evidence path alongside the KTP document.
-- The existing ktp-documents bucket is private and its role-scoped SELECT policy
-- already authorizes the owning user and Support/Talent reviewers.
alter table public.user_identities
  add column if not exists selfie_storage_path text;

comment on column public.user_identities.selfie_storage_path is
  'Private Storage object path for the Customer identity selfie holding their e-KTP; never store a public URL.';
