// Disposable PostgreSQL/WASM only. No production connection or user data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { Vault, rewrapPassphrase } from '../vault-crypto.js';
import { prepareMigration } from '../migration.js';
import { VaultCloud, VaultSync, openSnapshot } from '../vault-sync.js';
const owner = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222';
const phrase = 'independent fixture vault passphrase';
const sql = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('PostgreSQL contract: migration is atomic, owner-only, revision-checked and blocks stale plaintext clients', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated;
      insert into auth.users values('${owner}'),('${other}');
    `);
    await db.exec(await sql('../../../supabase/migrations/202610190001_accounts.sql'));
    await db.exec(await sql('../../../supabase/migrations/20261024090555_account_preferences.sql'));
    await db.exec(await sql('../migrations/20261024103608_encrypted_vault_prototype.sql'));
    const asUser = async (id = owner) => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.exec('set role authenticated');
    };
    const rpc = async (name, args) => {
      const parameters = args.map((_, i) => '$' + (i + 1)).join(',');
      return (
        await db.query(
          `select public.${name}(${parameters}) as result`,
          args.map((value) =>
            typeof value === 'object' && value !== null ? JSON.stringify(value) : value,
          ),
        )
      ).rows[0].result;
    };
    await asUser();
    const entries = [
      {
        id: 'private',
        text: 'PRIVATE migration text',
        title: 'Secret title',
        minute: 615,
        done: false,
        tags: ['project', 'event'],
      },
    ];
    await rpc('save_dayline_day', ['2026-10-24', entries, 0]);
    const preferences = {
      interval: 60,
      clock: '12',
      layout: 'zen',
      notifications: false,
      sound: false,
      availableHours: { from: 540, to: 1020, hideBefore: false, hideAfter: false },
      tags: { custom: [], disabledDefaults: [] },
    };
    await rpc('save_dayline_preferences', [preferences, 0]);
    const prepared = await prepareMigration({
      ownerId: owner,
      rows: [{ day: '2026-10-24', entries, revision: 1 }],
      preferences: { preferences, revision: 1 },
      passphrase: phrase,
    });
    const raw = prepared.backup;
    const migrate = (manifest) =>
      rpc('migrate_dayline_vault', [raw.descriptor, raw.payload, manifest, 1]);
    await assert.rejects(
      rpc('migrate_dayline_vault', [
        raw.descriptor,
        raw.payload,
        [{ day: '2026-10-24', revision: 1 }],
        0,
      ]),
      /Source changed/,
    );
    await assert.rejects(migrate([{ day: '2026-10-24', revision: 0 }]), /Source changed/);
    assert.equal(
      (await db.query('select count(*)::int as n from public.dayline_days')).rows[0].n,
      1,
    );
    assert.equal(
      (await db.query('select count(*)::int as n from public.dayline_vaults')).rows[0].n,
      0,
    );
    // Fail AFTER ciphertext insertion: PostgreSQL must roll back both changes.
    await db.exec('reset role');
    await db.exec(`create function public.fail_migration_delete() returns trigger language plpgsql as $$ begin raise exception 'Injected interruption';end;$$;
      create trigger injected_failure before delete on public.dayline_days for each row execute function public.fail_migration_delete();`);
    await asUser();
    await assert.rejects(migrate([{ day: '2026-10-24', revision: 1 }]), /Injected interruption/);
    assert.equal(
      (await db.query('select count(*)::int as n from public.dayline_days')).rows[0].n,
      1,
    );
    assert.equal(
      (await db.query('select count(*)::int as n from public.dayline_vaults')).rows[0].n,
      0,
    );
    await db.exec('reset role');
    await db.exec('drop trigger injected_failure on public.dayline_days');
    await asUser();
    const requests = [];
    const adapter = new VaultCloud({
      async signedRequest(path, options) {
        requests.push(JSON.stringify({ path, ...options }));
        if (!options)
          return (
            await db.query(
              'select descriptor,payload,revision::float8 as revision from public.dayline_vaults',
            )
          ).rows;
        const body = options.body,
          name = path.split('/').at(-1);
        const fields = {
          migrate_dayline_vault: [
            'p_descriptor',
            'p_payload',
            'p_expected_days',
            'p_expected_preferences_revision',
          ],
          save_dayline_vault: ['p_payload', 'p_expected_revision'],
          rewrap_dayline_vault: ['p_descriptor', 'p_expected_revision'],
        }[name];
        return rpc(
          name,
          fields.map((key) => body[key]),
        );
      },
    });
    await prepared.commit(adapter, { typedRecoveryKey: prepared.recoveryKey, backupSaved: true });
    assert.equal(
      (await db.query('select count(*)::int as n from public.dayline_days')).rows[0].n,
      0,
    );
    assert.equal(
      (await db.query('select count(*)::int as n from public.dayline_preferences')).rows[0].n,
      0,
    );
    const row = await adapter.load();
    assert.equal(row.revision, 1);
    await assert.rejects(migrate([{ day: '2026-10-24', revision: 1 }]), /Vault already exists/);
    await assert.rejects(
      rpc('save_dayline_day', ['2026-10-24', entries, 0]),
      /requires encrypted sync/,
    );
    await assert.rejects(
      rpc('save_dayline_preferences', [preferences, 0]),
      /requires encrypted sync/,
    );
    await assert.rejects(
      db.query('insert into public.dayline_preferences(owner_id,preferences) values($1,$2)', [
        owner,
        JSON.stringify(preferences),
      ]),
      /requires encrypted sync/,
    );
    await assert.rejects(
      db.query('update public.dayline_vaults set revision=100'),
      /permission denied/,
    );
    // Wire-to-SQL-to-second-device acceptance test, not only mocks.
    const cache = new Map(),
      storage = { getItem: (k) => cache.get(k) ?? null, setItem: (k, v) => cache.set(k, v) };
    const first = new VaultSync({ vault: prepared.vault, cloud: adapter, storage, tabId: 'first' });
    await first.initialize();
    const next = first.snapshot;
    next.state.days['2026-10-24'][0].text = 'PRIVATE updated from first';
    await first.stage(next);
    await first.sync();
    const secondVault = await Vault.unlock(row.descriptor, owner, phrase);
    const second = new VaultSync({ vault: secondVault, cloud: adapter, storage, tabId: 'second' });
    await second.initialize();
    assert.equal(second.snapshot.state.days['2026-10-24'][0].text, 'PRIVATE updated from first');
    const updated = await adapter.load();
    assert.equal(updated.revision, 2);
    assert.equal((await adapter.save(raw.payload, 1)).conflict, true);
    const rewrapped = await rewrapPassphrase(
      updated.descriptor,
      owner,
      prepared.recoveryKey,
      'replacement encryption passphrase',
      'recovery',
    );
    assert.equal((await adapter.rewrap(rewrapped, 1)).conflict, true);
    assert.equal((await adapter.rewrap(rewrapped, 2)).revision, 3);
    const after = await adapter.load();
    assert.deepEqual(after.payload, updated.payload);
    const recovered = await Vault.unlock(
      after.descriptor,
      owner,
      'replacement encryption passphrase',
    );
    assert.equal(
      (await openSnapshot(recovered, after.payload)).snapshot.state.days['2026-10-24'][0].text,
      'PRIVATE updated from first',
    );
    recovered.lock();
    await assert.rejects(
      adapter.rewrap({ ...rewrapped, vaultId: other }, 3),
      /cannot replace vault identity/,
    );
    await asUser(other);
    assert.equal((await db.query('select * from public.dayline_vaults')).rows.length, 0);
    await assert.rejects(adapter.save(raw.payload, 3), /Vault missing/);
    await assert.rejects(
      rpc('migrate_dayline_vault', [raw.descriptor, raw.payload, [], null]),
      /Invalid encrypted migration/,
    );
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from public.dayline_vaults'), /permission denied/);
    await assert.rejects(adapter.save(raw.payload, 3), /permission denied/);
    await assert.rejects(adapter.rewrap(rewrapped, 3), /permission denied/);
    await assert.rejects(
      rpc('migrate_dayline_vault', [raw.descriptor, raw.payload, [], null]),
      /permission denied/,
    );
    for (const secret of ['PRIVATE', 'Secret title', phrase, prepared.recoveryKey])
      assert.ok(!requests.join('').includes(secret));
    await first.lock();
    await second.lock();
  } finally {
    await db.close();
  }
});
