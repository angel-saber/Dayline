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

See [docs/WORKFLOW.md](docs/WORKFLOW.md) for implementation order, acceptance criteria, reordering rules, and manual release checks. Each behavior is isolated in an ES module under `dist/js`; no third-party runtime scripts or build pipeline are needed. GitHub Actions runs syntax and unit checks on pushes and pull requests.

## Reminders and storage limits

Reminders run while the app is open. Browsers may delay timers in background tabs or on sleeping devices. Closed-app reminders are not implemented. Some mobile browsers do not support the Notification constructor; in-app reminders still work. Sound requires an initial user gesture and can be blocked by browser or system settings. Test sound after reopening the app.

Changing interval lengths preserves all notes at their original stored times. If multiple notes fall into one longer interval, they appear together; reminders follow the displayed interval start. Dragging shifts intervening interval buckets toward the space left by the source, without discarding text. Undo is one step and is not retained after reload.

Browser storage is not cloud sync or a guaranteed backup. Download backups regularly. Restoring replaces all local data and disables reminders/sound until you enable them again. No service worker or offline installation is included.

## Validation

Run `npm run check` and `npm test`. Device/browser gestures, audio, permissions, and responsive layout also require the manual checks listed in the workflow document.
