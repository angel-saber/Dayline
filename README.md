# Dayline

A calm daily planner and time log. Write into time intervals, cross off what is done, and rearrange the day as plans change.

## Current direction: Apple-first, no hosting subscription

Dayline's native Apple app lives in [`apple/`](apple/). It saves on-device using Core Data and has optional private iCloud mirroring. It does not use a Dayline login, Supabase, an email service, or a server that the app owner pays to host. Each person's private iCloud storage is used when enabled. Device-local use remains available without iCloud.

The default **Dayline** Xcode scheme has no cloud entitlements. Use it for local development and limited personal-device testing with a free Apple account. The separate **Dayline-iCloud** scheme includes CloudKit configuration for later entitlement provisioning and multi-device testing. Apple's developer membership fee for App Store distribution is separate from hosting; no membership purchase or backend provisioning is performed by this repository.

See [apple/README.md](apple/README.md) to open the Xcode project and [docs/APPLE_RELEASE_PLAN.md](docs/APPLE_RELEASE_PLAN.md) for the remaining release work and validation limits. The iOS source is a development build, not an App Store-ready binary.

## Native app features

- Full midnight-to-midnight timeline; 15/30/60/120/240-minute and custom intervals.
- Text editing that saves as you type into an on-device SQLite store.
- Right swipe to complete/reopen, left swipe to delete; one-step undo.
- Hold and drag to insert a note into another interval and shift affected entries; Move picker and accessibility actions as alternatives.
- Date arrows, date picker, Today, progress, and 12/24-hour time.
- Native scheduled notifications with optional sound; a rolling window of 60 occupied intervals.
- JSON backup export and additive import, compatible with web-prototype backups.
- Optional private iCloud mirroring in a separately provisioned build; no new Dayline account.

## Web prototype

The original browser version remains in `dist`. With its current empty cloud configuration it opens directly into device-local mode. Its browser timers and storage are separate from the native app. Transfer notes using JSON backup/export.

```sh
git clone https://github.com/angel-saber/Dayline.git
cd Dayline
npm run check
npm test
npm start
```

Node.js 24+ runs the checks; Python 3 serves the static files at http://localhost:8080. No npm install is required.

The earlier Supabase account experiment is retained as unconfigured source (`dist/js/cloud.js`, `sync.js`, `accounts.js`, `supabase/`). It is **not** the chosen Apple-app architecture, and no Supabase project was created. Its older activation instructions in `docs/ACCOUNTS_SETUP.md` are optional reference material, not launch requirements.

## Host the optional web prototype

In the repository, choose **Settings → Pages → Source → GitHub Actions**, then **Actions → Deploy GitHub Pages → Run workflow**. This manually publishes `dist`; it does not package or publish the Apple app. The included public-repository workflows require no project secrets or paid Apple membership to compile the simulator configuration.

## Validation

- `npm run check` and `npm test` check the web prototype.
- `swift test --package-path apple` checks shared native scheduling, reminders, and backup logic on a machine with Swift.
- `Apple app checks` on GitHub uses macOS to run the Swift tests and compile both simulator configurations without code signing.
- Real-device gestures, persistence, notification delivery, CloudKit entitlement provisioning, two-device sync, and App Store submission require the acceptance checks in the Apple release plan. A successful simulator build does not validate live iCloud behavior.

Create a feature branch for each change, commit it, and open a pull request into `main`. Do not commit private planner backups, signing credentials, certificates, or account tokens.

### Focus Mode

At the bottom of Daily, **Launch Focus Mode** opens the current clock interval.
Choose or edit its note, review the optional task prompts, and commit to a suggested
or custom mantra. During work, mix locally generated binaural tones, ambient sound,
and a metronome; each layer has an independent volume. The inspiration pocket
changes every ten minutes. Each clock interval has a separate interruption page.
Minimizing keeps the session and audio active while the website stays open.

Earlier pages remain available. Continuing an unfinished note in the current
interval moves that interval's notes together into the next empty interval, including
across midnight. Finish fades the audio and offers an optional reflection. Each
session saves a separate expandable report in the most recently referenced note.
Reports are included in JSON backups. An active draft is saved in this browser;
refreshing offers a resume control, with audio restarted only by pressing Play.
