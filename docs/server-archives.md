# Server archives — v1.3.59

## Use

Open **Manage Servers / Archives**. Active and archived profiles are listed
separately. Each profile has Select/View Read Only, Export Complete Archive,
and Archive/Reactivate actions. New Server remains available. Archiving and
reactivating both require confirmation. No server is archived automatically.

For RosalitaRP, first export a complete archive and keep the downloaded JSON
outside browser storage. Then choose Archive and confirm. The profile disappears
from the normal active-server dropdown. Use View Read Only in management to
return to it. Its name and **Archived / Read Only** status are shown in the
sidebar. Existing character/type filters still apply; select All Characters to
see both Jim's and Tom's markers.

Archived views allow search, filtering, map navigation, marker inspection, and
exports. Marker creation, editing, moving, deletion, importing, survey removal,
and survey promotion are disabled. Marker persistence and Firestore write
functions also reject writes to archived profiles. Cloud reads may update the
visible markers, but do not rewrite an archived marker cache. Local pending
offline edits remain protected. Survey visibility/filter changes are temporary
while archived; saved survey decisions are untouched.

Reactivation changes metadata only. The same markers immediately become editable;
no marker import or migration is needed. Renaming preserves lifecycle metadata.

## Storage and preservation

Profiles in `explorer-server-profiles` and Firestore
`serverProfiles/{serverId}` now support:

- `status`: `active` or `archived`; absent means active for older profiles.
- `archivedAt`: ISO timestamp of the most recent archive, or null. Reactivation
  retains the last archive timestamp as history.
- `updatedAt`: metadata-change timestamp, used to avoid replacing newer local
  archive status with an older cloud profile after an offline metadata change.

RosalitaRP keeps ID `rosalitarp`, Firestore `/markers`, and all original
localStorage keys. Other servers keep `/servers/{id}/markers` and the existing
`:server:{id}` localStorage suffix. Archive/reactivate changes profile metadata
only: no marker deletion, moving, copying, rewriting, or timestamp modification.
Existing unknown/custom marker fields are retained by marker normalization.

Profile metadata is read before enabling marker tools at startup and refreshed
through a profile listener where Firestore permits it. Cross-tab localStorage
changes update the UI too. Failed cloud metadata writes retain a timestamped
browser-local status and report that other browsers cannot yet see it.

## Complete archive format

Files are named `ServerName_Archive_YYYY-MM-DD_HHMM.json`, with these fields:

- `format: "explorer-server-archive"`, `archiveVersion: 1`
- `application`, `applicationVersion`, `exportedAt` (ISO)
- `server`: full profile metadata, including ID, display name, status/date
- `markerCount`, `markers`: complete dataset, including custom fields and
  discovery states, knownBy, contributors, dates, category metadata, timestamps
- `characters`: the application's Jim and Tom definitions; knowledge remains
  stored in each marker's `knownBy` field
- `candidateSurvey.data`: full survey records, including custom record metadata
- `settings`: raw JSON values (or null for absent keys) for the server's filters,
  add-marker preferences, survey visibility/filter, removed survey IDs and legacy
  survey decisions
- `definitions`: shared category/type/icon/template reference snapshots

There are no server-custom category or character definitions in the current app.
Reference snapshots do not overwrite shared application definitions on restore;
the restored server continues to receive shared app updates. Marker IDs and
metadata are exported without stripping extension fields. No security tokens,
Firebase configuration, other servers' datasets, or other servers' settings are
included. UI disclosure preferences are application-wide, not server-specific.

Survey decisions/settings are browser-local in the existing architecture. Export
from the browser that contains the decisions you want to preserve. Other users'
browser-local decisions cannot be included automatically. The bundled RosalitaRP
survey must be readable for a complete export; failure cancels the export rather
than silently omitting it. Restored survey data is stored at the server-scoped
`rosalitarp-explorer-survey-data` key and takes precedence over the bundled file.

## Restoration and recovery

1. Select the destination server and reactivate it if archived.
2. Choose **Restore Archive into Current Server** in management and select JSON.
3. Validation checks the format/version, profile/date, marker IDs/count/coordinates,
   character definitions, survey records, and the allowlist and shapes of settings.
4. The server ID must match the archive. If the profile is missing, the file picker
   offers to register it with its original ID, then switches to it. Choose the file
   again to restore. An existing archived profile must be explicitly reactivated.
5. Confirm replacement of the selected server's dataset/settings. The archive's
   profile name and lifecycle state are restored as well, so restoring an archived
   backup returns to read-only mode. Other servers are untouched.

Before replacement, a complete recovery snapshot is saved in
`explorer-archive-recovery:{id}` and incoming data is staged in
`explorer-archive-restore-pending:{id}`. Management offers buttons to download
both files. If a restore fails, do not clear browser storage; download those files,
resolve the error, and restore the recovery file or retry the pending file. A
later restore replaces the previous recovery slot, so keep downloaded copies.
If the existing dataset cannot be read or recovery/staging cannot be stored,
restoration stops before marker replacement.

Restores across Firestore and localStorage are not atomic. Cloud operations are
batched in groups of at most 400; an interrupted large restore can be partial.
Recovery and staged files remain available for retry. Offline restores retain a
pending-local flag. Normal explicit saves can sync that dataset once reactivated
and Firebase is available. Nothing automatically pushes an archived offline
dataset into Firestore.

The ordinary marker import/export format remains supported, including older
RosalitaRP backups without server metadata. Ordinary marker imports stay disabled
while archived. Use the dedicated restore control for complete archives.

## Firebase requirements and limits

No Firestore rules file, Firebase deployment manifest, or authenticated access to
deployed rules was available in this repository. Deployed rules were **not** read
or changed. Existing rules must allow intended users to read/list and write
`serverProfiles/{serverId}` with the additional `status`, `archivedAt`, and
`updatedAt` fields. Preserve the existing access policy on `/markers` and
`/servers/{serverId}/markers`; do not broaden public access for this feature.

Authentication, editor allowlists and App Check are not introduced or deployed.
Read-only enforcement is initially application-side. It cannot prevent direct
database writes, old clients, or a request already sent by another client before
its metadata listener receives the archive event. Database-level lifecycle/access
enforcement requires the planned Firebase security upgrade. Metadata may be
browser-local if cloud permissions or connectivity are unavailable.

## Tests

Run `node tests/server-profiles.test.cjs` and
`node tests/server-archives.test.cjs`. These use isolated Firestore/localStorage
mocks and exercise archive/reactivation without marker mutation, persisted status,
disabled controls and write guards, cache-sync protection, complete raw data
round-trips and recovery files, malformed archive rejection, legacy backup support,
and the existing server isolation/delayed-save tests. No production data is used.

`tests/server-archives.browser.cjs` is an optional Playwright integration test.
Set `TEST_BROWSER_PATH` to an installed Chromium/Edge executable if needed.
It serves the repository on localhost, uses a temporary browser profile, blocks
all external requests (including Firebase), and verifies actual marker visibility,
search, disabled editing controls, complete archive download/restoration,
reactivation, and switching to an empty server. This test passed with headless Edge.

## Changed files

- `js/serverArchive.js` (new): management UI, lifecycle confirmation, read-only
  controls, complete export/validation/restoration, recovery downloads.
- `js/serverProfiles.js`: lifecycle metadata validation/sync, active-only selector,
  immutable ID/storage helpers, rename preservation, queued-write guards.
- `js/storage.js`, `js/firebaseStorage.js`: archived write/cache protection,
  custom marker field preservation, import-version support, sync guards.
- `js/markerManager.js`, `js/dialogs.js`, `js/sidebar.js`, `js/contextMenu.js`:
  mutation/import/move guards and read-only marker controls/context menus.
- `js/candidateSurvey.js`: survey mutation guards, read-only popup actions,
  non-mutating legacy decision reads, restored survey data loading.
- `js/main.js`: load lifecycle metadata before initializing marker tools.
- `index.html`, `css/sidebar.css`: management dialog, archive status/actions,
  layout, disabled control styling, script inclusion/cache references.
- `js/config.js`, `CHANGELOG.md`: version 1.3.59 and release history.
- `tests/server-profiles.test.cjs`: reusable isolated test fixtures.
- `tests/server-archives.test.cjs`, `tests/server-archives.browser.cjs` (new):
  lifecycle/preservation regression tests and isolated browser integration tests.
- `docs/server-archives.md` (new), `docs/server-profiles.md`: format, recovery,
  storage mapping, Firebase requirements, test instructions and cross-reference.
