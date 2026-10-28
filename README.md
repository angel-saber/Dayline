# Dayline

Dayline is a browser-based daily planner and focus workspace. Plan in time intervals, write and format notes, rearrange your schedule, and turn a plan into a focused work session.

## Website features

- Daily timeline with 15-minute, 30-minute, 1-hour, 2-hour, 4-hour, or custom intervals.
- Note titles, bold, italic, underline, colored highlights, and individual checkbox tasks.
- Swipe to complete or delete, drag to reschedule, and accessible move controls.
- Monthly overview with quick note creation, date navigation, and cross-day moves.
- Flexible Yearly planning with an elapsed-time bar, optional annual direction, collapsible quarters, intentions, reflections, linked next steps, and reviewed carry-forward. Reshape, move or set aside intentions without overdue scores.
- Inspiration Library with 100 source-linked stories, filters, role-model favorites and an option to save a story to Daily.
- A Shortcuts side panel with Google Meet, Google Drive and editable custom web links saved on this device; accessible during Focus. No API setup required.
- Standalone Focus Audio with its own launcher, soundtrack/layer controls, tempo presets and background playback independent of Focus sessions.
- Zen, Builder, Founder, Poet, Astronaut, and Gamer layouts with matching personality copy and daily quotes.
- Focus Mode with a commitment, editable interval notes, generated music, separate ambient/binaural/metronome layers, audio presets, inspiration, interruption logs, optional reflection, and saved session reports.
- Minimize Focus Mode using its button or by clicking outside the window; audio continues while the page remains open.
- Automatic device-local saving, JSON backup export/restore, and optional browser reminders with sound.
- Private tester account sign-in and a guest path. First-time users start at the sign-in page. After sign-in or choosing to continue without an account, the introduction appears over Daily with interval setup and live personality previews.

## Run locally

```sh
git clone https://github.com/angel-saber/Dayline.git
cd Dayline
npm ci --ignore-scripts
npm run check
npm test
npm start
```

Node.js 24 runs the development checks; Python 3 serves the website at http://localhost:8080. The exactly pinned development tools generate and verify static assets, formatting, and tests. The deployed website has no npm runtime dependency. After source edits, run `npm run format` to regenerate styles, personality bootstrap/Settings, and cache versions. Commit the generated output with the sources.

## Code structure

- `dist/index.html`: page structure; `dist/js/app.js`: small application entry point.
- `dist/js/app/`: planner coordination and connections between features.
- `dist/js/features/`: accounts, activities, attachments, bulk actions, Daily, Focus, Monthly/Weekly Notes, Yearly, note editing, onboarding, reminders, settings/backups, and sharing.
- `dist/js/personalities/zen/`, `builder/`, `founder/`, `poet/`, `astronaut/`, `gamer/`: each personality's authored copy, descriptions, quotes, mantras, onboarding preview, theme, and original soundtrack.
- `dist/js/shared/`: date/time, scheduling, validated storage, DOM, and download helpers.
- `dist/styles/index.css`: ordered stylesheet sources; `dist/styles.css`: generated single-file browser bundle.
- `tests/<feature>/`: organized behavior and regression tests.
- `scripts/`: dependency/export checks and local stylesheet generation.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for module ownership and guidelines. Personalities belong in folders within the same application; use temporary branches for developing changes, rather than permanent branches for each personality.

## Current hosting and account status

Account operations now use separate auth, notes, and preferences interfaces, with
Supabase as the current adapter. See [PROVIDER_PORTABILITY.md](docs/PROVIDER_PORTABILITY.md)
for migration formats, stable identities, future purchase-policy models, and the
free-first budget rule. All personalities remain free; payments and admin purchase
controls are not enabled.

The complete website is in `dist/`. GitHub Pages is the current development host. In repository settings choose **Pages → Source → GitHub Actions**. The **Deploy GitHub Pages** workflow publishes changes to `dist/` on `main` and supports a manual deployment from `main`. Feature branches cannot deploy through this workflow. **Checks** validates code; it does not publish the site.

The dedicated Supabase Free project is configured for private account testing, with public signup disabled. Existing accounts can use email links or password sign-in when a password is provisioned. Notes and selected settings sync per account; attachment binaries and browser notification/audio permission remain device-local. The default email sender has recipient restrictions. See [docs/ACCOUNTS_SETUP.md](docs/ACCOUNTS_SETUP.md). Guest planning remains usable without an account.

End-to-end encryption is a separate development prototype, not an enabled feature of the live app. This organizational refactor does not migrate account data or change authentication rules.

Browser storage belongs to each site's origin. Before moving to a new domain or host, export notes from the old site and restore them on the new site. Do not assume local notes transfer automatically. Browser reminders and focus audio require the page to remain open; this website does not currently cache its shell for offline loading.

## Website launch direction

Finish and validate the website here first. When ready to launch, move `dist/` to a free static hosting plan whose terms permit the intended commercial use. GitHub remains a source-code repository if desired; runtime hosting is independent of it. No hosting move, payment integration, or ad provider is configured by this cleanup.

The planned business model is:

- Optional supporter payments.
- Paid extras with clearly defined entitlements.
- Unobtrusive banner placements that reserve space and preserve the planner layout.
- A paid ad-free option.

These are planned features, not currently active payments or ads. Hosting limits, commercial-use terms, account costs, payment fees, privacy requirements, and entitlement handling must be reviewed when choosing the launch services. See [docs/WEB_RELEASE_PLAN.md](docs/WEB_RELEASE_PLAN.md).

## Development and validation

Follow [docs/WORKFLOW.md](docs/WORKFLOW.md). Run `npm run format` after edits, then `npm run format:check`, `npm run check`, and `npm test`. Verify relevant browser interactions before release. Keep planner backups, credentials, account tokens, and payment secrets out of the repository.
