-- Booking operational messages/history and Talent review visibility.
-- bookings.* remains restricted; scoped Admins use get_admin_bookings().

alter policy booking_messages_select_participants on public.booking_messages
using (public.has_admin_permission('booking') or exists (
  select 1 from public.bookings b where b.id=booking_messages.booking_id
  and (b.customer_id=auth.uid() or b.talent_id=auth.uid())
));
alter policy status_history_select_parties_or_admin on public.booking_status_history
using (exists (
  select 1 from public.bookings b where b.id=booking_status_history.booking_id
  and (b.customer_id=auth.uid() or b.talent_id=auth.uid())
) or public.has_admin_permission('booking'));
alter policy reviews_select_public on public.reviews
using (is_visible=true or public.has_admin_permission('talent'));
