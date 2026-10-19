# Dayline for Apple devices

SwiftUI app for iPhone and iPad, targeting iOS/iPadOS 17 or newer. The source includes a local-only development build and a separate optional private-iCloud build. Mac support is a later milestone; there is no Mac target yet.

## Open and run the local app

1. Use a Mac with Xcode 16 or newer. Clone this repository and open `apple/Dayline.xcodeproj`.
2. Select the **Dayline** scheme, then an iPhone/iPad simulator. Press Run. No signing team or paid membership is needed for the simulator.
3. To try a personal device, choose your own bundle identifier in the app target's **Signing & Capabilities**, select your **Personal Team**, connect the device, enable Developer Mode if requested, and Run. Apple's free personal-team provisioning is temporary and needs periodic reinstalling.
4. Start with local notes, backups, and reminders. The native app never asks for a Dayline account.

The placeholder bundle identifier is `com.angelsaber.Dayline`. Replace it with an available identifier you control before signing. Do not enter signing credentials into source files. No App Store app, developer membership, signing certificate, or iCloud container has been created for you.

## Source structure

- `Sources/DaylineCore/Planner.swift`: Foundation-only notes, calendar keys, interval insertion, reminder plans, backup validation.
- `Tests/DaylineCoreTests`: Swift unit tests for those rules.
- `Dayline/PlannerStore.swift`, `NoteRecord.swift`: on-device persistence and optional Core Data/CloudKit mirroring.
- `Dayline/DailyView.swift`: timeline, note editor, swipe actions, system drag/drop, date navigation, Move picker.
- `Dayline/SettingsView.swift`: intervals, notification permissions, backups, optional iCloud preference.
- `Dayline/Reminders.swift`: serial replacement of scheduled native notifications.
- `Dayline/DaylineApp.swift`: app lifecycle and reminder refreshes.

The Swift package is local; the app has no third-party package dependencies or network-hosted code. The Xcode project links the `DaylineCore` package from the same folder. Tests are run with SwiftPM rather than the Xcode app scheme.

## Optional private iCloud sync — later, after local testing

The **Dayline-iCloud** scheme uses `CloudDebug` for running and `CloudRelease` for archiving. Only these configurations include `DAYLINE_ICLOUD`, cloud entitlements, and background remote-notification support. The local scheme has none of those entitlements.

When you decide to enroll in the Apple Developer Program:

1. Set your signing team and final bundle identifier. In the iCloud scheme, provision **iCloud → CloudKit** and **Push Notifications** for that identifier. The container identifier is `iCloud.<your bundle identifier>` and must match the signing configuration.
2. Configure the container in Apple's CloudKit Console. Use the **private database**, never a public notes table. The source explicitly requests `.private` scope.
3. Run the iCloud scheme on real devices using the same Apple Account, then enable **Settings → Sync with my iCloud**. Close and reopen the app to apply the preference.
4. The same on-device SQLite store is used in both modes. Notes are saved locally first. iCloud transfers happen opportunistically; the UI reports availability/transfer events rather than promising immediate synchronization.
5. Verify the entire iCloud acceptance checklist before enabling production sync. Deploy the tested CloudKit schema to Production before TestFlight/App Store use. Do not ship the development container as production.

The preference is deliberately applied on the next app launch to avoid replacing a live persistent store. Turning it off stops mirroring after relaunch and keeps notes already in iCloud; it is not a cloud-data deletion control. Do not switch Apple Accounts without first exporting a backup and testing account-transition behavior.

Core Data/CloudKit uses its own property-level conflict behavior. The web prototype's custom three-way merge is **not** used by this app. Simultaneous edits to the same text, moves of several notes on two offline devices, duplicate backup imports, deletions, and Apple Account changes need explicit real-device testing and a conflict-recovery design before public release.

## Reminders

Permissions are requested only after enabling reminders in Settings. Incomplete, nonempty notes are grouped by displayed interval and scheduled as native local notifications. Completing, deleting, moving, or editing a note refreshes pending notifications while the app runs. App activation, significant time changes, and received cloud changes also refresh the plan.

The next 60 occupied intervals are scheduled. Open the app regularly to refill the window. Previously scheduled reminders can be delivered when the app is closed, subject to iOS settings and Focus; cross-device edits cannot immediately cancel a reminder on a device whose app has not yet received the edit. The app does not claim infinite scheduling or immediate background synchronization. Nonexistent local times during a spring-forward transition are skipped; repeated-hour behavior needs device testing.

## Backups

Export to Files and import version-1 JSON backups from the web prototype. Import is validated first, then added transactionally without replacing existing notes. Identical text/time/completion combinations within a day are skipped. Imported preferences do not change device settings or enable notifications automatically. Keep backups before changing signing identifiers, removing the app, switching Apple Accounts, or testing sync migrations.

## Check without signing

```sh
swift test --package-path apple
xcodebuild -project apple/Dayline.xcodeproj -scheme Dayline -configuration Debug -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO
xcodebuild -project apple/Dayline.xcodeproj -scheme Dayline-iCloud -configuration CloudDebug -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO
```

These commands assume you run them from the repository root on macOS. GitHub's Apple workflow runs equivalent checks. Simulator compilation is not proof that notifications, signing, account state, or live cloud transfers work.
