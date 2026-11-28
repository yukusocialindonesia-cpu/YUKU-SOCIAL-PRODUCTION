create or replace function public.notify_yuku_push_on_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret
    into webhook_secret
  from vault.decrypted_secrets
  where name = 'yuku_push_webhook_secret'
  limit 1;

  if webhook_secret is null or webhook_secret = '' then
    raise warning 'YUKU push webhook secret is not configured in Vault';
    return new;
  end if;

  perform net.http_post(
    url := 'https://sbqvltqzzcsqzijgumld.supabase.co/functions/v1/yuku-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-yuku-push-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'schema', 'public',
      'record', to_jsonb(new),
      'old_record', null
    ),
    timeout_milliseconds := 10000
  );

  return new;
end;
$$;

revoke all on function public.notify_yuku_push_on_notification_insert() from public, anon, authenticated;

drop trigger if exists yuku_push_after_notification_insert on public.notifications;
create trigger yuku_push_after_notification_insert
after insert on public.notifications
for each row
execute function public.notify_yuku_push_on_notification_insert();

comment on function public.notify_yuku_push_on_notification_insert() is
  'Sends inserted YUKU notifications asynchronously to the yuku-push Edge Function.';

