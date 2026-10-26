# Optional Google Drive and Meet

Dayline remains a portable static website. These integrations require an owner's
Google Cloud configuration before use; blank configuration intentionally leaves
Settings connection buttons disabled. No Google project, billing account, paid
resource, Calendar event, invitation, or file-sharing permission is created by
this code or by deployment.

## Owner activation

1. Use a Google Cloud project you control. Enable the Google Meet REST API,
   Google Drive API and Google Picker API. Do not enable paid upgrades or raise
   quotas as part of this setup.
2. Configure Google Auth Platform branding, audience and consent. For private
   testing, use External / Testing and explicitly add your and your tester's
   Google addresses. A work/school administrator may restrict connections.
3. Create an OAuth client of type **Web application**. Add each exact authorized
   JavaScript origin: initially `https://angel-saber.github.io`, plus any future
   host origin. An origin has no `/Dayline` path. This browser token flow does
   not need a client secret or server redirect endpoint.
4. Configure only these scopes:
   - `https://www.googleapis.com/auth/drive.file`: explicitly selected files.
   - `https://www.googleapis.com/auth/meetings.space.created`: app-created meetings.
     Meet's create-space scope is classified as sensitive and requires Google's
     applicable verification before public release.
     The app requests each permission separately when needed, not all Drive files,
     Gmail, Calendar, meeting recordings, or participants.
5. Create a browser API key restricted to Google Picker API (and Drive API if
   needed by your project's setup). Restrict website referrers to your Dayline
   deployment and Google's Picker referrer requirements, including
   `https://docs.google.com/*`. Test both restrictions together; never use an
   unrestricted server key. The API key and OAuth client must belong to the same
   project. Copy the numeric project number as `appId`.
6. Put **public** identifiers in `dist/js/features/google/config.js`:
   `clientId`, `apiKey`, and `appId`. Never put a client secret, refresh token,
   access token, service-account key, or privileged credential in the repository.
7. Run `npm run format`, `npm run format:check`, `npm run check`, `npm test`.
   Commit through a focused PR. Merge, wait for Pages deployment and reload.
8. Test with your allowed Google accounts on desktop and mobile before broad
   release. For public access, complete Google's applicable verification,
   branding, privacy-policy and domain-ownership requirements. Shared hosting
   domains can complicate ownership verification; review the eventual production
   domain rather than assuming the GitHub testing URL satisfies public review.

The Google connector installed in ChatGPT does not provide Dayline with an OAuth
client or authorize Dayline users. These are separate applications.

## User experience

Settings → Google connections can grant Drive or Meet permission independently.
Every shared note editor offers **Attach from Drive** and **Create Meet link**.
A separate connection window loads Google only after an explicit action; users
click Continue to Google there. This keeps Google's picker interactive even when
a note is edited inside a native Monthly or Focus dialog. Allow pop-ups for the
Dayline site. No Google SDK is loaded during ordinary planning.

Selected Drive files become named hyperlinks on new lines in the note. They are
linked references, not copies in the device attachment store. Existing text,
formatting, tasks, reports, note IDs and attachment bytes are preserved. Links
use existing note sync, backup, sharing and hyperlink rendering. The 10 MB upload
limit does not apply to linked files. Google controls viewing permissions and
storage. Recipients may need a Google account or permission from the file owner;
sharing a Dayline note does not change the file's sharing settings. Linked files
are not included as binary attachments in native shares or backups.

Meet creates one standalone meeting space and adds its join URL. It does not
schedule a Calendar event, send invitations, start a call, or change the account's
Meet plan limits. No automatic retry is made for the create request. If a network
response is lost, Google may have created a space even though Dayline could not
save its link; an explicit retry can create another space.

Authorization is on demand. Short-lived access tokens exist only in memory in
the connection window; they are never sent to the planner or Dayline's backend,
stored in local/session storage, synced, or included in exports. Only validated
Google link names and HTTPS URLs cross the same-origin, source-checked,
request-bound message channel. Closing the window discards its token; returning
later may request Google authorization again. Google may remember consent, but
Settings does not claim a persistent connected identity. Use **Manage Google
permissions** in Settings to revoke Dayline's grant. Revoking access does not
remove already-saved note links or change Drive file permissions.

The operation aborts if its note editor is destroyed, the account changes, or
the planner unloads; no returned result is
written to another note. Popup blocking, cancellation, timeouts, denied scopes,
API errors and save failure leave the original note intact. A failed local save
shows returned URLs for manual recovery. Google authorization itself is separate
from Dayline's guest/account login and does not sign a user into Dayline.

## Free-first operation and release checks

Google's current documentation says standard Meet and Drive API usage has no
additional charge, with charges for excess quota planned later in 2026. This is
not a guarantee of unlimited free use. Review current quotas, billing requirements
and overage controls before activation/public launch. Do not add billing or raise
limits without the owner's separate approval under INFRASTRUCTURE_POLICY.json.
Files remain in the user's Google storage; no new Dayline hosting is required.

Automated tests cover URL validation, text/link persistence and sharing, least
privilege authorization, scope denial, Picker selection/cancellation/disposal,
Meet request/error behavior and popup message source/origin/state/abort handling.
Actual Google consent, project key restrictions, native-dialog/mobile popup
behavior and real account eligibility require configured browser testing. They
cannot be verified with blank project credentials or mocked API responses.

## Official references

- [Browser token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Drive web Picker setup](https://developers.google.com/workspace/drive/picker/guides/web-picker)
- [Drive permission scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Meet create space](https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces/create)
- [Meet authorization](https://developers.google.com/workspace/meet/api/guides/authenticate-authorize)
- [Meet quotas and pricing](https://developers.google.com/workspace/meet/api/guides/limits)
- [Drive quotas and pricing](https://developers.google.com/workspace/drive/api/guides/limits)
