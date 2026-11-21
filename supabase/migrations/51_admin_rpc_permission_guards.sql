-- Replace generic Admin guards in user-facing SECURITY DEFINER RPCs.
-- Keep trigger functions using is_admin() unchanged; they are internal integrity guards.
do $migration$
declare v_name text; v_old text; v_new text; v_def text; v_oid oid;
begin
  for v_name,v_old,v_new in
    select * from (values
      ('admin_process_payout','IF NOT public.is_admin() THEN','IF NOT public.has_admin_permission(''finance'') THEN'),
      ('admin_process_refund','IF NOT public.is_admin() THEN','IF NOT public.has_admin_permission(''finance'') THEN'),
      ('admin_resolve_customer_cancellation_case','NOT public.is_admin()','NOT public.has_admin_permission(''finance'')'),
      ('admin_resolve_report','IF NOT public.is_admin() THEN','IF NOT public.has_admin_permission(''support'') THEN'),
      ('admin_review_talent','IF NOT public.is_admin() THEN','IF NOT public.has_admin_permission(''talent'') THEN'),
      ('admin_review_qris_payment','NOT public.is_admin()','NOT public.has_admin_permission(''finance'')'),
      ('admin_update_qris_settings','NOT public.is_admin()','NOT public.has_admin_permission(''finance'')'),
      ('get_admin_dashboard_overview','IF NOT public.is_admin() THEN','IF NOT public.is_super_admin() THEN'),
      ('review_talent_identity_change','IF NOT public.is_admin() THEN','IF NOT public.has_admin_permission(''talent'') THEN'),
      ('review_talent_service','IF NOT public.is_admin() THEN','IF NOT public.has_admin_permission(''talent'') THEN')
    ) as changes(function_name,old_guard,new_guard)
  loop
    select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=v_name and p.prokind='f';
    if v_oid is null then raise exception 'RPC % tidak ditemukan',v_name; end if;
    v_def:=pg_get_functiondef(v_oid);
    if position(v_old in v_def)=0 then raise exception 'Pola guard % tidak ditemukan pada %',v_old,v_name; end if;
    execute replace(v_def,v_old,v_new);
  end loop;
end
$migration$;
