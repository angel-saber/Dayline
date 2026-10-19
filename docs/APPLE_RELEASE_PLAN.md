# Dayline Apple release plan

## Accepted constraints

- No developer-paid backend hosting or email service.
- Native Apple app; local notes work without signing into Dayline.
- Optional sync through each person's private iCloud account and allowance.
- Local-first saving, native reminders, backup/export, no analytics or ads.
- Apple Developer Program membership is a separate distribution expense, deferred until needed. No Supabase project or paid service has been provisioned.

## 1. Local native app

Implemented source: SwiftUI daily view, configurable intervals, automatic Core Data saves, swipe completion/deletion, drag insertion with shifting, Move picker, one-step undo, calendar navigation, notifications, and web-compatible backup import/export.

Default Xcode scheme: `Dayline`, without cloud entitlements. Test on simulator first, then a personal device with free temporary provisioning. There is no Mac target yet.

Acceptance checks:

- Create/edit multiline notes, force-close/reopen, and confirm they persist.
- Test all presets, 1-minute, 47-minute, and 1440-minute custom intervals; preserve all text when regrouping.
- Reorder earlier/later, occupied/empty targets, long-distance drags, grouped notes, cancellation, and accessible Move actions.
- Swipe complete/reopen and delete; undo each action, including after navigating to another day. New text edits or received cloud changes invalidate stale undo snapshots.
- Check month/year/leap boundaries, midnight, DST, timezone changes, and 12/24-hour labels.
- Export and reimport backups from both web and Apple versions. Bad JSON, duplicate IDs, invalid dates, and oversized files must fail before writes. Import is additive.
- Block storage/save operations in a test harness; show the error without silently replacing the persistent store with an in-memory one.
- Check Dynamic Type, VoiceOver, keyboard, rotation, iPad layouts, and reduced motion.

## 2. Native reminders

Implemented source: user-triggered authorization; next 60 occupied intervals; no alerts for completed, empty, or past notes; optional system sound; refresh on app activation, edits, settings changes, significant time changes, and cloud imports.

Acceptance checks: permission allowed/denied, system sound off, Focus, foreground/background/terminated app, editing a scheduled interval, exhausted 60-item window, timezone changes, DST, expired notifications, and missed remote edits on sleeping devices. Explain scheduling limits in product copy. Do not claim guaranteed audible or instantaneous alerts.

## 3. Optional iCloud

Implemented source: separate iCloud scheme, private-database configuration, same local store in both modes, device-local opt-in, status/error descriptions. This has not provisioned a container or proved live sync.

Before public release:

- Provision entitlements and container with the final bundle ID and an eligible Apple membership.
- Test both devices with the same Apple Account, offline changes, long disconnections, full iCloud storage, unavailable network, disabled iCloud, device restore, and app reinstall.
- Design and test same-note conflict recovery. Core Data property merging does not by itself promise preservation of both text versions.
- Test concurrent multi-note reordering and deletion propagation. Add transaction/revision protection if field-wise merges can produce surprising schedules.
- Test duplicate imports and identity reconciliation across devices.
- Define and test Apple Account switching and cloud-data removal, with clear user controls before release. Disabling sync does not delete cloud copies.
- Verify local notes survive enabling/disabling sync and restarting. Export first during development migrations.
- Initialize and promote the tested development schema to Production. TestFlight must use the production environment.

## 4. App Store preparation

Still required: final app icon and screenshots, privacy policy/support URL, accurate App Privacy answers, tested iCloud data controls, complete accessibility review, signed release build, TestFlight feedback, crash/recovery testing, and submission metadata. No App Store approval or production reliability is claimed by adding the source files.

## Verification record

The authoring environment is Linux without Swift or Xcode, so the native source has not been compiled locally. It can check XML, repository wiring, and existing JavaScript logic. `Apple app checks` runs SwiftPM unit tests and builds both unsigned simulator schemes on GitHub's macOS runner. Record actual CI and device results separately; do not infer success from merely adding a workflow.

### Verified macOS CI result — 2026-10-19

At commit `c9684a60b41dc8857b05dfa69ffdc194066b0754`, all 9 Swift core tests passed and Xcode successfully built both the local-only and optional iCloud simulator configurations with code signing disabled. The project/plist validation also passed. See [the successful Apple app check](https://github.com/angel-saber/Dayline/actions/runs/39248417683).

The web prototype's 32 automated tests and JavaScript syntax checks also passed in the authoring environment. No interactive simulator session, physical-device test, live iCloud container transfer, signed archive, or App Store submission was performed. Those remain the next acceptance milestones.
