-- Disposable owner fixture; every write, including auth.users, is rolled back.
begin;
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
insert into auth.users(id) values(auth.uid());
set local role authenticated;
do $$
declare
  mode text;
  rev bigint := 0;
  result jsonb;
  prefs jsonb := '{"interval":60,"clock":"12","notifications":false,"sound":true,"availableHours":{},"tags":{}}';
begin
  foreach mode in array array['zen','builder','founder','poet','astronaut','gamer'] loop
    result := public.save_dayline_preferences(prefs || jsonb_build_object('layout',mode),rev);
    assert result->>'conflict'='false', 'Unexpected settings conflict';
    rev := rev+1;
    assert (result->>'revision')::bigint=rev, 'Revision did not increment';
  end loop;
  result := public.save_dayline_preferences(prefs || '{"layout":"astronaut"}',0);
  assert result->>'conflict'='true', 'Stale revision was accepted';
  begin
    perform public.save_dayline_preferences(prefs || '{"layout":"unknown"}',rev);
    raise exception 'Unknown mode was accepted';
  exception when raise_exception then
    if sqlerrm <> 'Invalid settings' then raise; end if;
  end;
end;
$$;
rollback;
