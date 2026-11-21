-- Role-scoped access to KTP and module-specific Storage buckets.
create or replace function public.can_admin_access_ktp(p_target_user_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $function$
  select case
    when u.role='talent'::public.user_role_type then private.has_admin_permission(auth.uid(),'talent')
    when u.role='customer'::public.user_role_type then private.has_admin_permission(auth.uid(),'support')
    else false
  end
  from public.users u where u.id=p_target_user_id;
$function$;
revoke all on function public.can_admin_access_ktp(uuid) from public,anon;
grant execute on function public.can_admin_access_ktp(uuid) to authenticated;

alter policy user_identities_owner_or_admin_select on public.user_identities
using (auth.uid()=id or public.can_admin_access_ktp(id));
alter policy user_identities_owner_or_admin_update on public.user_identities
using (auth.uid()=id) with check (auth.uid()=id);
alter policy ktp_documents_owner_or_admin_select on storage.objects
using (bucket_id='ktp-documents' and (auth.uid()::text=(storage.foldername(name))[1] or public.can_admin_access_ktp(((storage.foldername(name))[1])::uuid)));
alter policy qris_proof_read_owner_or_admin on storage.objects
using (bucket_id='qris-payment-proofs' and (public.has_admin_permission('finance') or exists (
  select 1 from public.qris_payment_submissions s where s.proof_storage_path=objects.name and s.customer_id=auth.uid()
)));
alter policy qris_display_admin_upload on storage.objects
with check (bucket_id='qris-payment-display' and public.has_admin_permission('finance'));
alter policy qris_display_admin_update on storage.objects
using (bucket_id='qris-payment-display' and public.has_admin_permission('finance'))
with check (bucket_id='qris-payment-display' and public.has_admin_permission('finance'));
alter policy branding_admin_insert on storage.objects with check (bucket_id='branding' and public.is_super_admin());
alter policy branding_admin_update on storage.objects
using (bucket_id='branding' and public.is_super_admin()) with check (bucket_id='branding' and public.is_super_admin());
alter policy branding_admin_delete on storage.objects using (bucket_id='branding' and public.is_super_admin());
alter policy hero_bucket_admin_insert on storage.objects with check (bucket_id='hero' and public.is_super_admin());
alter policy hero_bucket_admin_update on storage.objects
using (bucket_id='hero' and public.is_super_admin()) with check (bucket_id='hero' and public.is_super_admin());
alter policy hero_bucket_admin_delete on storage.objects using (bucket_id='hero' and public.is_super_admin());
alter policy hero_bucket_admin_select on storage.objects using (bucket_id='hero' and public.is_super_admin());
alter policy promotions_bucket_admin_insert on storage.objects with check (bucket_id='promotions' and public.is_super_admin());
alter policy promotions_bucket_admin_update on storage.objects
using (bucket_id='promotions' and public.is_super_admin()) with check (bucket_id='promotions' and public.is_super_admin());
alter policy promotions_bucket_admin_delete on storage.objects using (bucket_id='promotions' and public.is_super_admin());
alter policy talent_media_bucket_owner_delete on storage.objects
using (bucket_id='talent-media' and (auth.uid()::text=(storage.foldername(name))[1] or public.has_admin_permission('talent')));
