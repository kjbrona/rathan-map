# Server profiles (v1.3.58)

Use **Server → New Server** to create and select a profile, or **Rename** to change
its display name. Names can change; IDs do not. The last selected server is saved
in this browser. Browsers with no selection open RosalitaRP. Character defaults
(Tom), categories, icons and map tools remain shared application features.

## Storage and existing data

There is **no destructive migration** and no automatic copying of marker data.
RosalitaRP's stable ID is `rosalitarp`. It continues to use Firestore `markers`
and the original `rosalitarp-explorer-markers` localStorage key. Existing marker
IDs and metadata pass through the same normalization as before.

Additional servers use `servers/{serverId}/markers/{markerId}` in Firestore.
Their localStorage keys append `:server:{serverId}` to the existing key names.
Marker caches, filters, add-marker defaults, and Candidate Survey decisions are
scoped this way. The bundled Candidate Survey dataset is only applicable to
RosalitaRP; new profiles have no survey points. Survey decisions remain local,
as before; marker backups do not include them.

Profiles are cached in `explorer-server-profiles`; the current selection is in
`explorer-active-server`. When allowed, profile metadata also syncs through
Firestore `serverProfiles/{serverId}` so other browsers can select the same IDs.
If profile registry access fails, profiles remain browser-local and the UI reports
this when creating/renaming. Export a backup before clearing browser storage.

The mapping is repeatable: reloading does not move, rename, or delete existing
collections or original localStorage keys. To recover the original map, select
RosalitaRP. Renaming it does not change its ID or storage paths.

## Firestore deployment

Existing Firebase credentials/configuration are unchanged. No remote rules or
live datasets were modified during implementation. Your Firestore rules must
permit the intended users to read/write `serverProfiles/{serverId}` and
`servers/{serverId}/markers/{markerId}`, using the same appropriate access policy
as the existing `markers/{markerId}` collection. Do not make these paths public
merely to enable this feature. If rules deny access, the application reports
offline/browser-local storage and retains the server's local dataset.

Server profiles separate datasets; they do not introduce authentication or
per-server access control.

## Async saves and offline recovery

Each page session has an immutable active server ID. Switching blocks input,
waits for its save queue, stores the current map view, then reloads. Old callbacks
cannot be rebound to another collection. Full writes are serialized and copy
their input data before awaiting network operations. Failed saves block switching
and trigger the browser's leave-page warning; export a backup before recovery.

Offline edits set a server-specific pending-local flag. On a later launch they
load from local storage instead of being replaced by stale cloud data. A later
explicit edit/import retries saving the current server dataset when Firebase is
available. This retains the existing full-dataset save semantics, not collaborative
conflict resolution. Back up offline changes before reconciling concurrent edits.

## Import/export

Exports include only the active server's markers (all characters, regardless of
visibility filters) and a `server: { id, name }` field. Filenames include the
server name. Select the intended destination before importing. The confirmation
shows source and destination IDs/names and warns that Replace removes existing
markers on that destination. Merge retains existing IDs and adds new ones.
Older backups without server metadata are identified as RosalitaRP. An import
that was reading a file when switching began is cancelled, never redirected.

## Verification

Run `node tests/server-profiles.test.cjs`. Tests use an in-memory Firestore mock
and localStorage, not production data. They cover legacy path mapping, identical
IDs in independent servers, create/edit/delete, offline reload and recovery,
profiles/renaming, survey/filter isolation, exports and legacy imports, delayed
writes, and switching only after the original server has saved.
