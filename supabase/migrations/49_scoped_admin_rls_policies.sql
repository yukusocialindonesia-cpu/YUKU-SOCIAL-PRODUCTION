-- Scope existing module policies by the permission selected by Super Admin.
-- Keep owner/public clauses intact; do not redefine public.is_admin().

-- TALENT
alter policy talent_profiles_select_public on public.talent_profiles
using ((auth.uid() = id) or public.has_admin_permission('talent') or public.is_talent_publicly_visible(id));
alter policy talent_profiles_update_self_or_admin on public.talent_profiles
using ((auth.uid() = id) or public.has_admin_permission('talent'))
with check ((auth.uid() = id) or public.has_admin_permission('talent'));
alter policy talent_services_select_scoped on public.talent_services
using ((auth.uid() = talent_id) or public.has_admin_permission('talent') or
 (approval_status='approved'::text and is_active=true and public.is_talent_publicly_visible(talent_id)));
alter policy talent_identity_requests_owner_read on public.talent_identity_change_requests
using ((auth.uid() = talent_id) or public.has_admin_permission('talent'));
alter policy talent_service_change_log_owner_read on public.talent_service_change_log
using ((auth.uid() = talent_id) or public.has_admin_permission('talent'));
alter policy talent_media_owner_or_admin_delete on public.talent_media
using ((auth.uid() = talent_id) or public.has_admin_permission('talent'));
alter policy talent_media_select_public_or_owner on public.talent_media
using (public.is_talent_publicly_visible(talent_id) or auth.uid()=talent_id or public.has_admin_permission('talent'));
alter policy talent_availability_owner_delete on public.talent_availability
using ((auth.uid()=talent_id) or public.has_admin_permission('talent'));
alter policy talent_availability_owner_insert on public.talent_availability
with check ((auth.uid()=talent_id) or public.has_admin_permission('talent'));
alter policy talent_availability_owner_update on public.talent_availability
using ((auth.uid()=talent_id) or public.has_admin_permission('talent'))
with check ((auth.uid()=talent_id) or public.has_admin_permission('talent'));
alter policy talent_availability_select_visible on public.talent_availability
using (talent_id=auth.uid() or public.has_admin_permission('talent') or public.is_talent_publicly_visible(talent_id));

-- FINANCE
alter policy payout_requests_select_talent_or_admin on public.payout_requests
using (auth.uid()=talent_id or public.has_admin_permission('finance'));
alter policy payout_earnings_alloc_talent_or_admin on public.payout_earnings_allocations
using (exists(select 1 from public.payout_requests pr where pr.id=payout_earnings_allocations.payout_request_id and pr.talent_id=auth.uid()) or public.has_admin_permission('finance'));
alter policy talent_earnings_select_talent_or_admin on public.talent_earnings
using (auth.uid()=talent_id or public.has_admin_permission('finance'));
alter policy talent_affiliate_earnings_select_talent_or_admin on public.talent_affiliate_earnings
using (talent_id=auth.uid() or public.has_admin_permission('finance'));
alter policy payments_select_parties_or_admin on public.payments
using (exists(select 1 from public.bookings b where b.id=payments.booking_id and (b.customer_id=auth.uid() or b.talent_id=auth.uid())) or public.has_admin_permission('finance'));
alter policy refunds_select_customer_or_admin on public.refunds
using (auth.uid()=customer_id or public.has_admin_permission('finance'));
alter policy customer_cancellation_case_customer_or_admin_select on public.customer_cancellation_cases
using (customer_id=auth.uid() or public.has_admin_permission('finance'));
alter policy admin_read_cancellation_case_decisions on public.customer_cancellation_case_decisions
using (public.has_admin_permission('finance'));
alter policy commission_records_admin_only on public.commission_records
using (public.has_admin_permission('finance')) with check (public.has_admin_permission('finance'));
alter policy financial_adjustments_admin_only on public.financial_adjustments_reversals
using (public.has_admin_permission('finance')) with check (public.has_admin_permission('finance'));
alter policy qris_audit_read_admin on public.qris_payment_audit_logs
using (public.has_admin_permission('finance'));
alter policy qris_settings_admin_insert on public.qris_payment_settings
with check (public.has_admin_permission('finance'));
alter policy qris_settings_admin_update on public.qris_payment_settings
using (public.has_admin_permission('finance')) with check (public.has_admin_permission('finance'));
alter policy qris_settings_read_active_or_admin on public.qris_payment_settings
using (is_active or public.has_admin_permission('finance'));
alter policy qris_submissions_read_owner_or_admin on public.qris_payment_submissions
using (customer_id=auth.uid() or public.has_admin_permission('finance'));
alter policy referral_relationships_select_parties on public.referral_relationships
using (auth.uid()=referrer_id or auth.uid()=referee_talent_id or public.has_admin_permission('finance'));
alter policy referral_rewards_select_referrer_or_admin on public.referral_rewards
using (auth.uid()=referrer_id or public.has_admin_permission('finance'));
alter policy affiliate_settings_admin_select on public.affiliate_settings
using (public.has_admin_permission('finance'));
alter policy affiliate_settings_admin_update on public.affiliate_settings
using (public.has_admin_permission('finance')) with check (public.has_admin_permission('finance'));

-- SUPPORT
alter policy reports_select_reporter_or_admin on public.reports_complaints
using (auth.uid()=reporter_id or public.has_admin_permission('support'));
alter policy reports_update_admin on public.reports_complaints
using (public.has_admin_permission('support')) with check (public.has_admin_permission('support'));

-- SUPER ADMIN only
alter policy admin_audit_logs_select_admin on public.admin_audit_logs using (public.is_super_admin());
alter policy activity_categories_admin_delete on public.activity_categories using (public.is_super_admin());
alter policy activity_categories_admin_insert on public.activity_categories with check (public.is_super_admin());
alter policy activity_categories_admin_update on public.activity_categories using (public.is_super_admin()) with check (public.is_super_admin());
alter policy activity_categories_select_public on public.activity_categories using (is_active or public.is_super_admin());
alter policy hero_slides_admin_delete on public.hero_slides using (public.is_super_admin());
alter policy hero_slides_admin_insert on public.hero_slides with check (public.is_super_admin());
alter policy hero_slides_admin_update on public.hero_slides using (public.is_super_admin()) with check (public.is_super_admin());
alter policy hero_slides_select_public on public.hero_slides using (is_active or public.is_super_admin());
alter policy promotions_admin_delete on public.promotions using (public.is_super_admin());
alter policy promotions_admin_insert on public.promotions with check (public.is_super_admin());
alter policy promotions_admin_update on public.promotions using (public.is_super_admin()) with check (public.is_super_admin());
alter policy promotions_select_public on public.promotions using (is_active or public.is_super_admin());
alter policy site_branding_admin_insert on public.site_branding with check (public.is_super_admin());
alter policy site_branding_admin_update on public.site_branding using (public.is_super_admin()) with check (public.is_super_admin());
