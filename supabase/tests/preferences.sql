begin;
insert into auth.users(id,email) values('33333333-3333-4333-8333-333333333333','settings-a@example.invalid'),('44444444-4444-4444-8444-444444444444','settings-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $$ declare p jsonb:='{"interval":30,"clock":"24","layout":"builder","notifications":true,"sound":true,"availableHours":{"from":540,"to":1020,"hideBefore":true,"hideAfter":false},"tags":{"disabledDefaults":[],"custom":[]}}';r jsonb;begin
 r:=public.save_dayline_preferences(p,0);if (r->>'revision')::int<>1 then raise exception 'Initial save failed';end if;
 r:=public.save_dayline_preferences(p,0);if not (r->>'conflict')::boolean then raise exception 'Stale revision accepted';end if;
 if (select count(*) from public.dayline_preferences)<>1 then raise exception 'Own settings inaccessible';end if;
end $$;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $$ begin
 if (select count(*) from public.dayline_preferences)<>0 then raise exception 'Settings leaked to another account';end if;
 update public.dayline_preferences set revision=99 where owner_id='33333333-3333-4333-8333-333333333333';
 if found then raise exception 'Another account updated settings';end if;
 begin
 insert into public.dayline_preferences(owner_id) values('33333333-3333-4333-8333-333333333333');
 raise exception 'Owner spoof allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform * from public.dayline_preferences;raise exception 'Anonymous read allowed';exception when insufficient_privilege then null;end;
 begin perform public.save_dayline_preferences('{}',0);raise exception 'Anonymous RPC allowed';exception when insufficient_privilege then null;end;
end $$;
rollback;
