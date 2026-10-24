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

`personalities/zen/`, `builder/`, `founder/`, `astronaut/`, and `gamer/` each own:

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

Personality styles and music continue to support all five modes in the same
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
without delaying the initial theme. All five modes remain free.

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
checks. `supabase/tests/personality-preferences.sql` verifies the five IDs, stale
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
session. Minimizing, navigating planner views and ending a session leave playback
alone. Pause belongs to the player; unloading the page stops it. Browser lifecycle
restrictions still apply to background audio.

Audio preferences use `dayline.focus-audio.v1` on this device, separately from
notes, accounts and `dayline.focus.v1`. A legacy session's audio preferences can
seed the player when no standalone preference record exists, without editing or
deleting that draft. Restored preferences validate IDs, booleans and numeric
bounds. Personality changes choose that mode's default track while retaining
layer/tempo settings; users can still select another soundtrack.

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
