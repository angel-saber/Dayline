# Private accounts and cross-device notes

Dayline is configured for a private personal test on the dedicated Supabase Free project `cxfohuoazhfjpohgtmgg`. Public sign-ups and anonymous Supabase accounts are disabled in the dashboard. Guest use remains available to everyone with browser-local notes.

## Sign-in

The deployed configuration uses `authMethod: 'link'` and `allowSignup: false`. Only existing, administrator-invited accounts can request a link. The browser flag hides the signup control; **the Supabase Auth setting is the actual signup restriction**. Do not enable public sign-ups as part of routine development.

Supabase's built-in email service sends the standard one-time sign-in link. Customizing its template now requires custom SMTP or a qualifying paid plan; personal testing uses the standard template without either. The built-in sender is restricted to organization team addresses and has low rate limits. Do not rely on it for public launch or delivery guarantees.

Request the link on the device/browser you want to sign into, then open the newest link in that same browser. On mobile, use the browser that opened Dayline, rather than an email app's separate in-app browser. Repeat independently on desktop and mobile. No Dayline password is required. An administrator invitation provisions the account; after receiving it, request a fresh sign-in link from Dayline.

Links use PKCE: a random verifier stays in this browser's local storage and only its SHA-256 challenge is sent with the email request. The returned authorization code is removed from browser history before exchange. The server validates the code and verifier; Dayline verifies that the returned email matches the requested account before saving the session. Arbitrary session tokens in URL fragments are not accepted. A missing, expired, or wrong-browser verifier requires a new link.

The code-based adapter remains available for future separately configured environments, but private testing does not need edited email templates. Never change the browser flag alone to launch public accounts.

## Private password accounts

The sign-in page also offers **Use a password instead**. It exchanges an existing email/password through Supabase Auth's password token endpoint, then uses the same notes/settings sync and owner-only policies as email-link sign-in. Passwords are not saved in Dayline storage or included in URLs. The field is cleared after each attempt. Email links remain the default for the owner's existing account.

To provision an additional private tester without email delivery, open Authentication → Users → Add user → **Create new user** in the dedicated Dayline project's dashboard. Enter the approved address, have the administrator/user enter a unique password directly into the dashboard, and select **Auto Confirm User**. Do not use Send invitation for this path. Keep public sign-ups disabled and email confirmation enabled. Never add testers as Supabase organization members. Do not commit passwords or send them through development logs/chat. Account creation must be completed privately by the user; deploying the password form alone does not create any account.

The tester can use the same credentials on desktop and mobile. Password recovery for these testers currently requires the administrator; the default email sender cannot deliver resets to non-team addresses. A private tester's successful sign-in and cross-device sync need live verification after provisioning.

## Backend

`supabase/migrations/202610190001_accounts.sql` creates `public.dayline_days` and `public.save_dayline_day`. Anonymous callers have no table or function access. Authenticated reads are restricted to the session owner's rows. Direct writes are revoked. The compare-and-swap function derives the owner from `auth.uid()`, validates notes, locks the row, and checks revisions. Empty days remain revisioned tombstones.

The write function intentionally uses `SECURITY DEFINER` so direct table writes remain unavailable. It has an empty search path, derives identity on the server, accepts no owner argument, and revokes execution from PUBLIC/anon. The Security Advisor reports its authenticated execution as a warning; this is the intended authenticated API, not permission for anonymous callers.

`supabase/tests/preferences.sql` also checks settings ownership, stale revisions, and anonymous denial. Both scripts roll back their test users and settings.

`supabase/tests/access.sql` exercises owner isolation, anonymous denial, direct-write denial, and stale-revision rejection. Run the complete transaction in a disposable development database; fixtures roll back. Never leave fixture users or notes in the live project.

## Public configuration and deployment

`dist/js/config.js` contains only the HTTPS project origin, its `sb_publishable_…` API key, and non-secret feature flags. Never commit a secret/service-role key, database password, management token, or user session.

Set the Supabase Site URL to the deployed Dayline root, currently `https://angel-saber.github.io/Dayline/`. Keep email confirmation enabled and other authentication providers disabled unless deliberately added. Use the dashboard's administrator invitation to provision the owner's address while keeping public signup disabled.

Run `npm run check` and `npm test`; then deploy `dist` through the GitHub Pages workflow. Verify actual email delivery, link return, and cross-device sync separately from unit tests.

## Notes, backups, and acceptance checks

Account notes include Daily notes, Weekly Notes, formatting, categories, and reports. Account preferences now sync separately in `public.dayline_preferences` through a revision-checked, security-invoker RPC with owner-only RLS. On the desktop with the desired setup, choose Settings → **Use this device’s settings on all devices** once to initialize preferences. Thereafter intervals, clock format, available hours, hidden hours, tag settings, personality, and reminder switches sync automatically. Unrelated simultaneous changes merge by setting; intentional changes to the same setting use the later successful change. Unsynced preferences are cached locally. Notification permission, audio activation, file binaries, and an active Focus session remain device-specific. Attachment metadata accompanies notes, but file binaries remain local to the browser; use a full backup to carry those files between devices.

Guest notes are never imported automatically. After signing in, use Settings → **Add this device's notes to my account** deliberately; the original guest notes are retained. Back up existing notes before first use. The sync engine keeps concurrent versions instead of silently overwriting conflicts.

For live acceptance, sign into the same account on desktop and mobile, create/edit/move/complete/delete a note, and confirm the second device updates within approximately 15 seconds or with **Sync now**. Also check Weekly Notes, simultaneous edits, offline drafts, refresh, sign-out, and invalid/expired links. Without a verified email sign-in on real devices, do not claim these checks have passed.

The Free project can pause after low activity. Resume it from the Supabase dashboard if necessary. Keep downloaded backups; the site is not an installed offline app.

## References

- https://supabase.com/docs/guides/auth/sessions/pkce-flow
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/platform/free-project-pausing
