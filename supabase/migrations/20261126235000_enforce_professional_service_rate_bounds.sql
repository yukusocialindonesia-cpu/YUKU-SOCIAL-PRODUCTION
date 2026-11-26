-- Keep direct API submissions consistent with the application form.
-- The upper bound preserves exact integer handling in JavaScript before sending bigint values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.professional_service_applications'::regclass
      and conname = 'professional_service_applications_rate_amount_bounds'
  ) then
    alter table public.professional_service_applications
      add constraint professional_service_applications_rate_amount_bounds
      check (rate_amount between 10000 and 9007199254740991);
  end if;
end;
$$;

comment on constraint professional_service_applications_rate_amount_bounds
  on public.professional_service_applications is
  'Enforces the Rp10,000 minimum shown in the application UI and keeps submitted integer rates within JavaScript safe-integer precision.';
