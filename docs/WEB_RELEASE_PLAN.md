# Dayline website release plan

## 1. Finish the website

Validate daily and monthly planning, rich formatting, checkbox behavior, drag and swipe interactions, interval settings, personalities, quotes, reminders, Focus Mode, audio layers and presets, reflection reports, backups, and introduction behavior after leaving the sign-in page through either sign-in or the guest option. Verify keyboard and touch interactions, narrow screens, reduced motion, and storage/network failures.

Keep core guest use independent of an account service. Account creation remains optional; email sign-in and cross-device sync are unavailable until the existing integration is configured and tested.

## 2. Prepare free runtime hosting

Select a static host only when ready to launch. Confirm that its free plan allows the intended commercial use and has acceptable bandwidth, storage, and deployment limits. Publish the existing `dist/` directory without introducing a required build server.

Test every relative module/asset URL on the new base path, HTTPS behavior, storage, reminders, and audio. Verify the site before switching public links. Preserve the old site long enough for users to export notes and move them. Notes in browser storage do not automatically follow a domain change; provide a clear export/restore path and keep a rollback copy of the website.

If accounts will be offered, separately review backend and email-delivery costs, limits, authorization, sync, recovery, and the new site's configuration. Do not promise unlimited free sync.

## 3. Add the planned business model

Implement in separate, reviewable changes after the planning experience is ready:

1. Optional supporter payments through a chosen payment provider.
2. Clearly described paid extras, with purchase verification and entitlement recovery designed before selling them.
3. Reserved, unobtrusive banner placements that do not overlap notes, navigation, or Focus Mode and do not cause disruptive layout shifts.
4. Paid ad-free access, with consistent entitlement checks across ad placements.

Keep the basic planner understandable and useful. Review provider fees, commercial terms, applicable privacy/consent requirements, and support/refund handling at implementation time. No payment or advertising provider is active in the current website.

## 4. Launch checks

Run syntax and automated tests, complete the relevant live browser checks, verify backup transfers, and publish support/privacy information that reflects the actual services enabled. Verify any payment flow and ad-free behavior before making those offers public.

Record the deployed commit, hosting configuration, known limitations, and rollback instructions. GitHub can continue to hold the source even after runtime hosting moves elsewhere.
