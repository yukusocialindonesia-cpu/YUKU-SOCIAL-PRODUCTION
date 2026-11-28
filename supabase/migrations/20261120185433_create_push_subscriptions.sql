-- Store Web Push endpoints privately for the YUKU push Edge Function.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null check (length(p256dh) > 0),
  auth text not null check (length(auth) > 0),
  expiration_time bigint,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from public, anon, authenticated;
grant all on table public.push_subscriptions to service_role;

comment on table public.push_subscriptions is
  'Private Web Push endpoints. Accessed only by the YUKU push Edge Function using service_role.';

