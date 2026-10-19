# Dayline workflow

The accepted direction is an Apple-first, local-first app with optional private iCloud sync and no separately hosted Dayline account service.

1. Validate the native daily planner and local saving using the free local Xcode scheme.
2. Verify interval settings, gestures, drag insertion, date navigation, and accessible alternatives.
3. Verify native scheduled reminders, recovery, and backup/import on real devices.
4. Once Apple membership is appropriate, provision and test optional private CloudKit sync. It uses the same local store and each person's Apple Account; separate Dayline credentials are not required.
5. Complete cloud conflict/account-transition safeguards, TestFlight testing, and App Store materials before release.

See [APPLE_RELEASE_PLAN.md](APPLE_RELEASE_PLAN.md) for acceptance criteria and verification status, and [../apple/README.md](../apple/README.md) for Xcode setup and code structure.

The browser prototype remains in `dist/` and opens in device-local mode while its legacy cloud configuration is empty. Its original pure scheduling/storage tests and optional Supabase experiment are retained. Those earlier cloud-account instructions are not required for the selected Apple-app architecture, and no paid backend has been activated.
