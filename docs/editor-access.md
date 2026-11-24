# Owner and editor setup (v1.3.63)

Owner: **kjbrona@gmail.com**, authenticated with Google and a verified email.
Approved editors can create, edit, delete, and import markers on every active server.
Visitors can view/search/filter/export every server without signing in. Characters
(Tom/Jim) remain map filters, not account permissions or privacy boundaries.
Only the owner can create/rename/archive/reactivate servers, restore complete
archives, or grant/revoke editors. Archived markers reject writes even from the
owner until the server is reactivated.

## Enable on the live site

1. In Firebase project `rosalitarp-explorer-df1b0`, open Authentication → Sign-in
   method, enable **Google**, select a support email, and save. In Authentication
   → Settings → Authorized domains, add the live site's hostname. Add `localhost`
   and `127.0.0.1` if local testing needs sign-in.
2. In Firestore Database → Rules, replace the existing rules with the complete
   contents of the repository's `firestore.rules` and publish. This enables the
   existing multi-server paths and restricts writes; it does not migrate or delete
   any documents. Review existing server profile archive statuses first: a status
   saved only in a browser must be saved to the cloud by the owner to enforce it
   for other clients. Missing profiles are treated as active for legacy compatibility.
3. Deploy the updated static site and sign in with the owner account. Use **Grant
   Editor**, **Remove Editor**, and **List Editors** to manage Google account emails.
   Grants apply to all servers. No editor list is publicly readable.

These setup steps are manual: no live rules, Authentication settings, or marker
data were changed by the code update. Until the new rules are published, the old
public-write `/markers` rule remains in effect and the new server paths remain denied.
Older app versions have no sign-in UI and cannot write under the new rules.

## Recover the pending Ranch markers

Keep the exported Ranch backup and use the same browser/site that holds the local
markers. Select Ranch Roleplay, sign in as owner, and choose **Sync Local Markers**.
Confirm the named destination. Local markers overwrite matching IDs and cloud-only
markers remain; this retry does not propagate local deletions. Failed attempts
retain the pending flag and local data. Do not clear browser storage. Signing in
does not automatically upload, overwrite, or remove any marker data.

## Storage and enforcement

- RosalitaRP remains at `/markers/{id}`; other markers remain at
  `/servers/{serverId}/markers/{id}`. Existing localStorage keys remain unchanged.
- Global grants use `/editors/{lowercaseGoogleEmail}` with `{enabled: true}`.
  Only the owner may write/list grants; verified users may read their own grant.
- `/serverProfiles/{id}` is publicly readable and owner-writable. Profile deletion
  is denied to prevent deletion of archive locks.
- Client controls fail closed when sign-in/editor checks fail. Editor grants from
  offline cached snapshots are not trusted. Rules enforce permissions independently
  of browser controls, including for older clients and direct API requests.
- Queued writes are rejected if the account changes before execution. Firestore
  checks identity and archive status again at commit. Local pending data is retained.
- Public reading is intentional. Do not store secrets in markers or treat a
  server/character filter as private access control.

Implementation follows Firebase's [Google sign-in documentation](https://firebase.google.com/docs/auth/web/google-signin)
and [Firestore authentication and document access rules](https://firebase.google.com/docs/firestore/security/rules-conditions).

## Verification

Run `node tests/auth.test.cjs`, `node tests/server-profiles.test.cjs`,
`node tests/server-archives.test.cjs`, and `node tests/local-server.test.cjs`.
The optional Playwright browser tests use isolated fixtures and no live Firebase.
Before publishing rules, use Firebase's Rules Playground (or an emulator) to verify:
anonymous reads allowed/writes denied; verified Google owner writes allowed;
approved editor writes allowed on both marker paths; non-editor writes denied;
archived server writes denied for owner/editor; editor cannot change profiles or
grants; owner can grant/revoke; revoked editor denied. Actual Google login and
production rules require console setup and are not covered by mocked tests.
