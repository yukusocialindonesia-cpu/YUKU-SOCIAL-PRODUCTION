-- Keep an already-published listing from remaining public when its application
-- is rejected or returned for revision. Re-approval through the admin RPC can
-- publish it again after the corrected application is reviewed.
create or replace function public.sync_professional_listing_with_application_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('needs_revision', 'rejected') then
    update public.professional_talent_services
       set approval_status = 'suspended',
           is_active = false,
           updated_at = now()
     where provider_id = new.applicant_id
       and subcategory_id = new.subcategory_id;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_professional_listing_with_application_review() from public, anon, authenticated;

drop trigger if exists trg_sync_professional_listing_with_application_review
  on public.professional_service_applications;

create trigger trg_sync_professional_listing_with_application_review
after update of status on public.professional_service_applications
for each row
execute function public.sync_professional_listing_with_application_review();

comment on function public.sync_professional_listing_with_application_review() is
  'Automatically suspends the matching public professional listing when an application is rejected or returned for revision.';
