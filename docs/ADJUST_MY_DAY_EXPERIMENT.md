# Adjust my day test

The pre-experiment website is preserved at commit
`023c9dda1047ece9285fbc0f31ae0caef03a1192`, on the branch
`rollback/before-adjust-my-day`.

This experiment is a separate PR. Before merge, closing the PR leaves the live
website unchanged. After merge, revert the experiment's merge commit through a
new PR (or deploy the preserved branch) to restore that code version. Do not reset
main or overwrite later unrelated work. Redeploy the reverted version through the
normal Pages workflow. Code rollback does not reverse note edits made while testing.

For an immediate UI rollback, turn off **Show the Adjust my day experiment on
Daily** in Settings. The toggle uses only
`dayline.adjust-my-day.enabled.v1` on the current browser/device; no backend,
account preference schema, or existing note format changes. The Daily card starts
collapsed. It is only available when viewing today's date. Five situations are
self-selected; unchecked notes never classify someone automatically. No paid AI,
analytics, automatic reminders, or background schedule changes are involved.

Start/on-time/ahead offer existing note navigation and an optional two-minute
pause. Behind/overloaded offer selected unfinished, non-repeating Daily notes, a
new date/time and spacing between starts. The preview lists original and proposed
positions, exact-time conflicts, out-of-hours starts and midnight rollover.
Spacing is not task duration; this version does not infer workload or priority.
Unselected notes stay unchanged. Repeating notes use the existing series-aware
Reschedule UI. All-day notes become explicitly timed only when selected/applied.

Applying checks affected days against the preview snapshot, checks that the start
has not passed, uses existing rescheduling rules, and writes through the existing
persistence path. A successful write offers the app's existing one-step Undo.
Undo is replaced by later edits and is not a permanent transaction history. Failed
writes restore in-memory days and do not report success. Use Settings backup
export before experimenting with a real schedule for recovery beyond that Undo.
The short pause runs only while this card remains rendered; it is not a reminder
or a saved Focus session. Suggestions and selection state are not saved.
