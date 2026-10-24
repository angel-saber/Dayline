import { Vault, validateDescriptor } from './vault-crypto.js';
import { plannerSnapshot, sealSnapshot, openSnapshot } from './vault-sync.js';
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function legacyManifest(rows) {
  if (!Array.isArray(rows)) throw new Error('Invalid source notes.');
  const seen = new Set();
  return rows
    .map((row) => {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(row.day) ||
        seen.has(row.day) ||
        !Number.isSafeInteger(row.revision) ||
        row.revision < 0
      )
        throw new Error('Invalid source revision.');
      seen.add(row.day);
      return { day: row.day, revision: row.revision };
    })
    .sort((a, b) => a.day.localeCompare(b.day));
}

// Preparing creates no server state and does not erase any source/cache.
// Commit is a separate action AFTER recovery and private backup verification.
export async function prepareMigration({
  ownerId,
  rows,
  preferences,
  deviceSettings,
  layout = 'zen',
  passphrase,
}) {
  const manifest = legacyManifest(rows);
  const settings = preferences?.preferences || deviceSettings;
  const preferencesRevision = preferences?.revision ?? null;
  if (
    preferencesRevision !== null &&
    (!Number.isSafeInteger(preferencesRevision) || preferencesRevision < 0)
  )
    throw new Error('Invalid preferences revision.');
  const { layout: remoteLayout, ...shared } = settings;
  const snapshot = plannerSnapshot(
    {
      version: 1,
      days: Object.fromEntries(rows.map((row) => [row.day, row.entries])),
      settings: shared,
    },
    remoteLayout || layout,
  );
  const { vault, recoveryKey } = await Vault.create(ownerId, passphrase);
  const payload = await sealSnapshot(vault, snapshot, 1);
  if (!equal((await openSnapshot(vault, payload)).snapshot, snapshot)) {
    vault.lock();
    throw new Error('Encrypted migration verification failed.');
  }
  const backup = {
    format: 'dayline-encrypted-backup',
    v: 1,
    descriptor: vault.descriptor,
    payload,
  };
  // Both wrappers must work before the caller sees the commit capability.
  const recovery = await Vault.unlock(backup.descriptor, ownerId, recoveryKey, 'recovery');
  try {
    if (!equal((await openSnapshot(recovery, payload)).snapshot, snapshot))
      throw new Error('Recovery verification failed.');
  } finally {
    recovery.lock();
  }
  let committed = false;
  return {
    vault,
    recoveryKey,
    backup,
    snapshot,
    async commit(cloud, { typedRecoveryKey, backupSaved = false } = {}) {
      if (committed) throw new Error('Migration was already committed.');
      if (!backupSaved || typedRecoveryKey !== recoveryKey)
        throw new Error('Save the encrypted backup and verify your recovery key before migrating.');
      // All plaintext migration tokens are revisions, never note content.
      let result;
      try {
        result = await cloud.migrate(backup.descriptor, payload, manifest, preferencesRevision);
      } catch (error) {
        // A response can be lost AFTER the server committed. Recognize only
        // this exact vault identity and decrypt the destination before success.
        const existing = await cloud.load?.().catch(() => null);
        if (
          existing?.descriptor?.vaultId !== backup.descriptor.vaultId ||
          !Number.isSafeInteger(existing.revision) ||
          existing.revision < 1
        )
          throw error;
        const packet = await openSnapshot(vault, existing.payload);
        if (packet.sequence > existing.revision) throw error;
        committed = true;
        return { conflict: false, revision: existing.revision, recovered: true };
      }
      if (!result || result.revision !== 1 || result.conflict)
        throw new Error('Migration did not commit. Re-read the source notes and try again.');
      committed = true;
      return result;
    },
  };
}

export async function openEncryptedBackup(backup, ownerId, secret, method = 'passphrase') {
  if (backup?.format !== 'dayline-encrypted-backup' || backup.v !== 1)
    throw new Error('Unsupported encrypted backup.');
  validateDescriptor(backup.descriptor, ownerId);
  const vault = await Vault.unlock(backup.descriptor, ownerId, secret, method);
  try {
    return { vault, ...(await openSnapshot(vault, backup.payload)) };
  } catch (error) {
    vault.lock();
    throw error;
  }
}
