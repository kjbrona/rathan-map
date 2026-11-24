const SERVER_ARCHIVE_FORMAT = "explorer-server-archive";
const SERVER_ARCHIVE_VERSION = 1;
const SURVEY_DATA_STORAGE_KEY = "rosalitarp-explorer-survey-data";
const ARCHIVE_SETTING_KEYS = [
  "rosalitarp-explorer-filters", "rosalitarp-explorer-add-marker-prefs",
  "rosalitarp-explorer-possible-locations-visible", "rosalitarp-explorer-possible-locations-filter",
  "rosalitarp-explorer-removed-possible-location-ids", "rosalitarp-explorer-candidate-layer-visible",
  "rosalitarp-explorer-hidden-candidates",
];

function applyServerReadOnlyUI() {
  const archived = isServerArchived();
  const status = document.getElementById("server-readonly-status");
  if (status) status.textContent = archived ? `${getActiveServer().name} — Archived / Read Only` : "";
  for (const id of ["sync-local-markers", "add-marker-btn", "import-markers-btn", "import-markers-file", "archive-restore", "restore-hidden-candidates"]) {
    const control = document.getElementById(id);
    if (control) control.disabled = !canEditServer();
  }
  document.querySelectorAll("#marker-details-form input, #marker-details-form select, #marker-details-form textarea, #marker-details-form button, [data-candidate-action]")
    .forEach(control => { control.disabled = !canEditServer(); });
  for (const id of ["server-create", "server-rename", "management-create", "archive-restore"]) {
    const control = document.getElementById(id);
    if (control) control.disabled = !isOwner() || serverLifecycleBusy || serverSwitching || (id === "archive-restore" && archived);
  }
  if (!canEditServer()) {
    currentMode = MODES.BROWSE;
    document.getElementById("marker-dialog")?.classList.add("hidden");
    document.getElementById("import-mode-cancel")?.click();
    if (typeof removePendingMarkerPreview === "function") removePendingMarkerPreview();
    if (typeof closeContextMenu === "function") closeContextMenu();
  }
}

function initializeServerManagement() {
  document.getElementById("server-manage").addEventListener("click", () => {
    renderServerManagement();
    document.getElementById("server-management-dialog").classList.remove("hidden");
  });
  document.getElementById("server-management-close").addEventListener("click", () => {
    document.getElementById("server-management-dialog").classList.add("hidden");
  });
  document.getElementById("management-create").addEventListener("click", () => editServerProfile(true));
  document.getElementById("archive-restore").addEventListener("click", () => document.getElementById("archive-restore-file").click());
  document.getElementById("archive-restore-file").addEventListener("change", restoreArchiveFromFile);
  for (const [id, prefix] of [["archive-recovery", "explorer-archive-recovery"], ["archive-pending", "explorer-archive-restore-pending"]]) {
    document.getElementById(id).addEventListener("click", () => {
      try {
        const value = localStorage.getItem(`${prefix}:${activeServerId}`);
        if (!value) { alert("No saved restore backup for this server."); return; }
        downloadServerArchive(validateServerArchive(JSON.parse(value)));
      } catch (error) { alert(error.message); }
    });
  }
  // Other open clients see new lifecycle metadata without rebinding marker storage.
  if (firebaseDb) {
    firebaseDb.collection("serverProfiles").onSnapshot(snapshot => {
      snapshot.docs.forEach(doc => {
        const profile = { ...doc.data(), id: doc.id };
        if (!validServerProfile(profile)) return;
        const index = serverProfiles.findIndex(p => p.id === profile.id);
        if (index < 0) serverProfiles.push(profile);
        else if ((Date.parse(profile.updatedAt) || 0) >= (Date.parse(serverProfiles[index].updatedAt) || 0)) serverProfiles[index] = profile;
      });
      try { localStorage.setItem(SERVER_PROFILES_KEY, JSON.stringify(serverProfiles)); } catch (_) {}
      renderServerControls();
      renderServerManagement();
      applyServerReadOnlyUI();
    }, error => console.warn("Server lifecycle sync unavailable", error));
  }
  window.addEventListener("storage", event => {
    if (event.key !== SERVER_PROFILES_KEY) return;
    serverProfiles = readServerProfiles();
    renderServerControls(); renderServerManagement(); applyServerReadOnlyUI();
  });
}

function renderServerManagement() {
  for (const archived of [false, true]) {
    const list = document.getElementById(archived ? "archived-server-list" : "active-server-list");
    if (!list) continue;
    list.innerHTML = "";
    const profiles = serverProfiles.filter(p => (p.status === "archived") === archived);
    if (!profiles.length) list.textContent = "None";
    for (const profile of profiles) {
      const row = document.createElement("div");
      row.className = "server-management-row";
      const name = document.createElement("strong");
      name.textContent = profile.name + (archived ? ` — Archived ${profile.archivedAt ? new Date(profile.archivedAt).toLocaleDateString() : ""}` : " — Active");
      row.appendChild(name);
      for (const [label, action] of [
        [archived ? "View Read Only" : "Select", () => switchServer(profile.id)],
        ["Export Complete Archive", () => exportServerArchive(profile.id)],
        [archived ? "Reactivate" : "Archive", () => setServerArchived(profile.id, !archived)],
      ]) {
        const button = document.createElement("button");
        button.type = "button"; button.textContent = label;
        button.disabled = serverLifecycleBusy || (["Archive", "Reactivate"].includes(label) && !isOwner());
        button.addEventListener("click", () => Promise.resolve(action()).catch(error => alert(error.message)));
        row.appendChild(button);
      }
      list.appendChild(row);
    }
  }
}

async function persistServerProfile(profile) {
  if (!isOwner()) throw new Error("Only the owner can manage servers or restore archives.");
  const next = serverProfiles.map(p => p.id === profile.id ? profile : p);
  localStorage.setItem(SERVER_PROFILES_KEY, JSON.stringify(next));
  serverProfiles = next;
  if (firebaseDb) {
    try { await firebaseDb.collection("serverProfiles").doc(profile.id).set(profile); return; }
    catch (_) { /* Local lifecycle state remains valid and is timestamped. */ }
  }
  alert("Server status saved in this browser only. Other browsers need Firestore metadata access to see this change.");
}

async function setServerArchived(id, archived) {
  if (!isOwner()) throw new Error("Only the owner can manage servers or restore archives.");
  if (serverLifecycleBusy || serverSwitching) return;
  const profile = serverProfiles.find(p => p.id === id);
  if (!profile || isServerArchived(id) === archived) return;
  if (!confirm(`${archived ? "Archive" : "Reactivate"} "${profile.name}"?\n${archived ? "Markers will be preserved unchanged. Editing will be disabled." : "Normal editing will be enabled. No marker migration or import is required."}`)) return;
  serverLifecycleBusy = true;
  applyServerReadOnlyUI(); renderServerManagement();
  try {
    await serverWriteQueue;
    if (serverWriteFailed) throw new Error("Export a backup and resolve the failed save before changing server status.");
    const now = new Date().toISOString();
    await persistServerProfile({ ...profile, status: archived ? "archived" : "active",
      archivedAt: archived ? now : profile.archivedAt || null, updatedAt: now });
  } finally {
    serverLifecycleBusy = false;
    renderServerControls(); renderServerManagement(); applyServerReadOnlyUI();
  }
}

async function readArchiveMarkers(id) {
  await serverWriteQueue;
  const dirty = localStorage.getItem(serverStorageKey("explorer-pending-local-markers", id)) === "true";
  if (id === activeServerId && (dirty || serverWriteFailed)) return JSON.parse(JSON.stringify(getMarkersForExport()));
  if (firebaseDb && !dirty) {
    try {
      const snapshot = await getServerMarkerCollection(firebaseDb, id).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (_) { /* Fall back only to an existing cache, never an invented empty backup. */ }
  }
  const value = localStorage.getItem(serverStorageKey(MARKER_STORAGE_KEY, id));
  if (value === null) throw new Error("No readable marker dataset. Connect to Firebase or open this server to load its data before exporting.");
  const data = JSON.parse(value);
  return Array.isArray(data) ? data : data.markers;
}

async function readArchiveSurvey(id) {
  const stored = localStorage.getItem(serverStorageKey(SURVEY_DATA_STORAGE_KEY, id));
  if (stored !== null) return JSON.parse(stored);
  if (id !== DEFAULT_SERVER.id) return [];
  const response = await fetch(`${CANDIDATE_SURVEY_DATA_PATH}?v=${encodeURIComponent(APP_VERSION)}`);
  if (!response.ok) throw new Error("Candidate Survey could not be loaded; complete archive export was cancelled.");
  return response.json();
}

async function createServerArchive(id = activeServerId) {
  const profile = serverProfiles.find(p => p.id === id);
  if (!profile) throw new Error("Unknown server.");
  const markers = await readArchiveMarkers(id);
  const survey = await readArchiveSurvey(id);
  const settings = Object.fromEntries(ARCHIVE_SETTING_KEYS.map(key => [key, localStorage.getItem(serverStorageKey(key, id))]));
  return {
    format: SERVER_ARCHIVE_FORMAT, archiveVersion: SERVER_ARCHIVE_VERSION,
    application: STORAGE_APPLICATION, applicationVersion: APP_VERSION, exportedAt: new Date().toISOString(),
    server: { ...profile, status: profile.status || "active", archivedAt: profile.archivedAt || null },
    markerCount: markers.length, markers,
    characters: [{ id: "jim", name: "Jim" }, { id: "tom", name: "Tom" }],
    candidateSurvey: { data: survey }, settings,
    definitions: { mode: "shared-reference", categories: CATEGORIES, types: TYPE_DATA,
      typeGroups: TYPE_GROUP_LIST, templates: TEMPLATE_DATA },
  };
}

function downloadServerArchive(archive) {
  const date = new Date(archive.exportedAt);
  const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}_${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" }));
  link.href = url; link.download = `${archive.server.name.replace(/[^a-z0-9_-]/gi, "_")}_Archive_${stamp}.json`;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

async function exportServerArchive(id) {
  const archive = await createServerArchive(id);
  validateServerArchive(archive);
  downloadServerArchive(archive);
}

function validateServerArchive(archive) {
  const fail = message => { throw new Error(`Invalid server archive: ${message}`); };
  if (!archive || archive.format !== SERVER_ARCHIVE_FORMAT || archive.archiveVersion !== 1 || archive.application !== STORAGE_APPLICATION) fail("unsupported format.");
  if (typeof archive.applicationVersion !== "string" || !Number.isFinite(Date.parse(archive.exportedAt))) fail("missing version or export date.");
  if (!validServerProfile(archive.server) || !["active", "archived"].includes(archive.server.status)) fail("server metadata.");
  if (archive.server.status === "archived" && !archive.server.archivedAt) fail("missing archive date.");
  if (!Array.isArray(archive.markers) || archive.markerCount !== archive.markers.length) fail("marker count.");
  const ids = new Set();
  for (const marker of archive.markers) {
    if (!marker || typeof marker.id !== "string" || !marker.id || marker.id.includes("/") || ids.has(marker.id) || !normalizeStoredMarker(marker)) fail("invalid or duplicate marker.");
    ids.add(marker.id);
  }
  if (!Array.isArray(archive.characters) || archive.characters.length !== 2 || !["jim", "tom"].every(id => archive.characters.some(c => c.id === id && typeof c.name === "string"))) fail("unsupported character definitions.");
  if (!Array.isArray(archive.candidateSurvey?.data) || archive.candidateSurvey.data.some(c => !normalizeCandidateSurveyRecord(c))) fail("candidate survey.");
  if (!archive.settings || typeof archive.settings !== "object" || Array.isArray(archive.settings) || Object.keys(archive.settings).some(key => !ARCHIVE_SETTING_KEYS.includes(key))) fail("settings keys.");
  for (const key of ARCHIVE_SETTING_KEYS) {
    const value = archive.settings[key];
    if (value !== null && typeof value !== "string") fail("settings values.");
    if (value !== null) {
      let parsed;
      try { parsed = JSON.parse(value); } catch (_) { fail("settings JSON."); }
      if (key.includes("visible") && typeof parsed !== "boolean") fail("survey visibility.");
      if ((key.includes("ids") || key.endsWith("hidden-candidates")) && (!Array.isArray(parsed) || parsed.some(id => typeof id !== "string"))) fail("survey decisions.");
      if ((key.endsWith("filters") || key.endsWith("filter") || key.endsWith("prefs")) && (!parsed || typeof parsed !== "object" || Array.isArray(parsed))) fail("settings object.");
    }
  }
  if (archive.definitions?.mode !== "shared-reference") fail("custom category overrides are not supported by this application.");
  return archive;
}

async function restoreServerArchive(archive) {
  if (!isOwner()) throw new Error("Only the owner can manage servers or restore archives.");
  validateServerArchive(archive);
  if (!canEditServer()) throw new Error("Reactivate the destination server before restoring an archive.");
  const target = getActiveServer();
  if (target.id !== archive.server.id) throw new Error("Select the archive's original server ID before restoring. This prevents mixing server datasets.");
  if (!confirm(`Restore the complete archive into "${target.name}" (${target.id})?\nThis overwrites its markers, survey decisions, and saved settings. The archive's ${archive.server.status} status will be restored. A recovery archive of the current data will be saved locally first.`)) return false;
  serverLifecycleBusy = true;
  applyServerReadOnlyUI();
  try {
    await serverWriteQueue;
    if (serverWriteFailed) throw new Error("Resolve the failed save before restoring.");
    const recovery = await createServerArchive(target.id);
    localStorage.setItem(`explorer-archive-recovery:${target.id}`, JSON.stringify(recovery));
    // Keep both complete snapshots before any overwrite. Cross-store restores are not atomic.
    const staged = `explorer-archive-restore-pending:${target.id}`;
    localStorage.setItem(staged, JSON.stringify(archive));
    const rawMarkers = JSON.parse(JSON.stringify(archive.markers));
    // Deliberate restore uses raw validated documents so extension fields and timestamps survive exactly.
    if (isFirebaseStorageAvailable()) {
      const collection = getServerMarkerCollection(firebaseDb);
      const previous = await collection.get();
      const incoming = new Set(rawMarkers.map(m => m.id));
      const operations = rawMarkers.map(marker => ["set", collection.doc(marker.id), marker]);
      previous.docs.filter(doc => !incoming.has(doc.id)).forEach(doc => operations.push(["delete", doc.ref]));
      for (let offset = 0; offset < operations.length; offset += 400) {
        if (!isOwner() || isServerArchived()) throw new Error("Server was archived elsewhere; restore stopped. Recovery and staged archives are retained.");
        const batch = firebaseDb.batch();
        operations.slice(offset, offset + 400).forEach(([op, ref, data]) => op === "set" ? batch.set(ref, data) : batch.delete(ref));
        await batch.commit();
      }
    }
    if (!isOwner() || isServerArchived()) throw new Error("Server was archived elsewhere; restore stopped. Recovery and staged archives are retained.");
    localStorage.setItem(serverStorageKey(MARKER_STORAGE_KEY), JSON.stringify(rawMarkers));
    for (const key of ARCHIVE_SETTING_KEYS) {
      if (archive.settings[key] === null) localStorage.removeItem(serverStorageKey(key));
      else localStorage.setItem(serverStorageKey(key), archive.settings[key]);
    }
    localStorage.setItem(serverStorageKey(SURVEY_DATA_STORAGE_KEY), JSON.stringify(archive.candidateSurvey.data));
    if (isFirebaseStorageAvailable()) clearPendingLocalMarkers();
    else localStorage.setItem(serverStorageKey("explorer-pending-local-markers"), "true");
    markers = sanitizeMarkers(rawMarkers);
    await persistServerProfile({ ...archive.server, id: target.id, updatedAt: new Date().toISOString() });
    localStorage.removeItem(staged);
    sessionStorage.setItem(SERVER_SWITCH_TARGET_KEY, target.id);
    location.reload();
    return true;
  } finally {
    serverLifecycleBusy = false;
    applyServerReadOnlyUI();
  }
}

async function restoreArchiveFromFile(event) {
  try {
    if (!canEditServer()) throw new Error("Archived servers are read only. Reactivate first.");
    const file = event.target.files[0];
    if (!file) return;
    const archive = validateServerArchive(JSON.parse(await file.text()));
    if (!serverProfiles.some(p => p.id === archive.server.id)) {
      if (!confirm(`Register "${archive.server.name}" from this archive? No data will be written yet. Select it and choose this file again to restore.`)) return;
      const profile = { ...archive.server, status: "active", archivedAt: null, updatedAt: new Date().toISOString() };
      serverProfiles.push(profile);
      localStorage.setItem(SERVER_PROFILES_KEY, JSON.stringify(serverProfiles));
      if (localStorage.getItem(serverStorageKey(MARKER_STORAGE_KEY, profile.id)) === null) {
        localStorage.setItem(serverStorageKey(MARKER_STORAGE_KEY, profile.id), "[]");
      }
      await switchServer(profile.id);
      return;
    }
    await restoreServerArchive(archive);
  } catch (error) { alert(`${error.message}\nIf a restore was interrupted, recovery and staged archives remain in browser storage. Do not clear browser storage.`); }
  finally { event.target.value = ""; }
}
