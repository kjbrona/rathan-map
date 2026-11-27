# Weekly Fence tracking — v1.3.70

Only Fence NPC markers on active Ranch Roleplay initially receive a schedule.
The existing Ranch profile is located by its existing name; no profile or marker
is created automatically. Once an observation is saved, its schedule is persisted
with the server's tracking document. Archived RosalitaRP and unrelated servers
receive no inferred schedule. Shady Dealer is unchanged.

## Use

Enable NPCs / Fence and expand **Weekly Fence**. The totals cover the selected
server's entire Fence dataset; ordinary map filters (including character and
region) still restrict displayed markers. The tracking panel's state and unchecked
filters affect only Fence markers. Clear All Filters resets these choices.
Fence filter choices use the existing server-scoped saved-filter record and are
included with settings in complete archives.

Create a Fence using the existing Add Marker form and choose Unconfirmed, Known
(historical), Searched — Not Found, or Current. Tracking creation is an online
transaction, including the new marker: failure leaves the form open. On a Fence
popup or selected-marker details, use Found Here, Not Found, Clear Weekly Search
Status, or (for unconfirmed sites) Mark as Historical Known. Contributor names
are optional; no email address is automatically made public.

Not Found at the currently confirmed location requires confirmation. A concurrent
confirmation arriving after the prompt is detected in the transaction and requires
review/retry. Found at another location atomically replaces the current pointer.
Both locations retain their confirmation history.

History can be filtered by rotation date. **Correct / invalidate** asks for a
reason and retains the original observation with correction author/time/reason.
Clear Weekly Search Status appends a clear event; it does not delete old searches
or remove permanent knowledge. Invalidated found events no longer contribute to
dates/counts; already established permanent knowledge remains intact. An older
valid observation can become applicable after a mistaken later observation is
invalidated. A cleared Current pointer is never silently restored by correction.

## Rotation calculation

`rotatingNpcBoundary(time, schedule)` uses UTC date components and integer-day
arithmetic to find the most recent configured weekday/hour/minute. Ranch's
configuration is `{weekday:5, hour:8, minute:0}`: **Friday 3 AM CDT / 08:00 UTC**,
fixed year-round. The ISO UTC boundary is the rotation ID. It is independent of
browser locale and America/Chicago DST. The next boundary is exactly seven days
later. Other servers can have their own explicitly configured schedule later;
there is no global schedule rewrite or automatic extension to other NPC types.

A one-second timer and focus/visibility handlers refresh derived states at the
boundary. Old Current becomes Known. Old Not Found becomes Known or Unconfirmed
according to permanent knowledge. No weekly database writes or cleanup jobs occur.
Transactions calculate the observation's rotation after their network reads on
every retry; the date is the observation time, not an earlier form-open time.

## Data and concurrency

Existing marker collections, IDs, coordinates, character knowledge, notes and
descriptions remain unchanged. New potential sites store `fenceConfirmed:false`;
new historical/confirmed sites store `true`. Normal marker normalization preserves
that extension field. Old Fence markers without explicit tracking metadata are
Known, with no invented first/last dates, counts, or observations.

The added document is:

`/servers/{serverId}/rotatingNpcs/fence`

It contains:

- `schemaVersion:1`, `revision`, `serverId`, `npcType:"fence"`.
- `schedule:{weekday,hour,minute}` (or null for an unconfigured server).
- `locations:{[markerId]:{confirmed:boolean}}`, permanent spawn knowledge.
- `observations:[]`, ordered records with unique ID, marker/server/rotation IDs,
  result (`found`, `not-found`, `clear`), UTC timestamp, contributor, and optional
  `invalidated:{at,by,reason}`.
- `current:null | {markerId,rotationId,observationId}` — one authoritative pointer.

Found/Not Found/Clear and corrections read/write this document in a Firestore
transaction. The transaction also reads the server lifecycle and target marker,
rejecting archived servers and missing/non-Fence markers. New marker creation
writes the marker and tracking document together. Repeated Found events count
once per distinct rotation. Ordinary marker autosaves never write Fence history.
Document revisions prevent a late transaction response from replacing newer
observations already received through the realtime listener.

Firebase transactions retry contention and cannot commit offline; see
[Firebase transaction documentation](https://firebase.google.com/docs/firestore/manage-data/transactions).
Current-location uniqueness depends on all writers using this document/protocol.
The single pointer also means the UI cannot derive two Current markers from a
valid document, even when two players submit Found together.

The server-specific localStorage key is `explorer-fence-tracking` for legacy
Rosalita, or `explorer-fence-tracking:server:{serverId}` for other servers. It is a
cache, never an offline write queue. No failed observation is shown as saved.
Server switches wait for pending observations; the page session's immutable
server ID and account/lifecycle guards prevent writing into a newly selected
server. Auth and editor access code already present in this repository is reused
without modification.

## Backups and recovery

New marker exports include `fenceTracking`; complete server archives include the
same document, configuration and history. The export UI reads the cloud document
before producing a complete backup; if known tracking cannot be verified, export
reports the error rather than silently claiming a complete history backup.
Cached data remains accessible in browser storage. Keep earlier downloaded
backups and do not clear browser storage while troubleshooting sync.

Imports validate schema, server ID, unique observation IDs, schedule/rotation
boundaries and the Current pointer. Cross-server history imports are rejected.
Ordinary marker imports merge history, preserve existing shared Current, and
reject conflicting observation IDs. An old rotation pointer is never promoted to
the current rotation. Old backups lacking tracking preserve the destination's
history rather than deleting it.

Complete archive restore replaces tracking only when supplied, using the existing
explicit overwrite confirmation and locally staged recovery archive. Restoring
markers and tracking is not atomic across the two stores; interruption can leave
a partial restore. The pre-restore and staged archives are retained for recovery.
An ordinary import can also apply history before a marker save fails; the UI
reports that the import did not finish and asks the user to review/retry. History
for removed markers remains available under its original marker ID.

## Firebase setup — manual only

The checked-in `firestore.rules` contains authentication/editor helpers already;
this task does not introduce or deploy those features, change their permissions,
or add App Check. Production rules were not changed or assumed to match that file.

The new tracking path needs read access for map viewers and create/update access
for the existing approved editors on active servers. A proposed match block is
provided separately in **fence-tracking.rules.txt** for review. It references the
existing `editor()` and `active(serverId)` helpers. Add it inside the database
match block only after reviewing/testing it against the actual deployed rules.
Do not replace the whole ruleset with that snippet.

Until those permissions are published, the tracking panel reports unavailable
sync and observation writes are blocked. After publishing, reload the site.
No special indexes, Cloud Functions, scheduled jobs, data migration, or existing
marker rewrite is required. The first successful observation creates the tracking
document. Existing archived records are read-only through application guards.

If production access remains unrestricted, anyone with database access can forge
observations, contributor names, configuration or history. The proposed basic
shape/role rules do not independently validate every nested historical event or
attest to an in-game discovery. Client transactions coordinate normal app users;
they are not a security boundary against malicious direct database writes.

## Limits

- Observation timestamps use the device clock in UTC. Set the device clock
  accurately; there is no trusted game/server clock endpoint in this application.
- History lives in one atomic document to minimize architectural changes. At
  750,000 serialized UTF-8 bytes, new writes/imports are rejected without deleting
  history. This conservative cap is below Firestore's
  [1 MiB document limit](https://firebase.google.com/docs/firestore/quotas).
  Before reaching it, export a full archive and extend storage to paged history
  documents while retaining a transactional current pointer. There is no automatic
  truncation or purge. High-volume history may require that follow-up work.
- Multiple simultaneous writes contend on the tracking document and may need
  retry after Firestore exhausts its transaction retries.
- Renaming Ranch before any schedule has been persisted removes name-based
  initial configuration; restore its name or explicitly configure the tracking
  document. Persisted schedules are keyed by stable server ID, not display name.

## Files and verification

Core: `js/fenceTracking.js`. Integration: `js/main.js`, `js/markers.js`,
`js/markerManager.js`, `js/dialogs.js`, `js/sidebar.js`, `js/storage.js`,
`js/serverArchive.js`, `index.html`, `css/sidebar.css`. Version: `js/config.js`,
cache URLs, import-version allowlist and `CHANGELOG.md`.

Icons: `fence-current.svg`, `fence-known.svg`, `fence-searched.svg`,
`fence-unconfirmed.svg`. Each retains the original 24×24 handshake, dark outline,
transparent background, existing marker size/anchors, and adds its state color
and a check/diamond/cross/question indicator. The original Fence SVG is unchanged.

Automated checks:

- `node tests/fence-tracking.test.cjs`: UTC, DST, year transitions, all states,
  expiry, legacy records, counts, invalidation, progress, validation, optimistic
  transaction contention/retry, current uniqueness, conflict confirmation,
  failures, archive guards and server isolation.
- `node tests/fence-tracking.browser.cjs` (Playwright/Edge): four creation states,
  panel, actions, filters, countdown, backups/archive inclusion/import, failed-save
  behavior and clock advancement across a boundary with history preserved.
- Existing server/profile/archive/browser tests cover unchanged marker behavior.

All Firebase testing uses test doubles, not the production database. A real
two-browser smoke test and Firebase Rules Playground/emulator checks are still
required after the proposed permissions are reviewed and deployed.
