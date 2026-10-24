# Provider portability and free-first development

These preparations do not move accounts, change hosting, provision resources,
enable payments, or lock any personality. Supabase remains the current provider.

## Budget and hosting

Prefer free resources. No automatic paid upgrades or new paid resources are
authorized by routine development. Paid upgrades require explicit owner approval
after owner-confirmed app revenue. Review fees deducted from sales separately.
`INFRASTRUCTURE_POLICY.json` records this project rule; it is not a spending cap
configured in third-party accounts or a guarantee of unlimited free usage.

Before choosing a service, check its current free limits, commercial-use terms,
overage behavior, and spending controls. Monitor usage and preserve export/recovery
paths. Do not create accounts, add cards, or enable billing as a side effect of an
adapter change. `dist/` remains portable static output; no hosting provider's paid
build service is required. Guest browser storage still needs explicit backup
transfer when the site's origin changes.

## Account interfaces

`features/accounts/services.js` selects an explicitly registered provider; it never
loads adapter code from a configured URL. `service-contract.js` checks these ports:

| Port          | Contract                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `auth`        | `enabled`, `sessionKey`, `readSession`, `sendCode`, `sendLink`, `exchangeLink`, `verifyCode`, `signInPassword`, `signOut` |
| `notes`       | `loadDays`, `saveDay` with revision/conflict handling                                                                     |
| `preferences` | `loadPreferences`, `savePreferences` with revision/conflict handling                                                      |

The account controller and sync engines use these ports. `providers/supabase.js`
owns Supabase URLs, headers, session persistence/refresh, and REST/RPC mapping.
The public auth port exposes only user ID and optional email; tokens remain inside
the adapter. Existing browser session keys and stored credentials are unchanged.
This does not protect browser tokens against malicious same-origin JavaScript.

`cloud.js` retains compatibility exports for tests/private tools. The shared
callback parser retains existing PKCE URL cleanup. Unsupported providers fail
instead of silently sending credentials elsewhere; missing configuration leaves
guest planning usable. The current sign-in methods and private signup restriction
are unchanged. A disposable non-Supabase test adapter demonstrates the contract;
it is not a second production backend.

## Stable identities and migration formats

Treat current account UUIDs as stable **Dayline account IDs**. A replacement auth
subject must map to the same ID through protected server-side bindings. Do not
assign new ownership IDs or link accounts using only an unverified email address.
No identity mapping table or live migration is created by this preparation.

`features/portability/account-data.js` provides the versioned
`dayline-account-data` format: account ID, validated Daily/Weekly notes, rich text,
reports, attachment metadata, and shared preferences/personality. It omits sessions,
passwords, API keys, and provider response envelopes. Reading validates data only;
it does not prove ownership or write an account. Existing backup formats/UI stay
unchanged. This format contains **plaintext**, not encrypted backup data; attachment
binaries need a separate verified transfer.

The encrypted-vault prototype remains on its separate draft branch. Preserve its
owner IDs, vault IDs, wrapped keys, and envelope format when moving providers:
authenticated encryption binds those identities to ciphertext. Do not decrypt or
rewrite vaults merely to change backend. Authentication migration may require
supported password-hash transfer or reauthentication/reset; an ordinary note export
cannot transfer sessions or recover an encryption secret.

## Future purchase access

`features/access/policy.js` is a preparation model, **not an active paywall**.
All five personalities remain `free`; `PAYMENTS_ENABLED` is false. No checkout,
prices, payment provider, admin page, protected delivery, or purchase requirement
is enabled in the current UI.

Policies support `free` or `purchase` with a stable Dayline `productKey`, separate
from design files and processor price IDs. The future backend can map a product
key to a processor. Grants use stable account IDs, feature/product keys, active or
revoked status, a source (`purchase`, `admin`, `legacy`), and optional millisecond
validity boundaries. This supports bundles, free tester grants, refunds and later
processor changes. `dayline-access-ledger` serializes that provider-neutral data.

An imported ledger, browser `paid` flag, callback URL or user-editable metadata is
**not proof of payment**. The pure evaluator must receive authoritative policy and
grants loaded by a trusted server after authentication. It cannot distinguish a
forged browser object from a real server record itself. Imports must go through a
trusted, reconciled migration process, never grant access directly from uploads.

Before locking anything, implement server-owned policies/grants, owner/admin
permissions, verified idempotent payment events, refund/revocation handling, access
restoration, and protected feature/asset delivery. A separate admin app is optional;
hiding an Admin tab is not authorization. Public CSS/JS/music cannot be secured by
a hidden button, and downloaded assets can still be copied. Do not promise absolute
copy prevention. Keep a free fallback and never block reading/exporting existing
notes because a personality purchase expires. Purchase records stay separate from
note content and encryption keys. Keep third-party payment/ad scripts away from an
unlocked encrypted-note context; prefer hosted checkout and an isolated boundary.

## Actual provider cutover

A replacement must support owner-only access, stable identity mapping, atomic
revision checks, conflict responses, sign-out/recovery semantics, and equivalent
database isolation tests. Unit contract fakes do not establish production security.
Verify current free-plan limits and behavior before choosing a replacement.

For cutover: verify source exports, reconcile pending drafts, transfer files and
vaults, reconcile identities and purchase records, test a second device, stop stale
clients writing the old backend, and preserve rollback/export paths. Update redirect
URLs and hosted origins only after verifying the destination. Never silently fall
back to plaintext sync, merge users' accounts, or lose grants during transfer.

Future cloud files, encrypted-vault persistence, payment verification and admin
APIs should get their own adapters when implemented. They are not pretended to
exist here. There is no automatic provider switch or paid deployment.
