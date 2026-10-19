-- Run against a disposable Supabase development database as the SQL editor
-- role. The transaction rolls back all fixtures. Never run with autocommit.
begin;
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'dayline-test-a@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'dayline-test-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select public.save_dayline_day('2026-10-19', '[{"id":"a","minute":540,"text":"private A","done":false}]', 0);
do $$ begin
  if (select count(*) from public.dayline_days) <> 1 then raise exception 'Own row not readable'; end if;
  if not (public.save_dayline_day('2026-10-19', '[]', 0)->>'conflict')::boolean then
    raise exception 'Stale revision was not rejected';
  end if;
end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
do $$ begin
  if (select count(*) from public.dayline_days) <> 0 then raise exception 'Account A leaked to B'; end if;
end $$;
select public.save_dayline_day('2026-10-19', '[{"id":"b","minute":600,"text":"private B","done":false}]', 0);
do $$ begin
  if (select entries->0->>'text' from public.dayline_days) <> 'private B' then raise exception 'Wrong account read'; end if;
  begin
    update public.dayline_days set entries = '[]';
    raise exception 'Direct write unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform * from public.dayline_days;
    raise exception 'Anonymous read unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_dayline_day('2026-10-19', '[]', 0);
    raise exception 'Anonymous write unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
