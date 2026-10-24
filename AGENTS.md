# Dayline development rules

- Read `docs/ARCHITECTURE.md` and `docs/PROVIDER_PORTABILITY.md` for ownership,
  service boundaries, stable account IDs, and migration requirements.
- Follow `docs/INFRASTRUCTURE_POLICY.json`: free resources first, no automatic
  paid upgrades, and paid upgrades require explicit owner approval after
  owner-confirmed app revenue. These rules do not configure provider spending caps.
- Preserve guest planning. Keep provider HTTP/SDK logic in adapters, never expose
  privileged keys, and do not transfer data to new providers as incidental work.
- All current personalities stay free and payments disabled until a separately
  requested, implemented and reviewed launch change.
- Policy models and imported ledgers do not authorize purchases. Paid/admin
  features require authoritative server checks before deployment.
- Preserve account IDs, note schemas, storage keys and backups. Do not migrate live
  data or apply experimental migrations as part of unrelated preparations.
- Keep encryption isolated until its documented rollout gates pass.
- Run format/dependency checks and relevant behavior tests, with meaningful
  contract tests for persistence/interface changes. Use focused branches and PRs.
