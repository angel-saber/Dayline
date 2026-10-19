# Dayline

A calm daily planner and time log. Write into time intervals, cross off what is done, and rearrange the day as plans change.

## Features

- Full daily timeline with 15-minute, 30-minute, 1-hour, 2-hour, 4-hour, and custom intervals.
- Multiline text; automatic saving on this browser/device.
- Swipe right to complete/reopen, left to delete; one-step undo.
- Hold a note’s six-dot handle and drag to insert it into another interval, shifting affected notes. A Move button supports keyboard and non-drag use.
- Previous/next day, Today, date picker, and completion progress.
- In-app reminders, optional browser notifications, optional chime, 12/24-hour time.
- JSON backup and restore.
- Email-code sign-in and private account notes across devices once the Supabase backend is configured.
- Automatic sync, offline draft recovery, and conflict preservation for edits on multiple devices.

## Run locally

Install Node.js 24+ for checks; Python 3 is used for the local static server. No npm install is required.

```sh
npm run check
npm test
npm start
```

Open http://localhost:8080. Serve the app over HTTP rather than opening index.html as a file. On hosting, use HTTPS for browser notification permission.

## Work on this repository

```sh
git clone https://github.com/angel-saber/Dayline.git
cd Dayline
npm run check
npm test
npm start
```

Create a feature branch for each change, commit the changes, and open a pull request into `main`. GitHub Actions runs the automated checks. Do not commit exported planner backups containing private notes.

## Host on GitHub Pages

In the repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**. Then open **Actions → Deploy GitHub Pages → Run workflow**. The provided workflow checks the app and publishes `dist`. It is manual so uploading code does not unexpectedly publish it.

GitHub Pages visibility depends on your account and repository settings; check access before using it for sensitive notes. The app saves notes on the current browser origin. Notes on a preview URL, localhost, and GitHub Pages are separate; use backup/restore to transfer them.

## Architecture and workflow

See [docs/WORKFLOW.md](docs/WORKFLOW.md) for implementation order, acceptance criteria, reordering rules, and manual release checks. Each behavior is isolated in an ES module under `dist/js`; no third-party runtime scripts or build pipeline are needed. `cloud.js` isolates the Supabase REST API, `sync.js` owns revision-aware merging, and `accounts.js` owns the sign-in screen and account lifecycle. GitHub Actions runs syntax and unit checks on pushes and pull requests.

## Reminders and storage limits

Reminders run while the app is open. Browsers may delay timers in background tabs or on sleeping devices. Closed-app reminders are not implemented. Some mobile browsers do not support the Notification constructor; in-app reminders still work. Sound requires an initial user gesture and can be blocked by browser or system settings. Test sound after reopening the app.

Changing interval lengths preserves all notes at their original stored times. If multiple notes fall into one longer interval, they appear together; reminders follow the displayed interval start. Dragging shifts intervening interval buckets toward the space left by the source, without discarding text. Undo is one step and is not retained after reload.

Without signing in, browser storage stays device-local. Signed-in notes sync to a configured Supabase project; drafts are cached by account and tab until the server acknowledges them. Download backups regularly. Restoring replaces the current account’s notes across devices (or device-local notes in guest mode) and disables reminders/sound until enabled again. No service worker or offline installation is included.

## Accounts and cross-device notes

The login page supports email sign-in codes for new and returning users. To activate it, follow [docs/ACCOUNTS_SETUP.md](docs/ACCOUNTS_SETUP.md). The checked-in `dist/js/config.js` is deliberately empty until a real project is configured; guest mode remains usable in the meantime. No backend is provisioned merely by uploading this code.

After activation, sign in with the same email on another device. Notes, completion, deletion, and moves sync automatically. Settings remain device-specific. In **Settings → Your account**, use **Add this device’s notes to my account** to migrate existing notes deliberately. Accounts never automatically receive another device user’s guest notes.

Synchronization runs after edits and about every 15 seconds while the app is open, on window focus, and after reconnecting. Changes to separate notes are merged. If the same note changes in two places, both versions are kept and a message explains the conflict. Empty days retain server revisions so deletions propagate. Offline writes stay pending rather than appearing as synced. A 1 MB limit applies to a single day’s account notes.

Local drafts include private notes. Sign out after synchronization on a shared device; this clears synced account caches in this browser while retaining any unsent drafts from other tabs for the next sign-in and revokes the current session. Other devices stay signed in. Normal web sessions remain stored in the browser between visits. Keep guest-note backups and restore them only to the intended account.

## Validation

Run `npm run check` and `npm test`. The suite includes mocked authentication and two-device sync tests. Device/browser gestures, audio, permissions, responsive layout, live email delivery, and database access controls also require the manual checks listed in the workflow and account setup documents. Mocked tests do not verify a deployed backend.
