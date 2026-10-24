# Dayline

Dayline is a browser-based daily planner and focus workspace. Plan in time intervals, write and format notes, rearrange your schedule, and turn a plan into a focused work session.

## Website features

- Daily timeline with 15-minute, 30-minute, 1-hour, 2-hour, 4-hour, or custom intervals.
- Note titles, bold, italic, underline, colored highlights, and individual checkbox tasks.
- Swipe to complete or delete, drag to reschedule, and accessible move controls.
- Monthly overview with quick note creation, date navigation, and cross-day moves.
- Zen, Builder, and Founder layouts with matching personality copy and daily quotes.
- Focus Mode with a commitment, editable interval notes, generated music, separate ambient/binaural/metronome layers, audio presets, inspiration, interruption logs, optional reflection, and saved session reports.
- Minimize Focus Mode using its button or by clicking outside the window; audio continues while the page remains open.
- Automatic device-local saving, JSON backup export/restore, and optional browser reminders with sound.
- Optional account creation and a guest path. First-time users start at the sign-in page. After sign-in or choosing to continue without an account, the introduction appears over Daily with interval setup and live personality previews.

## Run locally

```sh
git clone https://github.com/angel-saber/Dayline.git
cd Dayline
npm run check
npm test
npm start
```

Node.js 24+ runs the checks; Python 3 serves the website at http://localhost:8080. No npm install or build step is required.

## Code structure

- `dist/index.html`, `dist/styles.css`: page structure, responsive styling, and layouts.
- `dist/js/app/controller.js`: planner coordination and view integration.
- `dist/js/shared/schedule.js`, `month-model.js`, `date-actions.js`: scheduling and calendar behavior.
- `dist/js/features/notes/note-editor.js`, `editor-state.js`, `format.js`, `tasks.js`: note editing and formatting.
- `dist/js/personalities/appearance.js`, `personality.js`, `quotes.js`, `welcome.js`: presentation, voice, and introduction.
- `dist/js/features/focus/controller.js`, `focus-model.js`, `focus-audio.js`, `focus-music.js`, `focus-reports.js`: session UI, session rules, generated audio, and reports.
- `dist/js/shared/storage.js`, `reminders.js`: browser persistence and reminders.
- `dist/js/features/accounts/accounts.js`, `cloud.js`, `sync.js`, `config.js`: optional website account integration.
- Root `*.test.js` and `tests/`: automated web tests; `scripts/check.mjs`: JavaScript syntax checks.

## Current hosting and account status

The complete website is in `dist/`. GitHub Pages is the current development host. In repository settings choose **Pages → Source → GitHub Actions**. The **Deploy GitHub Pages** workflow publishes changes to `dist/` on `main` and also supports **Run workflow** for a manual deployment. **Checks** validates the code; it does not publish a separate version of the site.

Account services are not configured: `dist/js/features/accounts/config.js` contains empty public configuration values. Guests can continue without an account and keep notes in their browser. Email sign-in and cross-device sync need a configured account service before they are available. The optional integration and setup reference remain in [docs/ACCOUNTS_SETUP.md](docs/ACCOUNTS_SETUP.md); they are not required for guest use or static hosting.

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

Follow [docs/WORKFLOW.md](docs/WORKFLOW.md). Run `npm run check` and `npm test`, then verify relevant browser interactions before release. Keep planner backups, credentials, account tokens, and payment secrets out of the repository.
