# Dayline implementation workflow

## User flow

Open Daily → choose a date → click an empty interval → type a plan or log → text saves as you type → complete, delete, edit, or reschedule → review progress.

Open Settings → select 15 minutes, 30 minutes, 1 hour, 2 hours, 4 hours, or a custom whole-minute interval → return to Daily. Set reminders and sound independently. Use bottom arrows repeatedly or the date picker for any day.

## Clean code structure

No framework or runtime dependencies. Static files run on GitHub Pages with relative asset paths. `model.js` holds pure date, interval, grouping, insertion, and reminder-selection functions. `storage.js` owns validation and versioned local persistence. `gestures.js` owns pointer interactions. `reminders.js` owns notification scheduling and audio. `app.js` binds application state and DOM views. Styles live in one CSS file. Guest mode remains local. Optional account mode uses `cloud.js` for Supabase HTTP calls, `sync.js` for revisioned day synchronization, and `accounts.js` for account lifecycle and sign-in UI. Only a public project URL/publishable key belong in the frontend; no privileged database keys or analytics are included.

## Feature sequence and acceptance criteria

1. **Daily timeline and logging:** a complete midnight-to-midnight grid; multiline plain text; automatic local saving; editing existing text; a clean initial empty state.
2. **Settings:** all requested presets and 1–1440-minute custom intervals; an uneven last interval ends at midnight. Existing minute-anchored notes survive regrouping and remain individually editable.
3. **Date navigation:** previous/next arrows, Today, and a date picker. Date keys use local calendar days rather than UTC to avoid shifting dates.
4. **Completion/deletion:** swipe right toggles completion; swipe left deletes; buttons provide equivalent actions. One-step undo restores the previous day state after these actions or a move.
5. **Reordering:** hold the six-dot handle for 350 ms, drag to a highlighted interval, release. A note replaces the destination; every intervening bucket shifts one slot toward the original slot, including empty buckets. This is insertion rather than a two-way swap. Notes sharing a bucket after regrouping are retained. Auto-scroll near screen edges. Keyboard/touch Move button provides a time picker.
6. **Reminders:** unfinished nonempty notes trigger at interval start for the current local day. Optional browser notification, in-app reminder, optional synthesized chime. Permission requests happen only after user interaction. At most one reminder per note/time per open session. Skip stale reminders over one minute old after device sleep. Keep the app open; background execution and sound are subject to browser/device limits.
7. **Data resilience:** export/restore JSON, backup validation, explicit replacement confirmation, safe handling of corrupt stored data and full/blocked storage, and cross-tab updates.
8. **Validation and handoff:** syntax checks, Node unit tests for calendar edges and data-preserving reordering, GitHub CI, optional Pages deployment, manual interaction checklist.

## Deliberately deferred

Server-backed push, native mobile packaging, recurrence, and collaboration. Accounts and cross-device note sync are now implemented; activation depends on configuring the real Supabase backend. Reliable notifications when the app is closed require a server/push or native scheduling design; this version does not imply those exist.

## Manual browser checks before a release

- Desktop and mobile: add/edit multiline notes; reload; confirm text remains literal, including HTML-like text.
- Change each preset and custom 47-minute intervals; verify no notes disappear.
- Swipe on note text and padding; short/vertical gestures must not delete. Test a right swipe again to reopen.
- Hold handle and drag both directions, occupied and empty destinations, and near both screen edges. Test cancellation and Move dialog by keyboard.
- Undo deletion, completion, and drag; navigate dates and undo into its original day.
- Test year/month boundaries and Today across midnight; 12/24-hour display.
- Enter a note in the next minute using 1-minute intervals. Test allowed/denied/unsupported notifications, sound muted/unmuted, tab visible/hidden, and device sleep.
- Test backup round trip, canceled restore, malformed JSON, storage blocked/full, and two open tabs.
- Confirm visible keyboard focus, zoomed text, narrow screens, and reduced-motion preference.

Automated tests cover pure logic and persistence. Browser/device interaction checks must be reported separately from unit tests.

## Account workflow

Sign-in page → email address → request code → verify emailed code → load only this account’s days → use planner → local draft is cached immediately → revision-checked server save → “Synced across devices.” Another signed-in device polls for updates. Settings and sound permissions stay on each device.

Guest notes are separate. An explicit import adds them to the currently signed-in account without removing either original dataset. Account sign-out waits for synchronization before revoking the current session and removing synced account draft caches; unsent work from other tabs is retained for the next sign-in. Recoverable abandoned-tab caches are replayed after loading the latest server state.

The database selects rows with an owner policy. Writes use an authenticated function that derives ownership from `auth.uid()`, validates note payloads, locks the row, and rejects stale revisions. No user ID is accepted from the client as write ownership. Conflicts are merged against an acknowledged baseline; both changed versions are preserved. Settings, logout, backups, and initial load are separate from sync state.

See ACCOUNTS_SETUP.md for activation and live acceptance checks. Email delivery, SQL migration execution, and real cross-account isolation need a configured test project; unit mocks alone are not proof of those integrations.
