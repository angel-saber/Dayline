-- Settings are separate from notes. RLS applies even inside the invoker RPC.
create table public.dayline_preferences (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  constraint preferences_object check (jsonb_typeof(preferences)='object' and octet_length(preferences::text)<=65536)
);
alter table public.dayline_preferences enable row level security;
create policy "Read own preferences" on public.dayline_preferences for select to authenticated using ((select auth.uid())=owner_id);
create policy "Create own preferences" on public.dayline_preferences for insert to authenticated with check ((select auth.uid())=owner_id);
create policy "Update own preferences" on public.dayline_preferences for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
revoke all on public.dayline_preferences from anon,authenticated;
grant select,insert,update on public.dayline_preferences to authenticated;

create function public.save_dayline_preferences(p_preferences jsonb,p_expected_revision bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  v_user uuid:=auth.uid();
  v_row public.dayline_preferences;
begin
  if v_user is null then raise exception 'Sign-in required' using errcode='28000';end if;
  if p_expected_revision is null or p_expected_revision<0 or p_preferences is null
    or jsonb_typeof(p_preferences)<>'object' or octet_length(p_preferences::text)>65536 then raise exception 'Invalid preferences';end if;
  if jsonb_typeof(p_preferences->'interval') is distinct from 'number'
    or not (p_preferences->>'interval' ~ '^[0-9]{1,4}$') then raise exception 'Invalid interval';end if;
  if (p_preferences->>'interval')::integer not between 1 and 1440
    or coalesce(p_preferences->>'clock','') not in ('12','24')
    or coalesce(p_preferences->>'layout','') not in ('zen','builder','founder')
    or jsonb_typeof(p_preferences->'notifications') is distinct from 'boolean'
    or jsonb_typeof(p_preferences->'sound') is distinct from 'boolean'
    or jsonb_typeof(p_preferences->'availableHours') is distinct from 'object'
    or jsonb_typeof(p_preferences->'tags') is distinct from 'object' then raise exception 'Invalid settings';end if;
  insert into public.dayline_preferences(owner_id) values(v_user) on conflict(owner_id) do nothing;
  select * into v_row from public.dayline_preferences where owner_id=v_user for update;
  if v_row.revision<>p_expected_revision then
    return jsonb_build_object('conflict',true,'preferences',v_row.preferences,'revision',v_row.revision);
  end if;
  update public.dayline_preferences set preferences=p_preferences,revision=revision+1,updated_at=now() where owner_id=v_user returning * into v_row;
  return jsonb_build_object('conflict',false,'revision',v_row.revision);
end;
$$;
revoke all on function public.save_dayline_preferences(jsonb,bigint) from public,anon;
grant execute on function public.save_dayline_preferences(jsonb,bigint) to authenticated;
