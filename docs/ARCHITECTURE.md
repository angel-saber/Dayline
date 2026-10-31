# Dayline code map

Dayline is a static website using browser-native JavaScript modules. There is no
runtime framework, paid build service, or required hosting platform. `dist/`
remains the complete deployable website. Development tools run locally or in the
existing GitHub Actions checks.

## Directory responsibilities

| Directory                       | Responsibility                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `dist/js/app/`                  | Application startup, view coordination, and connections between features.          |
| `dist/js/features/accounts/`    | Sign-in, account sync, synced preferences, and device-note recovery.               |
| `dist/js/features/activities/`  | Guided activity catalog, rules, UI, and saved reports.                             |
| `dist/js/features/attachments/` | Browser-local file storage, upload review, and supported compression.              |
| `dist/js/features/bulk/`        | Selection, categories, multi-note changes, and batch actions.                      |
| `dist/js/features/daily/`       | Timeline gestures, held drop targets, and rescheduling.                            |
| `dist/js/features/focus/`       | Session rules, UI, and report rendering.                                           |
| `dist/js/features/yearly/`      | Flexible annual directions, quarter intentions, reflections and linked next steps. |
| `dist/js/features/monthly/`     | Month navigation, compact day views, and undated Weekly Notes.                     |
| `dist/js/features/notes/`       | Shared editor, tags, note rendering, and formatting rules.                         |
| `dist/js/features/onboarding/`  | First-visit setup and personality previews.                                        |
| `dist/js/features/reminders/`   | Planned-note timing, notification navigation, and reminder audio.                  |
| `dist/js/features/settings/`    | Settings controls, available hours, and backup/restore workflows.                  |
| `dist/js/features/sharing/`     | Share previews, category ordering, file sharing, and availability.                 |
| `dist/js/personalities/`        | Personality registry and each personality's authored assets.                       |
| `dist/js/shared/`               | Date/time helpers, scheduling, validated storage, DOM text helpers, and downloads. |
| `dist/styles/`                  | Ordered stylesheet sources and shared component styling.                           |
| `dist/vendor/`                  | Unmodified third-party browser library and its license.                            |
| `tests/<feature>/`              | Behavior and regression tests corresponding to feature ownership.                  |
| `supabase/`                     | Existing backend migrations and database access tests.                             |
| `docs/`                         | Setup, architecture, contribution workflow, and release decisions.                 |

`dist/js/app.js` is a deliberately tiny entry point. The application controller
still coordinates Daily rendering and shared application state; settings,
backup/restore, and note-line rendering now live in dedicated modules. Further
extractions should follow a concrete feature need, not introduce a framework or
an elaborate global state system merely to shorten this file.

## Personalities are bundles, not separate applications

`personalities/zen/`, `builder/`, `founder/`, `poet/`, `astronaut/`, and `gamer/` each own:

- `index.js`: approved descriptions, authored copy, mantras, daily inspiration,
  onboarding preview, and default soundtrack profile.
- `music.js`: that personality's original procedural score.
- `theme.css`: theme rules, with optional `palette.css` tokens.
- `renderScore` and `effects` in the profile: the music renderer and optional visual effect style.

The central registry is the only interface used by features. Onboarding and
soundtrack choices read it rather than maintaining their own mode-name lists.
The early `appearance.js` script is generated from the same registry using
`scripts/appearance.template.txt`, so a saved theme applies before the main module
loads. It never loads or transforms note content. Settings cards are generated
from the registry too; onboarding and Focus choices consume it at runtime.

Use stable authored-copy keys such as `daily.headingToday` and
`focus.noteHeading`, through `voice(key)`. Put a new key in every personality and
the default-copy fallback. HTML uses `data-voice="settings.heading"`. Do not use
an English display sentence as a lookup key. Never pass notes, journal answers,
custom mantras, or saved report text through the personality system.

Personality styles and music continue to support all six modes in the same
release. A feature branch is a temporary development workspace, not a permanent
personality variant. Do not create permanent Zen/Builder/Founder branches.

## Styling without extra runtime requests

`dist/styles/index.css` lists sources in the original cascade order: default Zen
tokens, base UI, personality controls, palettes, shared variant overrides, theme
details, responsive controls, and remaining feature rules. Shared variant rules
stay in `personalities/shared.css` instead of being copied into each theme.

Run `npm run build:styles` after editing a stylesheet source. It expands local
imports into the checked-in **single** `dist/styles.css` bundle. The browser does
not fetch a chain of imported theme stylesheets. Never edit the generated bundle
directly. `npm run check` rejects missing imports, cycles in the stylesheet build,
and an out-of-date bundle. No build server is required on the eventual static
host because the generated website is checked in.

## Boundaries that protect behavior and data

- Model/rule modules should be pure when practical; UI modules own DOM events.
- Features receive callbacks or state getters from the app controller. They must
  not import the running app controller or copy the whole application state.
- `shared/storage.js` owns note/backup validation. Moving a file must not rename
  storage keys, change note shapes, or trigger automatic data migration.
- Account authorization remains on the server. The frontend configuration contains
  only the publishable key; never move privileged keys into any feature folder.
- Date helpers live in `shared/dates.js`; `schedule.js` re-exports them for API
  continuity. Time-interval grouping makes one pass over notes and preserves their
  original order and object identities inside each interval.
- Use `shared/dom.js` to create text-bearing elements. It uses `textContent`;
  uploaded content and note text must not become executable HTML.
- Button helpers with genuinely different interaction contracts stay local.
  Avoid a generic component framework for a few small, distinct buttons.
- File paths and module locations may change; user-created notes, settings,
  reports, approved mantras, and soundtracks must not change during cleanup.

## Validation

Account interfaces and provider-neutral migration/access models are described in
[PROVIDER_PORTABILITY.md](PROVIDER_PORTABILITY.md). The account controller uses the
auth, notes, and preferences ports; provider transport lives under
`features/accounts/providers/`. Pure future policy/ledger models live in
`features/access/`, and account migration serialization in `features/portability/`.
These preparations do not enable checkout or change backend providers.

`npm run check` checks syntax recursively and statically links all published
modules, without executing planner code, to catch missing exports and broken
paths. It also checks lazy PDF-library paths, HTML references, stylesheet imports,
and that the generated CSS matches its sources. Node 24's VM modules flag is used
only for this development check; the website itself uses standard browser ESM.

`npm test` includes the existing behavior suite, an assembled-planner DOM smoke
test, backup confirmation/recovery tests, source registry checks, and golden audio
sample fingerprints proving the extracted scores are unchanged. DOM tests use an
exactly pinned development-only DOM implementation, not a production dependency.
They do not replace real browser, mobile, accessibility, or audio-device checks.

The encryption prototype remains in a **separate draft branch/PR**. Do not merge
its experimental migration into this organizational cleanup or claim that this
refactor encrypts existing notes. When integrating that branch, update its imports
to this directory map and preserve its isolated production rollout gates.

## Personality effects

`personalities/index.js` owns the stable IDs, profile data, optional effects and
music renderer for every mode. `ids.js` re-exports these IDs for account validation
and future access models. The pre-paint script derives its data from this registry
without delaying the initial theme. All six modes remain free.

`personalities/effects.js` owns decorative scenes and short completion/Focus
responses. Its events contain only an action kind, never note content. Full
animates the background and responses; Subtle keeps a static decorative scene;
Off hides them. OS reduced motion and hidden tabs override the preference. The
choice uses the device-local `dayline.effects.v1` key so a phone can choose less
motion independently of a desktop. New scores render on demand at up to 24 kHz;
legacy score samples are unchanged. No recordings, remote assets, extra sounds,
XP totals, or levels are introduced.

The additive `additional_personality_preferences` SQL migration expands the
existing invoker RPC validator without changing notes, owner policies, or revision
checks. `supabase/tests/personality-preferences.sql` verifies the six IDs, stale
revision rejection, and invalid ID rejection in a rolled-back disposable fixture.

## Build and cache consistency

After `npm ci`, run `npm run format`. This formats sources, builds the single
stylesheet, generates the theme bootstrap and Settings cards from the registry,
and versions the complete local module graph. `build:personalities` and
`build:assets` can also be run explicitly in that order after `build:styles`.

The asset build computes a release key from normalized JavaScript, HTML and the
compiled stylesheet, then stamps every local JS import and the app/style entry
URLs. A changed leaf profile therefore refreshes cached parents as well. The
early classic appearance script keeps its own content fingerprint. There is no
manual per-personality cache version to maintain. `npm run check` rejects stale
generated output or versions. The output stays self-contained in `dist/`, with no
new runtime dependencies or hosting requirements.

To add a personality, create its bundle with the same profile contract and
register it once in `personalities/index.js`. Include its theme CSS in the ordered
stylesheet sources, then run the build and tests. The server preference validator
remains an explicit backend allowlist; new IDs need an additive migration before
account sync can accept them. Browser metadata cannot authorize server access.

Completion responses include whole notes, individual checkboxes in Daily/Focus,
and Weekly Notes. They fire only after a successful save and never for reopening
an item. Focus commitment responds after the preparation fade and active view
render, so replacing the preparation DOM cannot erase the effect. Responses use
a pointer-transparent manual popover above modal dialogs where supported, with
an in-dialog fallback. They carry no note text, never move focus, and clear on
hide, personality/effect changes, or their short lifetime. Settings offers a
Preview effects button that changes no notes or Focus session data.

## Independent Focus Audio

`features/focus-audio/` owns the standalone dialog, audio preferences, soundtrack
dispatch and Web Audio engine. `setupFocusAudio()` creates exactly one player per
app tab, launched from the planner's floating Launch Focus Audio button or a
shortcut inside a session. Opening the dialog does not autoplay or create a Focus
session. Minimizing and navigating planner views leave playback alone. Finishing
a Focus Session fades the player into recovery without changing its preferences.
Pause also belongs to the player; unloading the page stops it. Browser lifecycle
restrictions still apply to background audio.

Audio preferences use `dayline.focus-audio.v1` on this device, separately from
notes, accounts and `dayline.focus.v1`. A legacy session's audio preferences can
seed the player when no standalone preference record exists, without editing or
deleting that draft. Restored preferences validate IDs, booleans and numeric
bounds. When idle, personality changes choose that mode's default track while
retaining layer/tempo settings. When audio is playing or starting, appearance
changes preserve the track and existing sources without restarting playback,
including while minimized. The retained selection is associated with the new
personality in device preferences. Manual soundtrack controls still work.

The Focus controller owns no audio engine, mixer settings, playback stops or
volume controls. Its only audio integration is an `openAudio` callback. Existing
`focus/audio.js` and `focus/music.js` paths re-export the new feature's engine and
dispatch for compatibility; they do not create extra players or duplicate scores.

## Local attachment previews

`features/attachments/preview.js` owns the shared dialog used by attachment lists
in editors, Daily, Monthly/Weekly Notes and Focus. Filename buttons open previews;
Download remains a separate explicit action. Raster images and PDFs are identified
by their byte signatures and retyped before making local blob URLs. PDFs use the
browser's native viewer, with a download fallback when unavailable. Audio/video
use native controls, do not autoplay, and stop on close. Text is bounded to the
first 256 KB and inserted with `textContent`; HTML/SVG source is never executed or
embedded. Office and other unsupported formats keep their download option.

The viewer never calls an external document service. Closing or replacing a
preview revokes its URL, releases media and restores focus. Reads that finish
after dismissal are ignored. Missing device-local bytes show a recovery message
without changing the note, its reference, stored files, or account data. Existing
backup and sharing formats are unchanged.

## Poet

Poet is a free basic profile with no special effects, registered beside the other
profiles. Its ink-dark editorial layout, sharp serif headings and muted red accents
support a provocative, intellectual voice built around inquiry, precise imagery,
contradiction and deliberate subversion. All copy, inspiration and instructional
mantras are original; no writer's work is quoted or attributed to these lines.

Undertow is locally synthesized oceanic melodic electronica. `poet/soundscape.js`
adds rolling surf, saturated low pulses and harmonic/formant vowel refrains to the
shared procedural score. The vocal-like phrases are wordless ah/oh/mm synthesis,
not recorded singing, intelligible lyrics or a cloned performer. The ocean layer
uses filtered seeded noise and slow swells. No recordings or external audio
services are used. Closing or pausing Focus Audio still controls playback through
the same shared player; the optional binaural/metronome layers are unchanged.

The same registry drives Settings, onboarding, quotes, Focus copy and audio. The
additive `poet_personality_preferences` migration permits its stable ID in the
existing account preferences RPC without changing owner policies or note data.

## Gamer

Gamer's shared profile centers play, practice, checkpoints and leveling up as
language for real progress. It supplies the twelve approved short mantras and
exact Daily/Focus preparation headings. The visual style retains obsidian, violet
and gold with brighter cyan accents and a short connected-checkpoint response.
Effect labels belong to each animated personality's registry profile, rather than
the shared effects renderer. Astronaut's labels and effects remain unchanged.

The Next Level score is original, locally synthesized adventure electronica at
112 BPM, with rounded bass, crisp percussion, warm chord layers and bright motifs.
Its stable soundtrack ID remains `gamer`. The independent metronome/binaural
defaults and user selections are preserved. No XP, numeric levels, streaks or
additional progress records are created; completion feedback responds to existing
successful note/session saves. Full/Subtle/Off, reduced motion and visibility
controls retain their existing behavior. Old/custom session commitments are not
rewritten to the new suggestions. All modes remain free.

## Shortcuts

`features/shortcuts/` owns the shared panel, custom shortcut validation and the
separate device-local `dayline.shortcuts.v1` preference. The planner's bottom-left
launcher opens a native modal drawer on desktop or bottom sheet on mobile. Focus
has a header shortcut to the same panel so it can stack above its native dialog.
Escape, Close and deliberate backdrop clicks dismiss it and restore focus.
Default Google Meet/Drive links and validated custom HTTP(S) links open with
`noopener noreferrer`. Custom links support add, edit and remove; failed saves
leave the previous list intact. No SDK, credentials, note content, backend or
account preference schema is involved. Custom shortcuts are browser-local and
are not part of note backups/account sync. Existing Google hyperlinks in notes
remain ordinary saved content. No service is opened before a user clicks it.

## Note duplication

`features/notes/duplicate.js` owns the shared pure copy rule. Copies receive a new
ID immediately after the source in the same date/time or undated week. Text,
formatting, title, tags and attachment references are deeply copied; completion
is reset and historical Focus/guided reports are excluded. Existing file IDs
continue to reference the same local bytes, so backups/shares use their existing
reference handling. Daily and shared Daily/Focus editors, the expanded Monthly
day list and Weekly Notes expose the action. Application saves roll back on
failure and use existing undo and account sync. No storage schema changes.

## Bulk time moves

The bulk move dialog accepts a destination date and the first selected note's
start time. `features/bulk/model.js` shifts all selected note times by the same
minute delta, preserving exact gaps and notes sharing an interval. Omitting the
new optional minute value retains the existing date-only move behavior. Date
spacing remains independently selectable for multi-day selections. Times crossing midnight normalize into the next or previous calendar day,
including month/year boundaries; existing destination notes are never displaced. IDs, contents, completion, reports and attachment references
use existing save/sync/undo paths without a storage migration.

## Inspiration Library

`features/inspiration/catalog.js` contains original short summaries and separate
Dayline takeaways, each linked to source material. The cards are bundled locally;
no external service or tracker loads until a user opens a source. `model.js` owns
filters, favorite validation, and note text; `view.js` owns the accessible More
launcher, filters, story navigation and source/favorite/save actions. Focus opens
the same library above the session, leaving audio and the session running.

Favorites are role-model names stored in device-local
`dayline.inspiration.favorites.v1`, explicitly labeled as such; invalid or failed
storage writes never overwrite existing favorites. They do not sync or enter note
backups. Saving a story creates an ordinary new Daily note for the current time,
with the original summary, labeled takeaway and source URL; existing notes are
not overwritten. It uses the existing persistence, account sync and undo paths,
and rolls back if saving fails. No database schema, report shape, external
provider, paid resource or automatic sharing is introduced.

## Monthly quick add

The existing single-tap date action opens a multiple-note form with per-note title,
exact time, multi-tag chips, and optional plain-text body. Rows can be added or
removed before saving; double-tap still opens Daily. `monthly/model.js` validates
and constructs the whole batch before planner state changes. The app saves all
notes together, preserves existing entries and exposes one Undo snapshot; a
failed save restores the previous day/settings and leaves all form drafts visible
for retry. An account change closes the unsaved form. New notes use the existing
schema, reminders, account sync and Daily/Focus editors, without a migration.

## Expanded Monthly day

`features/monthly/expanded-day.js` presents every configured interval, including
empty ones, and keeps the note list in the existing planner state. Mouse and held
touch drags move a note into an interval; the Move control provides a non-drag
alternative. Moves use the Daily drop model, preserving the note's minute offset
and leaving other notes in place. Delete and move use the existing persistence,
account sync, and Undo paths. Background note refreshes are deferred during a
drag, and closing the dialog removes its event listeners and pending gesture.

## Guided visualization

`features/visualization/` owns 21 prompts, nonrepeating rerolls,
invitation, and More activity. The invitation appears on planner entry or a
later focus/visibility return, once per local calendar day per browser. It waits
until sign-in and introductory setup are finished and avoids an active editor,
Focus session, or another dialog. It has no midnight timer. The day marker and
Settings toggle are device-local keys; they do not alter account preferences or
require a schema migration. The notice directs users to Settings to disable the
daily invitation; More remains available. Responses are saved only when the user
chooses Save action to Daily, using existing note persistence, sync, and Undo.

Visualization opens directly to guidance, an optional action field, and Finish /
Save action to Daily / Reroll controls, both for daily invitations and More. The
catalog includes six identity-oriented exercises that translate desired qualities
into a specific behavior today; they use the same random pool and save path.

## Finite repeat cycles

`features/repeating/model.js` expands an explicitly bounded daily, weekly,
monthly, or selected-weekday rule into ordinary dated notes. `view.js` previews
25 occurrences per page, flags annual U.S. federal holidays using the local OPM
rule model, and supports skipping or individually adjusting dates, times, titles,
and text. Adjusted dates remain within the explicit cycle bounds. Holiday scope
and limitations are visible in the dialog; there is no external holiday request.

A validated optional `repeat` object links each new occurrence to its finite
cycle and original planned position. Metadata survives backups and account sync;
it is not an authorization mechanism. Old independent copies are not inferred
from similar text. Duplicating a note detaches its cycle identity. No database
migration or automatic renewal is required.

Daily and Focus editors, deletion, and schedule moves offer Only this note or
This and later repeats. `series.js` applies the choice only within that cycle,
retains earlier notes and per-occurrence completion/history, and provides batch
Undo snapshots. Content edits propagate text and formatting together. Individual
exception titles and times survive unrelated edits. Moving all remaining repeats
cannot extend the original bounds; moving only one outside the cycle detaches it.

Duration counts the start date; monthly dates clamp without drifting after
February. At most 1000 planned occurrences are accepted; larger rules fail
without truncation. Creation preserves the source contents, resets completion in
new copies, and excludes historical reports. Attachment references are retained.
All writes use existing persistence and rollback on failure, with one creation
Undo snapshot covering the source metadata and target days.

## Day, week, and month summaries

`features/summaries/` computes an expandable one-line overview from existing notes
and saved Focus reports, without changing storage. Percentages are note
prevalence, so multi-tag notes count toward each tag; untagged notes are explicit.
The denominator includes all notes regardless of display filters. Daily excludes
Weekly Notes. Weeks include all seven dates plus that week's undated notes;
months limit dated notes to calendar dates and include undated notes from each
overlapping week once. A month's total need not equal its padded week totals.

Focus reports are deduplicated by session ID across all notes and clipped to the
period's local-midnight bounds, accounting for cross-midnight sessions and DST.
Moving a report's note does not move its recorded Focus time. Active sessions are
not included; removing a report removes that history from summaries. Holiday
flags share `shared/holidays.js` with repeat previews. Compact lines expose full
tag counts, holiday dates, and calculation explanations on expansion. Note-change
events update summary content without rebuilding calendars or open editors.

Summary display preferences are browser-local under `dayline.summary-display.v1`.
Clicking the tag figures switches every visible summary between percentages and
exact note counts without opening its disclosure. Settings independently hide
note totals, tag figures, Focus time, or holidays from compact lines; disabling all
four hides the summaries. Expanded Details retain the complete breakdown.
All tags appear in the compact tag section. It uses native horizontal overflow
only when the figures exceed available width, with touch, scrollbar and arrow-key
access. Scrolling does not toggle the figures or expand Details; switching figures
retains the horizontal position.
Preference events update summaries and Settings without rebuilding the calendar
or editing notes, and storage events synchronize display choices across tabs.

## Flexible Yearly planning

`features/yearly/model.js` owns year positioning, validated intention metadata,
quarter moves, linked next steps and reviewed carry-forward. `view.js` owns the
Yearly tab and its draft dialogs. The year bar measures calendar time, never task
performance. Only the current quarter initially opens; past and future quarters
have no required fields, overdue states, completion scores or automatic rollover.
Season labels are optional Northern Hemisphere approximations, saved per browser.

Yearly uses the existing owner-scoped, revision-aware note persistence path.
Each direction, quarter journal, intention or annual reflection is its own note
envelope on January 1 with validated `yearly` metadata. The date is a storage
anchor, not a scheduled item. Daily, Monthly, Focus, reminders, availability,
bulk selection and summaries exclude these envelopes. Daily replacements retain
them alongside Weekly Notes. `yearlySource` links ordinary dated/Weekly Notes
back to their intention; rescheduling them does not move the intention. Backup,
guest recovery, account drafts and provider-neutral exports retain both fields.
No new provider, table, SQL migration, runtime dependency or storage key is needed
for the planning content. Existing older client tabs must reload the new release
before editing these records; older validators do not understand the metadata.

The existing three-way account merge keeps independent records and preserves
both concurrent versions. Singleton section conflicts appear under Other saved
versions, with an explicit choice of which to show. Yearly draft dialogs stay
mounted during sync, reject stale submissions, and retain drafts on save failure.
Saving one yearly section does not replace other intentions or dated notes.
Previous annual directions are optional snapshots, bounded to 100 versions; each
field is limited to 20,000 characters and the shared day payload stays below the
existing 1 MB provider limit. Planned next steps remain ordinary notes and never
automatically complete an intention. Monthly Compass accepts visible Yearly
context, keeps existing answers, and links its optional Weekly Notes back to the
intention. Carry-forward requires a reviewed selection and creates new Q1 cards
while leaving the source year and scheduled steps intact.

## Guided activity quick access and visualization quotes

`features/activity-favorites/` registers the six guided activity launch callbacks and the Inspiration Library
already used in More. Stars on those cards create direct quick-access buttons
above Shortcuts, in a bounded scrolling dock that respects safe areas, bulk mode,
and Monthly drag targets. Hidden planner ancestry keeps them off the sign-in page.
Favorites use validated device-local IDs in `dayline.activity-favorites.v1`, never
user-supplied URLs or dynamic code. Failed writes leave the saved choice intact;
storage events refresh other tabs. Launching uses the existing activity dialogs,
drafts, timers, save paths and account-change cleanup.

`visualization/quotes.js` owns the 21 approved quote pairings and their source
links. The catalog attaches each pairing by exercise ID; one shared renderer
places the text and attribution below the title on initial entry and rerolls.
Sources are opened only on user request; no quote API or new network dependency
is introduced. Campbell’s verified wording is used rather than attributing the
circulating variation to Jung. The final Seneca, Eleanor Roosevelt, Anne Lamott
and Rilke replacements supersede rejected pairings.

`dayline.visualization.pinned.v1` holds an optional exercise ID. Pin as first
exercise and the Settings selector update the same preference. Both daily and
manual launches prefer that ID; invalid/removed IDs fall back to normal rolls.
Reroll never changes the pin. Preference updates refresh controls without replacing
an open action draft. Once-per-local-day invitations, Settings opt-out, optional
saving and failed-save retention are unchanged. Favorites and pins are browser
preferences, not synced account content or backup schema changes.

## Position-based Daily note times

`features/daily/precise-time.js` maps a click's vertical position between the time
gutter's displayed start/end bounds to the nearest minute. Empty interval surfaces
and gaps between cards use the same bounds; the gutter remains available in busy
intervals. Labels are anchored at opposite ends, and a pointer-transparent desktop
hover preview shows the proposed time. Touch uses the same position calculation;
keyboard activation keeps the interval-start default and editable note time.

The mapper clamps the final partial interval to 23:59 and never silently schedules
into the next interval. Note cards, editors, selection mode and cancelled gestures
keep their existing behavior. Explicit Add note keeps its start-time default.
The resulting minute goes through the shared editor and existing save/reminder
paths; there are no storage, reminder, or interval-setting changes.

Daily note cards group metadata/title and actions in a wrapping `note-header`.
The toolbar is inside the content column rather than a sibling that reserves
width beside the entire body. Body text, bullets and checkboxes use the available
card width beneath that header. Narrow layouts keep a single content row (with
the existing selection column in bulk mode); toolbar wrapping never overlays or
narrows the body. These are layout changes only, preserving saved note content
and formatting.

Sharing offers rich clipboard HTML alongside its plain-text alternative and a standalone
formatted HTML download. `features/sharing/share-format.js` renders only escaped text,
validated links and allowed inline styles from the existing note ranges. No saved note
HTML is accepted. Bulk ordering and report inclusion remain shared with text export;
reports stay excluded by default. Native Share and mailto remain plain text because
receiving apps control formatting. Rich clipboard failure falls back to text; formatted
HTML does not embed note attachments, which retain their separate sharing controls.

Monthly's shared desktop/touch drop routing accepts Weekly Notes sections as well
as day cells. A Daily drop invokes `changeWeekly`'s `unschedule` action through the
existing persistence and Undo boundary: it moves the whole note to the target
Sunday anchor, sets `weekly: true`/`minute: 0`, and preserves content and file
references. A repeated occurrence detaches from its cycle; other occurrences stay
unchanged. Same-Sunday moves and destination ID collisions preserve neighbors.
Weekly-to-Weekly drops use the existing week move. Cancelled/invalid drops do
nothing, and background sync remains deferred until the gesture finishes.

Note-body clipboard handling lives in `features/notes/clipboard.js`. Editor copy/cut
and rendered-body copy write plain text, formatted HTML and a versioned body-only
fragment. An encoded HTML attribute carries the fragment when a browser strips
custom clipboard types. Paste checks the version, text match, range bounds, safe
links and line anchors before merging into the normal editor model and Undo
history. Arbitrary pasted HTML is never installed. Unsupported/malformed payloads
use the existing plain-text path. Partial selections clip ranges; inline paste
keeps destination line tools, while imported new lines retain their own tools.
Titles, times, tags, attachments, reports and IDs are not part of body copying.

### Yearly life foundations

`features/yearly/life/model.js` owns validated drafts, date resolution, finite batch
expansion and atomic note creation; its view provides inline multi-row entry,
pasted-list review, shared defaults, per-row overrides and life-support statuses.
Both Yearly sections start collapsed. Lists and support references are year-independent:
a validated `yearly.kind: life` envelope is anchored to 1900-01-01, outside visible
annual plans, through the existing note port. Account sync, conflict retention and
backups include it without a new provider or table. Stale autosaves are rejected;
failed drafts remain in the view and can be downloaded before explicitly reloading.
Successful scheduling clears only the scheduled group and records links in the same
write as the notes. Undo snapshots restore all affected dates and the list draft.
Editing another draft clears that Undo so it cannot overwrite newer work.

Optional `allDay` and `remind` booleans extend dated notes. Their integer `minute`
is the reminder time when enabled. Date-only notes appear in a separate Daily and
expanded-Monthly rail, have All day labels when sharing, and remain outside timed
availability and automatic Focus interval selection. They notify only when opted
in and still honor global reminder settings. Explicit timed rescheduling converts
them to timed notes. Existing notes keep their previous timed behavior. Older tabs
should reload before editing these new fields or the new life envelope.

The More activity favorites controller also acts as the shared launch registry.
Focus's inspiration pocket lists every registered More activity, including the
Inspiration Library, without duplicating dialogs or save paths. Focus may remain
open behind the selected activity; launch checks still block additional unrelated
modal windows. Library pinning uses the same browser-local favorites key and dock
as guided activities; role-model favorites inside the library remain independent.

### Optional flow preparation and recovery

The original Focus start view keeps its advice and mantra. `focus/flow-view.js`
provides an always-editable compact plan plus an optional four-part preparation
page. Both operate on the same session `flow` object; entering the helper is never
a prerequisite for writing an outcome, choosing tags or starting. Outcome tags use
the shared category picker (including custom tags and disabled-default settings)
and stay synchronized with the selected note. Steps, permission, warm-ups, breath intentions,
attention preferences and parked distractions autosave to the existing Focus draft.
Warm-up text can explicitly append to the selected note through the existing edit
boundary; it is never added silently. Temporary exercise timers stop on leaving
the preparation view. Preparation does not count as session work time.

`focus/flow-model.js` validates optional `flow` and `recovery` metadata in drafts
and saved reports; older drafts and reports without them remain valid. Parked
items appear as a Before starting log and enter the combined report once. Work
ends at Finish, before reflection, break selection or celebration. Break defaults
are 3/5/10/15 minutes at 25/50/90 minute work thresholds and are explicitly editable
product defaults. Celebration is opt-in and runs only after report saving succeeds.
Preparation/recovery data appears in expandable reports and in shares only when
Focus reports are selected, preserving the default privacy choice.

`focus/break-timer.js` owns an optional browser-local wall-clock deadline under
`dayline.focus-break.v1`. It starts only after a successful session report save,
continues separately after Focus closes, survives reload, and does not contribute
to work duration or start another session. It cleans up on account changes and
uses the existing browser event model without a new service or backend table.
Reload older tabs before editing new report metadata.

Focus plans use the shared `evidenceList` and action-list renderer in compact
setup, optional preparation and active-session editing. The original `evidence`
string remains the first answer; an optional validated `evidenceExtra` array holds
up to 29 more. Existing multiline answers are not split or rewritten. Actions keep
the existing steps structure; their optional `approachOpen` boolean retains an
explicitly opened empty approach. Any existing strategy is always shown. Removing
an approach explicitly clears only that action's strategy. Reports and opt-in
shares preserve all evidence answers, and the prominent next action follows the
first unfinished nonempty action rather than falling back to a completed one.

Outcome categories now bind bidirectionally to the session's selected summary
note. A dedicated tag-only application callback preserves all other note fields
and rolls back failed writes; it never applies the change to other interval notes
or an entire repeat cycle. Note/category refresh quietly updates the shared chip
picker and any open note editor without replacing preparation text fields. With
no note selected, categories remain in the draft and seed a newly created report
note. Existing report snapshots remain historical.

Optional preparation starts with four support-area choices and reveals only the
selected sections. Optional validated `supportAreas` metadata preserves choices
across reopening; hiding a section does not erase answers. Older drafts start
with no areas selected. Make it meaningful inserts the starter Accomplishing this
would show that… without rewriting an existing response.

Focus plan editing now uses one shared paired-row renderer: evidence, next action
and its optional approach sit together, with no action-completion checkbox.
Rows align the existing evidence and steps arrays by index, retaining unmatched
older answers/actions without a migration. Add row appends a pair; explicit Remove
row removes the pair. Existing approaches and completion metadata are preserved.
The same row layout is used in setup, optional preparation and active editing;
small screens stack each row's fields together in reading order.
