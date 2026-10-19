-- Private per-account days. Empty days remain as revisioned tombstones so a
-- stale device cannot resurrect a deleted note through a blind overwrite.
create table if not exists public.dayline_days (
  owner_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  entries jsonb not null default '[]'::jsonb,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  primary key (owner_id, day),
  constraint dayline_entries_array check (jsonb_typeof(entries) = 'array')
);

alter table public.dayline_days enable row level security;
drop policy if exists "Read own days" on public.dayline_days;
create policy "Read own days" on public.dayline_days
  for select to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.dayline_days from anon, authenticated;
grant select on public.dayline_days to authenticated;

-- All writes use an authenticated, compare-and-swap operation. The caller
-- cannot choose an owner. No client-provided identity is trusted.
create or replace function public.save_dayline_day(
  p_day date, p_entries jsonb, p_expected_revision bigint
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_row public.dayline_days;
begin
  if v_user is null then raise exception 'Sign-in required' using errcode = '28000'; end if;
  if p_day is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid day or revision';
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array'
    or octet_length(p_entries::text) > 1000000 then
    raise exception 'Invalid notes or day exceeds 1 MB';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_entries) as e
    where jsonb_typeof(e) <> 'object'
      or jsonb_typeof(e->'id') is distinct from 'string'
      or length(e->>'id') not between 1 and 200
      or jsonb_typeof(e->'text') is distinct from 'string'
      or jsonb_typeof(e->'done') is distinct from 'boolean'
      or jsonb_typeof(e->'minute') is distinct from 'number'
      or not (e->>'minute' ~ '^[0-9]{1,4}$')
  ) then raise exception 'Invalid note'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_entries) as e
    where (e->>'minute')::integer not between 0 and 1439
  ) then raise exception 'Invalid note time'; end if;
  if (select count(*) from jsonb_array_elements(p_entries)) <>
     (select count(distinct e->>'id') from jsonb_array_elements(p_entries) as e) then
    raise exception 'Duplicate note identity';
  end if;

  insert into public.dayline_days(owner_id, day) values (v_user, p_day)
    on conflict (owner_id, day) do nothing;
  select * into v_row from public.dayline_days
    where owner_id = v_user and day = p_day for update;
  if v_row.revision <> p_expected_revision then
    return jsonb_build_object('conflict', true, 'entries', v_row.entries, 'revision', v_row.revision);
  end if;
  update public.dayline_days set entries = p_entries,
    revision = revision + 1, updated_at = now()
    where owner_id = v_user and day = p_day returning * into v_row;
  return jsonb_build_object('conflict', false, 'revision', v_row.revision);
end;
$$;
revoke all on function public.save_dayline_day(date, jsonb, bigint) from public, anon;
grant execute on function public.save_dayline_day(date, jsonb, bigint) to authenticated;
