-- EXPERIMENT ONLY: intentionally outside supabase/migrations. Never apply to
-- production before the release gates in docs/E2EE_DESIGN.md have passed.
create schema if not exists dayline_private;
revoke all on schema dayline_private from public, anon, authenticated;

create function dayline_private.valid_envelope(p jsonb) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(jsonb_typeof(p)='object'
    and (select count(*)=5 from jsonb_object_keys(p))
    and p->>'v'='1' and p->>'alg'='A256GCM+A256KW'
    and p->>'key' ~ '^[A-Za-z0-9_-]{54}$'
    and p->>'iv' ~ '^[A-Za-z0-9_-]{16}$'
    and length(p->>'data') between 22 and 16777238
    and p->>'data' ~ '^[A-Za-z0-9_-]+$'
    and octet_length(p::text)<=17000000,false)
$$;
create function dayline_private.valid_descriptor(p jsonb, p_owner uuid) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(jsonb_typeof(p)='object' and octet_length(p::text)<=4096
    and (select count(*)=6 from jsonb_object_keys(p))
    and p->>'v'='1' and p->>'ownerId'=p_owner::text
    and p->>'vaultId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and jsonb_typeof(p->'passphrase')='object'
    and (select count(*)=4 from jsonb_object_keys(p->'passphrase'))
    and p#>>'{passphrase,kdf}'='PBKDF2-SHA256'
    and p#>>'{passphrase,iterations}'='600000'
    and p#>>'{passphrase,salt}' ~ '^[A-Za-z0-9_-]{43}$'
    and p#>>'{passphrase,key}' ~ '^[A-Za-z0-9_-]{54}$'
    and jsonb_typeof(p->'recovery')='object'
    and (select count(*)=3 from jsonb_object_keys(p->'recovery'))
    and p#>>'{recovery,kdf}'='HKDF-SHA256'
    and p#>>'{recovery,salt}' ~ '^[A-Za-z0-9_-]{43}$'
    and p#>>'{recovery,key}' ~ '^[A-Za-z0-9_-]{54}$'
    and dayline_private.valid_envelope(p->'proof'),false)
$$;
revoke all on all functions in schema dayline_private from public, anon, authenticated;

create table public.dayline_vaults (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  descriptor jsonb not null,
  payload jsonb not null,
  revision bigint not null check(revision>=1),
  updated_at timestamptz not null default now()
);
alter table public.dayline_vaults enable row level security;
create policy "Read own encrypted vault" on public.dayline_vaults
  for select to authenticated using ((select auth.uid())=owner_id);
revoke all on public.dayline_vaults from public, anon, authenticated;
grant select on public.dayline_vaults to authenticated;

-- Legacy writes and migration share the same account lock. A stale client can
-- never put plaintext back after a completed migration. A PostgreSQL deadlock
-- aborts one entire transaction; callers must reload rather than blindly retry.
create function dayline_private.guard_plaintext_write() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.owner_id::text,0));
  if exists(select 1 from public.dayline_vaults where owner_id=new.owner_id) then
    raise exception 'This account requires encrypted sync. Update and unlock Dayline.';
  end if;
  return new;
end;
$$;
revoke all on function dayline_private.guard_plaintext_write() from public, anon, authenticated;
create trigger dayline_days_require_encryption before insert or update on public.dayline_days
  for each row execute function dayline_private.guard_plaintext_write();
create trigger dayline_preferences_require_encryption before insert or update on public.dayline_preferences
  for each row execute function dayline_private.guard_plaintext_write();

-- These narrow definer RPCs are intentional: authenticated clients have no
-- direct write privilege, no owner argument, and cannot bypass the CAS checks.
create function public.migrate_dayline_vault(
  p_descriptor jsonb,p_payload jsonb,p_expected_days jsonb,p_expected_preferences_revision bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid();v_manifest jsonb;v_preferences_revision bigint;
begin
  if v_user is null then raise exception 'Sign-in required' using errcode='28000';end if;
  if not dayline_private.valid_descriptor(p_descriptor,v_user)
    or not dayline_private.valid_envelope(p_payload) or p_expected_days is null
    or jsonb_typeof(p_expected_days)<>'array' then raise exception 'Invalid encrypted migration';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,0));
  if exists(select 1 from public.dayline_vaults where owner_id=v_user) then raise exception 'Vault already exists';end if;
  -- Locks preserve a consistent source until the encrypted destination commits.
  perform 1 from public.dayline_days where owner_id=v_user for update;
  perform 1 from public.dayline_preferences where owner_id=v_user for update;
  select coalesce(jsonb_agg(jsonb_build_object('day',day::text,'revision',revision) order by day),'[]'::jsonb)
    into v_manifest from public.dayline_days where owner_id=v_user;
  select revision into v_preferences_revision from public.dayline_preferences where owner_id=v_user;
  if v_manifest is distinct from p_expected_days
    or v_preferences_revision is distinct from p_expected_preferences_revision then
    raise exception 'Source changed. Prepare a fresh encrypted migration.' using errcode='40001';
  end if;
  insert into public.dayline_vaults(owner_id,descriptor,payload,revision) values(v_user,p_descriptor,p_payload,1);
  delete from public.dayline_days where owner_id=v_user;
  delete from public.dayline_preferences where owner_id=v_user;
  return jsonb_build_object('conflict',false,'revision',1);
end;
$$;
create function public.save_dayline_vault(p_payload jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_row public.dayline_vaults;
begin
  if v_user is null then raise exception 'Sign-in required' using errcode='28000';end if;
  if p_expected_revision is null or p_expected_revision<1 or not dayline_private.valid_envelope(p_payload) then raise exception 'Invalid encrypted save';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,0));
  select * into v_row from public.dayline_vaults where owner_id=v_user for update;
  if not found then raise exception 'Vault missing';end if;
  if v_row.revision<>p_expected_revision then return jsonb_build_object('conflict',true,'revision',v_row.revision);end if;
  update public.dayline_vaults set payload=p_payload,revision=revision+1,updated_at=now() where owner_id=v_user returning * into v_row;
  return jsonb_build_object('conflict',false,'revision',v_row.revision);
end;
$$;
create function public.rewrap_dayline_vault(p_descriptor jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_row public.dayline_vaults;
begin
  if v_user is null then raise exception 'Sign-in required' using errcode='28000';end if;
  if p_expected_revision is null or p_expected_revision<1 or not dayline_private.valid_descriptor(p_descriptor,v_user) then raise exception 'Invalid encrypted key update';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,0));
  select * into v_row from public.dayline_vaults where owner_id=v_user for update;
  if not found then raise exception 'Vault missing';end if;
  if v_row.revision<>p_expected_revision then return jsonb_build_object('conflict',true,'revision',v_row.revision);end if;
  if p_descriptor->>'vaultId'<>v_row.descriptor->>'vaultId'
    or p_descriptor->'proof'<>v_row.descriptor->'proof'
    or p_descriptor->'recovery'<>v_row.descriptor->'recovery' then raise exception 'Key update cannot replace vault identity or recovery';end if;
  update public.dayline_vaults set descriptor=p_descriptor,revision=revision+1,updated_at=now() where owner_id=v_user returning * into v_row;
  return jsonb_build_object('conflict',false,'revision',v_row.revision);
end;
$$;
revoke all on function public.migrate_dayline_vault(jsonb,jsonb,jsonb,bigint) from public,anon;
revoke all on function public.save_dayline_vault(jsonb,bigint) from public,anon;
revoke all on function public.rewrap_dayline_vault(jsonb,bigint) from public,anon;
grant execute on function public.migrate_dayline_vault(jsonb,jsonb,jsonb,bigint) to authenticated;
grant execute on function public.save_dayline_vault(jsonb,bigint) to authenticated;
grant execute on function public.rewrap_dayline_vault(jsonb,bigint) to authenticated;
