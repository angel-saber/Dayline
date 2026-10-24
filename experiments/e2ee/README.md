# Dayline encrypted vault laboratory

**Development prototype. Not enabled in Dayline. Use made-up data only.**

This directory is outside `dist/` so it is not published with GitHub Pages. The
SQL candidate is intentionally outside the normal Supabase migrations directory.
Do not apply it to the production project.

## Run

```sh
npm ci --ignore-scripts
npm run test:e2ee
npm run start:e2ee
```

Open http://127.0.0.1:8081/experiments/e2ee/ in your local browser. Stop the local
server when finished; it is for development, not public hosting.

The laboratory has no network connections and simulates a ciphertext-only server
and two devices within one browser tab. Create a test vault using a made-up
independent passphrase of at least 16 characters; save the recovery key privately.
Edit/save/sync on Desktop. Select Phone, enter the same passphrase, and unlock.
Edit/sync there, then return to Desktop and sync. Test lock/unlock, encrypted
backup download, and passphrase changes using either the original phrase or
recovery key. Restore into a separate browser profile so no test vault is erased.
This demonstration does not sign into or update your real Dayline account.

An encrypted backup does not include its recovery key. Keep both privately and
separately. Old backups retain their original passphrase wrappers. Passphrase
changes do not revoke already-unlocked devices. No real recovery emails exist in
the lab. It does not automatically save unsaved keystrokes on tab close.

## Code

- `vault-crypto.js`: versioned platform Web Crypto envelope, root wrapping,
  separate passphrase/recovery unlock, binary/JSON encryption, lock, and rewrap.
- `vault-sync.js`: ciphertext-only HTTP adapter and asynchronous durable draft /
  CAS sync engine using Dayline's existing client-side three-way merge.
- `migration.js`: validated source manifest, encryption/decryption/recovery
  verification, encrypted backup gate, and lost-response recovery.
- `migrations/`: unapplied SQL candidate with RLS, atomic cutover, legacy-write
  protection, and narrow authenticated CAS RPCs.
- `tests/`: crypto and network-failure tests plus a disposable PostgreSQL/PGlite
  acceptance test. Tests never connect to production Supabase.

Read [the complete design and release gates](../../docs/E2EE_DESIGN.md) before
integrating this into the planner. Main-app persistence, Focus drafts, file
storage, browser/mobile acceptance, and independent review remain required.
