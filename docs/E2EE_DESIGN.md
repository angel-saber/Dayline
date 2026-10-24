# Encrypted Dayline: design and rollout gates

Status: **experimental development branch; not enabled in the live app**.

The first deliverable is a working, isolated vault/sync/migration prototype. It
does not alter `dist/`, provision accounts, apply a production schema change, or
claim that existing Dayline notes are encrypted. The browser laboratory and SQL
candidate live under `experiments/e2ee/`, outside the published site and the normal
Supabase migration directory. All database acceptance tests use a disposable
PostgreSQL WASM instance, never the real account database.

## Goal and threat model

Protect note content from someone who obtains the database, a database backup,
or administrative database access but does not have the user's separate vault
passphrase, recovery key, or an unlocked device. The same account can sign in and
unlock on multiple devices. Authentication and owner-only database policies stay
in place in addition to encryption.

Encrypt titles, text, exact times/dates, task completion, rich formatting,
hyperlinks, indentation, categories/custom tag names, Weekly Notes, Focus reports,
guided activity reports, and synced settings inside one planner snapshot.
Attachment names/metadata belong inside it too. Attachment binary encryption is
supported by the cryptographic envelope, but file storage/sync integration is a
separate, unimplemented release gate. Existing attachment files remain local.

The server still learns account email/identity, vault identity, revision counts,
payload lengths, update times, IP/network information, and access patterns. No
server-side search or note-content analytics. A whole-planner snapshot avoids
exposing day indexes, at the cost of bandwidth and an explicit 12 MiB plaintext
limit in this prototype. Do not silently truncate an oversized account.

This does **not** protect an unlocked device, browser extension with page access,
malware, stolen live session/key material, or compromised website code. The app
owner controls future delivered JavaScript and could change it to steal keys at
unlock; ordinary web E2EE cannot eliminate that trust. Independent review,
reviewable builds, dependency controls, and strict code delivery help reduce the
risk. A hostile server can deny service/delete ciphertext and can replay old valid
snapshots to a completely new device. Cached devices reject revisions older than
their encrypted local high-water mark and authenticate a separate content sequence
inside the ciphertext, so relabeling old content with a higher outer CAS revision
does not bypass that check. Wrapper-only updates may advance CAS without changing
the content sequence. There is no global cryptographic
freshness guarantee. Do not claim one.

## Key hierarchy and protocol v1

Use the browser's established Web Crypto implementation, not a custom cipher or
a remotely loaded crypto script. Every primitive also runs in Node's Web Crypto
for tests. There is no runtime npm crypto dependency. The envelope protocol and
its composition still require independent expert review.

1. A random 256-bit root wrapping key identifies the vault. Long-lived unlocked
   roots are non-extractable `CryptoKey` objects held in memory only.
2. A **separate** user-chosen vault passphrase derives an AES-256-KW key using
   PBKDF2-HMAC-SHA-256, 600,000 iterations. Salt/context includes a random 256-bit
   salt, owner ID, vault ID, and a protocol/purpose label. Preserve the exact
   passphrase, including Unicode and spaces; never trim/truncate it. Creation
   requires at least 16 characters and recommends a password-manager-generated
   independent phrase. Length alone does not ensure entropy.
3. A separately generated 256-bit random recovery key derives another wrapping
   key through HKDF-SHA-256 with independent random salt and purpose/account/vault
   context. It wraps the same root. The recovery key is shown once and kept
   privately by the user, separately from backups. The server gets only wrapped
   roots and non-secret KDF parameters, never either unlocking secret.
4. Every encrypted item gets a **new random 256-bit AES-GCM content key** and
   random 96-bit IV. AES-256-KW wraps that content key with the root. A fresh
   content key on every seal avoids reusing an AES-GCM key/IV pair across normal
   writes. AES-GCM uses a 128-bit authentication tag.
5. Authenticated additional data binds protocol/version, owner ID, vault ID,
   item kind (`snapshot`, `draft`, `attachment`, `proof`), and record identity.
   This prevents swapping valid ciphertext into another record or account.
   A fixed encrypted proof verifies the root before unlock is accepted.
6. Validate exact versions/algorithms, key/IV sizes, canonical base64url, bounded
   lengths, and fixed KDF cost before doing cryptographic work. Wrong secrets,
   corrupted ciphertext, unknown formats, and missing vaults fail closed. They
   never become empty planners and never trigger plaintext fallback writes.

PBKDF2 is deliberately selected here for native browser support without a WASM
runtime. OWASP prefers memory-hard Argon2id when available; evaluating Argon2id,
measuring PBKDF2 cost on target phones, passphrase UX/strength, and selecting the
final protocol are security-review gates. Do not interpret the prototype's KDF
choice or OWASP's iteration guidance as a security audit.

Recovery changes the **vault passphrase**, not Supabase's account password. A
normal account password reset cannot decrypt notes. An authenticated user with a
recovery key can rewrap the root under a new passphrase without rewriting notes.
Descriptor updates are revision checked and cannot replace the vault identity,
encrypted proof, or recovery wrapper. Losing the account still requires account
access recovery separately. Losing both vault secrets and every unlocked device
means losing the ability to decrypt; the administrator cannot recover it.

Rewrapping is **not revocation**: old downloaded backups retain their old wrapper,
and an already-unlocked device still has the root. Actual compromise response
requires root/content-key rotation, session revocation, and re-encryption; that
workflow is not implemented in this prototype.

## Migration and server contract

`prepareMigration` reads existing account rows and settings, validates all note
fields, encrypts a complete snapshot, decrypts it to compare the result, verifies
the recovery wrapper, and builds a portable encrypted backup. This stage sends
nothing and deletes nothing. Guest notes and pre-existing device drafts require
an explicit reconciliation decision first; they must never be silently imported.

Before commit, the user must save the encrypted backup and re-enter the exact
recovery key. The implementation checks the key rather than relying on a simple
checkbox. The recovery key must be stored separately from that backup. In the
final UI, confirm this is done on the user's own device without developer tools
or model-visible credential entry.

The server RPC locks the account, compares the complete source day/revision
manifest (including empty tombstones) and nullable preferences revision, then
creates the ciphertext row and deletes current plaintext rows **in one database
transaction**. A stale source or any interruption rolls the entire transaction
back. A lost successful response can be recognized by loading and decrypting the
same vault identity; it must not start a new vault. The prototype tests an error
injected after ciphertext insertion and before plaintext deletion finishes.

No caller chooses an owner ID; every write derives it from `auth.uid()`. The
`dayline_vaults` table allows authenticated, owner-only reads and no direct client
writes. Three deliberately narrow security-definer RPCs expose migration,
snapshot CAS writes, and key-wrapper CAS updates. They use empty search paths,
explicit authentication, bounded opaque inputs, and revoked PUBLIC/anon execute.
The private trigger helpers cannot be called through the public API.

Guards on both legacy tables block plaintext INSERT/UPDATE once a vault exists,
including writes from an older tab. Migration and those guards use the same
account advisory lock. PostgreSQL can abort a competing transaction on deadlock;
reload/prepare again instead of retrying an old migration blindly. These guards
are not a substitute for staging concurrency tests on actual Supabase/Postgres.

Deleting current rows does **not** erase historical backups, WAL/PITR copies,
previous downloads, logs, existing plaintext device storage, or data already seen
by an administrator. Retention and local cleanup must be explained honestly.
There is no "retroactive privacy" guarantee.

## Sync and local persistence

`VaultSync` is a new async boundary. It decrypts only after explicit unlock,
merges on the device using Dayline's existing three-way note merge, and encrypts
before network or local-draft writes. Notes changed independently merge; competing
edits preserve both note versions. Settings merge by changed top-level field;
competing changes to the same field favor the local edit and report a conflict.
The whole snapshot uses CAS revisions, and edits made during upload remain
pending until saved in a later revision.

Encrypted device drafts include base/current snapshots and revisions and are
bound to account, vault, and tab. The caller must await `stage()` before saying
"saved". Disk/quota failure is an error; locking retries persistence and refuses
to discard a draft that cannot be saved. Reload/recovery is tested with the same
tab identity. Recovery across abandoned tabs and a live-tab lease needs planner
integration. Unlocking/reloading entirely offline is also a remaining UX gate;
the current initializer requires a successful encrypted server read.

Locking clears application state and key references and notifies the UI to clear
decrypted content. In-flight operations must not release plaintext after lock.
JavaScript garbage collection, strings, and browser memory mean secure memory
erasure cannot be guaranteed. A closed tab/unload is not a reliable async save
opportunity. Do not promise unsaved keystroke recovery.

## Full-planner integration gates (not completed)

The existing planner uses synchronous persistence. Do not adapt encryption by
writing a plaintext localStorage cache first and encrypting it later. Replace
that boundary deliberately, including correct save/error status and editor flush:

| Path | Required before enabling E2EE |
| --- | --- |
| Account entry | Detect vault before either legacy sync engine starts; show unlock UI over an empty planner, not guest/account notes. |
| Daily / Monthly / Weekly / More | Await durable encrypted staging for every mutation, bulk action, guided activity, drag/drop, undo, and background save. |
| Settings | Keep custom tags and personal availability inside encrypted storage; avoid the current plaintext preferences mirror. |
| Focus | Scope active drafts to the account; encrypt notes, mantra, interruption logs, and reflections; handle audio and minimized session during lock. |
| Device migration | Reconcile guest checkpoints and all unsynced/abandoned tab drafts before server cutover, with user-controlled backup and cleanup. |
| Files | Encrypt local binaries/metadata, account-scope file IDs, and implement encrypted cloud file transport before promising attachment sync. |
| Backups | Default encrypted backup; explicitly label deliberate plaintext exports; support account migration/rekey without falsely treating account ID as a recovery secret. |
| Sharing | Show that text/email/availability exports are deliberately decrypted and recipients can read/save them. |
| Notifications | While locked, no note content; generic reminders only if a privacy-preserving schedule exists. Explain optional lock-screen detail disclosure. |
| Lock / sign-out | Flush and await saves, clear all views/undo/search/share previews and secrets, stop reminder content/audio as appropriate, retain encrypted pending work. |
| Idle / reload | Explicit idle-lock behavior and stable device/tab draft recovery without storing raw keys. No automatic unlock from an auth session. |
| CSP / dependencies | No third-party JavaScript or analytics on the unlocked app origin. Ads must use a separate origin/sandbox without access to notes, DOM, or keys; payments should leave the sensitive origin. |

Do not rename the existing account login password to "encryption password". Auth
sees that password, so it cannot be the only secret protecting notes from the
server. The two concepts must stay distinct in the final product UI.

## Release sequence and acceptance

1. **This branch:** design, isolated crypto/sync/recovery/migration prototype,
   deterministic tests, and disposable PostgreSQL contract tests. No live data.
2. Replace every planner persistence path above in development. Keep the server
   cutover opt-in, account-scoped, and behind a development feature flag. Preserve
   the current live behavior until an approved deployment.
3. Test a separate staging database/project or local Supabase. Do not create a
   paid resource. Test real multi-session races, old-tab writes, dropped responses,
   offline recovery, quota failures, 12 MiB boundaries, large accounts, timezone
   changes, Safari desktop/iOS, Chrome/Android, keyboard/accessibility, and every
   feature's rich-note round-trip. Verify no note/secret leaks in network, storage,
   logs, errors, telemetry, notifications, or stale DOM after lock.
4. Obtain an independent cryptography/application-security review. Resolve the
   final KDF/envelope decisions, key-rotation/revocation story, recovery UX, and
   server/rollback threat model. Tests are not an independent security audit.
5. Only then consider an explicit opt-in rollout, verified private backups, safe
   migration, legacy-write guards, and clear privacy claims. A migrated account
   cannot safely use old plaintext clients. No automatic rollback to plaintext.

## Verification delivered with the prototype

- Passphrase/recovery unlock from independent instances, wrong secrets, wrong
  account, corrupt nonce/key/ciphertext, wrong record kind/ID, unsupported format,
  KDF downgrade/DoS bounds, fresh per-write keys, and lock during decryption.
- Interoperability against independent OpenSSL AES-KW/GCM APIs.
- Two-device note/settings merge, competing note edits, encrypted offline-draft
  reload, CAS collisions, in-flight edits, missing/tampered/older server state,
  and disk-full persistence failure.
- Migration recovery verification/backup gate, non-mutating preparation, and
  lost-response recovery.
- Disposable PostgreSQL acceptance: atomic rollback, source revision checks,
  legacy-write blocking, owner isolation, anonymous denial, direct-write denial,
  immutable vault identity on rewrap, encrypted cross-device persistence, and
  ciphertext-only request bodies.

Use `npm ci --ignore-scripts`, `npm run check`, and `npm test`. The one test-only
dependency, PGlite 0.5.11, is exactly pinned with its lockfile/integrity. No new
service or paid infrastructure is required for these tests. The Pages workflow
also refuses deployments from a non-main ref, including manual runs.

## Primary references

- W3C Web Crypto API: https://www.w3.org/TR/WebCryptoAPI/
- OWASP Cryptographic Storage: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- OWASP Password Storage: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- Supabase owner-only RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase password security: https://supabase.com/docs/guides/auth/password-security
- Supabase pgsodium guidance (server encryption is not this design): https://supabase.com/docs/guides/database/extensions/pgsodium
