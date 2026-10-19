# Activate accounts and cross-device notes

## What is already implemented

The GitHub Pages frontend includes an email-code login page, a guest option, per-account draft caches, revision-aware sync, deliberate guest-note import, sign-out, sync status, retry, and account-aware backup/restore. The database migration creates a private notes table, owner-only reads, and an authenticated compare-and-swap write function.

These files do not create a Supabase project or configure email delivery. Until the backend is configured, the login page says account setup is pending and lets people continue with device-local notes. Never treat the unit tests as confirmation that live accounts work.

## 1. Select a Supabase project

Use a dedicated project for Dayline. Record the project URL, normally `https://YOUR_PROJECT_REF.supabase.co`, and its **publishable** API key from project settings. The frontend currently accepts the `sb_publishable_…` key format. Create a publishable key if your project only exposes older legacy keys.

Never use a secret key, service-role key, database password, or Supabase management token in the frontend or GitHub repository. The publishable key identifies the application; authenticated user tokens and database authorization protect notes.

## 2. Apply the database migration

Run the complete contents of `supabase/migrations/202610190001_accounts.sql` in the project SQL editor, or apply it through your normal Supabase CLI migration workflow.

The migration creates `public.dayline_days` and `public.save_dayline_day`. Anonymous callers have no table or function access. Signed-in users can read only rows matching their authenticated identity. Direct table writes are revoked. The write function accepts no owner ID, derives it from the verified session, validates notes, locks the relevant row, and checks its revision. Deleting every note saves an empty revisioned day.

For database integration validation, use a **disposable development project** and execute `supabase/tests/access.sql` as one transaction. It creates two test users, checks owner isolation and anonymous denial, checks revision conflicts and direct-write denial, and rolls everything back. Run the whole script so its final rollback executes. Do not use an existing project with unrelated tables/triggers as the first test target.

## 3. Configure email codes

Enable email authentication and new-user sign-ups in Supabase Auth. The same email-code form serves new and existing users.

In **Authentication → Email Templates**, edit the **Magic Link** and **Confirm signup** templates to display `{{ .Token }}` as the sign-in code. For example:

```html
<h2>Your Dayline sign-in code</h2>
<p>Enter this code in Dayline:</p>
<p style="font-size:28px;letter-spacing:4px">{{ .Token }}</p>
<p>If you did not request this code, ignore this email.</p>
```

Keep the template variable exactly as shown. Codes are entered into the app rather than handled through a redirect/callback route. Configure a suitable code expiry and rate limits. The app accepts numeric codes of 6–10 digits. It prevents repeated send requests within one minute; Supabase applies its own server limits.

Configure custom SMTP or a supported transactional email provider for public users. Supabase’s built-in email service has delivery restrictions and low limits; do not assume it can send production sign-in codes to everyone. Keep provider credentials in Supabase Auth settings, never in this repository.

If you enable a CAPTCHA requirement, add its verified client challenge integration before enabling public sign-in; the current form does not submit a CAPTCHA token.

## 4. Set the public frontend configuration

Edit `dist/js/config.js`:

```js
export const cloudConfig = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  publishableKey: 'sb_publishable_YOUR_PUBLIC_KEY',
};
```

Use only the HTTPS origin, with no extra path, credentials, or query parameters. These two public configuration values can be checked into GitHub. Keep all other credentials out of source.

## 5. Validate and deploy

Run `npm run check` and `npm test`. Then publish the current `dist` using the included **Deploy GitHub Pages** workflow. Initial Pages setup is described in the README. Code commits alone do not run the manual deployment workflow.

## Live acceptance checks

1. Confirm a new email receives a numeric sign-in code, signs in, and loads an empty account. Repeat with an existing account and an expired/invalid code.
2. Create notes, complete one, move one, and delete one. Sign into the same account on a second device; check all changes within approximately 15 seconds or press **Sync now**.
3. Edit different notes simultaneously. Confirm both edits survive. Edit the same note in two places while offline, reconnect, and confirm both versions are retained with a conflict message.
4. Create account B in a separate browser. Confirm account A’s notes never appear. Confirm unauthenticated database access fails and attempts to choose another owner cannot write their rows.
5. Make an offline edit; reload; confirm the draft remains and later syncs. Close/reopen a tab after offline edits and confirm abandoned drafts recover. Wait at least 45 seconds after a browser crash for a stale lease to expire.
6. Import guest notes deliberately. Confirm cloud notes and original guest notes remain. Download and restore a backup into the intended account, then check the replacement on another device.
7. Test session refresh, expiry/revocation, sign-in again, and sign-out. Confirm sign-out does not log out another device and the current browser no longer shows account notes.
8. Test denied/full browser storage, failed network requests, narrow-screen login, keyboard navigation, and system notification permissions.

Account settings such as time interval, clock format, and reminders remain device-specific. The app must be online to request/verify sign-in codes. Cached sessions can keep local drafts when a network request fails; only the server’s acknowledgment produces the synced status. The site shell is not installed for offline use.

## Upstream documentation

- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/getting-started/api-keys
- https://github.com/supabase/auth/blob/master/README.md
