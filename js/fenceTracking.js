/* Rotating NPC tracking. All mutations use one per-server transaction; marker
   autosaves never write this document. UTC boundaries are independent of DST. */
const FENCE_SCHEDULE = Object.freeze({ weekday: 5, hour: 8, minute: 0 });
const FENCE_LABELS = { current: "Current Location", known: "Known Location", searched: "Searched — Not Found", unconfirmed: "Unconfirmed Location" };
const FENCE_CACHE_KEY = "explorer-fence-tracking";
let fenceTracking = null;
let fenceTrackingReady = false;
let fenceTrackingMessage = "Loading Fence tracking…";
let fenceTrackingBusy = false;
let fenceStateFilter = "";
let fenceUncheckedOnly = false;
let fenceLastRotation = "";

function rotatingNpcBoundary(time, schedule) {
  const date = new Date(time);
  const boundary = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), schedule.hour, schedule.minute);
  let start = boundary - ((date.getUTCDay() - schedule.weekday + 7) % 7) * 86400000;
  if (start > date.getTime()) start -= 604800000;
  return { id: new Date(start).toISOString(), start, next: start + 604800000 };
}

function fenceScheduleForServer(id = activeServerId) {
  const profile = serverProfiles.find(p => p.id === id);
  // Never infer a weekly schedule for legacy Rosalita or unrelated profiles.
  return profile?.status !== "archived" && profile?.name.trim().toLowerCase() === "ranch roleplay" ? { ...FENCE_SCHEDULE } : null;
}

function emptyFenceTracking(id = activeServerId) {
  return { schemaVersion: 1, revision: 0, serverId: id, npcType: "fence", schedule: fenceScheduleForServer(id), locations: {}, observations: [], current: null };
}

function isFenceMarker(marker) { return marker?.category === "npcs" && marker.type === "fence"; }
function isTrackedFence(marker) { return isFenceMarker(marker) && !!fenceTracking?.schedule; }
function fenceDocument(id = activeServerId) { return firebaseDb.collection("servers").doc(id).collection("rotatingNpcs").doc("fence"); }
function fenceClone(value) { return JSON.parse(JSON.stringify(value)); }

function fenceLocationInfo(marker, data = fenceTracking, time = Date.now()) {
  const records = (data?.observations || []).filter(o => o.markerId === marker.id);
  const valid = records.filter(o => !o.invalidated);
  const found = valid.filter(o => o.result === "found");
  const confirmed = data?.locations?.[marker.id]?.confirmed === true || marker.fenceConfirmed === true ||
    found.length > 0 || (marker.fenceConfirmed !== false && data?.locations?.[marker.id]?.confirmed !== false);
  const rotation = data?.schedule ? rotatingNpcBoundary(time, data.schedule).id : null;
  const weekly = valid.filter(o => o.rotationId === rotation);
  const latest = weekly[weekly.length - 1];
  const searched = !!latest && ["found", "not-found"].includes(latest.result);
  const current = data?.current?.rotationId === rotation && data.current.markerId === marker.id &&
    latest?.id === data.current.observationId && latest?.result === "found";
  const state = current ? "current" : latest?.result === "not-found" ? "searched" : confirmed ? "known" : "unconfirmed";
  const datedFound = found.slice().sort((a,b) => a.observedAt.localeCompare(b.observedAt));
  const searches = valid.filter(o => o.result !== "clear");
  return { state, confirmed, searched, latest, records, first: datedFound[0], last: datedFound[datedFound.length-1],
    lastSearch: searches[searches.length-1], count: new Set(found.map(o => o.rotationId)).size };
}

function validateFenceTracking(value, serverId) {
  const fail = () => { throw new Error("Invalid Fence tracking data or server/rotation identification."); };
  if (!value || value.schemaVersion !== 1 || value.serverId !== serverId || value.npcType !== "fence") fail();
  if (value.revision !== undefined && (!Number.isSafeInteger(value.revision) || value.revision < 0)) fail();
  const schedule = value.schedule;
  if (schedule !== null && (!schedule || !Number.isInteger(schedule.weekday) || schedule.weekday < 0 || schedule.weekday > 6 ||
    !Number.isInteger(schedule.hour) || schedule.hour < 0 || schedule.hour > 23 || !Number.isInteger(schedule.minute) || schedule.minute < 0 || schedule.minute > 59)) fail();
  const safeId = id => typeof id === "string" && id.length > 0 && id.length <= 200 && !["__proto__", "constructor", "prototype"].includes(id) && !id.includes("/");
  if (!value.locations || typeof value.locations !== "object" || Array.isArray(value.locations) || !Array.isArray(value.observations)) fail();
  for (const [id, loc] of Object.entries(value.locations)) if (!safeId(id) || !loc || typeof loc.confirmed !== "boolean") fail();
  const ids = new Set();
  for (const o of value.observations) {
    if (!o || !safeId(o.id) || ids.has(o.id) || !safeId(o.markerId) || o.serverId !== serverId || !schedule ||
      !["found", "not-found", "clear"].includes(o.result) || typeof o.contributor !== "string" || o.contributor.length > 120 ||
      typeof o.observedAt !== "string" || !Number.isFinite(Date.parse(o.observedAt)) ||
      rotatingNpcBoundary(Date.parse(o.observedAt), schedule).id !== o.rotationId) fail();
    if (o.invalidated && (typeof o.invalidated.reason !== "string" || !o.invalidated.reason.trim() ||
      !Number.isFinite(Date.parse(o.invalidated.at)) || typeof o.invalidated.by !== "string")) fail();
    ids.add(o.id);
  }
  if (value.current) {
    const o = value.observations.find(o => o.id === value.current.observationId);
    if (!o || o.invalidated || o.result !== "found" || o.markerId !== value.current.markerId || o.rotationId !== value.current.rotationId) fail();
  }
  return value;
}

function applyFenceObservation(data, marker, result, contributor, now, observationId, correction) {
  const next = fenceClone(data);
  next.revision = (data.revision || 0) + 1;
  if (!next.schedule) throw new Error("This server has no Fence rotation schedule.");
  const info = fenceLocationInfo(marker, next, now);
  next.locations[marker.id] = { confirmed: info.confirmed || result === "found" || result === "known" };
  if (correction) {
    const record = next.observations.find(o => o.id === correction.id && o.markerId === marker.id);
    if (!record || record.invalidated) throw new Error("This observation has already been corrected or no longer exists.");
    record.invalidated = { at: new Date(now).toISOString(), by: contributor, reason: correction.reason };
    if (next.current?.observationId === record.id) next.current = null;
  } else if (result !== "known" && result !== "unconfirmed") {
    const rotationId = rotatingNpcBoundary(now, next.schedule).id;
    if (next.observations.some(o => o.id === observationId)) return next;
    next.observations.push({ id: observationId, markerId: marker.id, serverId: next.serverId,
      rotationId, result, observedAt: new Date(now).toISOString(), contributor });
    if (result === "found") next.current = { markerId: marker.id, rotationId, observationId };
    else if (next.current?.markerId === marker.id && next.current.rotationId === rotationId) next.current = null;
  }
  return validateFenceTracking(next, next.serverId);
}

function cacheFenceTracking(data) {
  try { localStorage.setItem(serverStorageKey(FENCE_CACHE_KEY, data.serverId), JSON.stringify(data)); }
  catch (_) { console.warn("Fence history could not be cached; cloud data remains authoritative."); }
}

function loadFenceCache(id = activeServerId) {
  const text = localStorage.getItem(serverStorageKey(FENCE_CACHE_KEY, id));
  return text ? validateFenceTracking(JSON.parse(text), id) : null;
}

async function initializeFenceTracking() {
  try { fenceTracking = loadFenceCache() || emptyFenceTracking(); }
  catch (_) { fenceTracking = emptyFenceTracking(); }
  fenceLastRotation = fenceTracking.schedule ? rotatingNpcBoundary(Date.now(), fenceTracking.schedule).id : "";
  initializeFenceUI();
  if (firebaseDb) {
    try {
    fenceDocument().onSnapshot({ includeMetadataChanges: true }, snapshot => {
      try {
        const incoming = snapshot.exists ? validateFenceTracking(snapshot.data(), activeServerId) : emptyFenceTracking();
        if ((incoming.revision || 0) >= (fenceTracking?.revision || 0)) fenceTracking = incoming;
        fenceTrackingReady = !snapshot.metadata.fromCache;
        fenceTrackingMessage = fenceTrackingReady ? "Shared Fence tracking connected" : "Cached history — connect to record observations";
        if (snapshot.exists) cacheFenceTracking(fenceTracking);
        refreshFenceViews();
      } catch (error) { fenceTrackingReady = false; fenceTrackingMessage = error.message; renderFencePanel(); }
    }, error => {
      fenceTrackingReady = false;
      fenceTrackingMessage = "Fence sync unavailable. History is cached; observations are not saved. Check connection and tracking permissions.";
      console.warn("Fence tracking sync unavailable", error); renderFencePanel();
    });
    } catch (error) { fenceTrackingMessage = "Fence sync unavailable — no observations will be saved."; console.warn(error); }
  } else { fenceTrackingMessage = "Cached history only — Firebase is unavailable"; }
  setInterval(tickFenceRotation, 1000);
  document.addEventListener("visibilitychange", tickFenceRotation);
  window.addEventListener("focus", tickFenceRotation);
  refreshFenceViews();
}

function tickFenceRotation() {
  const id = fenceTracking?.schedule ? rotatingNpcBoundary(Date.now(), fenceTracking.schedule).id : "";
  if (id !== fenceLastRotation) { fenceLastRotation = id; refreshFenceViews(); }
  else renderFenceCountdown();
}

function refreshFenceViews() {
  if (typeof refreshMarkers === "function") refreshMarkers();
  const detail = document.getElementById("fence-marker-details");
  if (detail) detail.innerHTML = fenceMarkerHtml(getMarkerById(selectedMarkerId));
  renderFencePanel();
}

async function commitFenceObservation(marker, result, options = {}) {
  if (!canEditServer() || fenceTrackingBusy) throw new Error("Fence tracking is read only or another observation is saving.");
  if (!firebaseDb || !fenceTrackingReady) throw new Error("Connect to shared Fence tracking before saving. No observation was saved.");
  const generation = accountGeneration;
  const serverId = activeServerId;
  const observationId = crypto.randomUUID();
  const contributor = String(options.contributor || "").trim().slice(0,120);
  const previousWrites = serverWriteQueue;
  let releaseWrite;
  const completion = new Promise(resolve => { releaseWrite = resolve; });
  serverWriteQueue = previousWrites.then(() => completion);
  fenceTrackingBusy = true;
  pendingServerWrites += 1;
  renderFencePanel();
  try {
    await previousWrites;
    const saved = await firebaseDb.runTransaction(async tx => {
      const ref = fenceDocument(serverId);
      const profileRef = firebaseDb.collection("serverProfiles").doc(serverId);
      const markerRef = getServerMarkerCollection(firebaseDb, serverId).doc(marker.id);
      const snapshot = await tx.get(ref);
      const profile = await tx.get(profileRef);
      const existingMarker = await tx.get(markerRef);
      if (!hasEditorAccess() || accountGeneration !== generation || serverSwitching || serverLifecycleBusy || isServerArchived() || profile.data()?.status === "archived")
        throw new Error("Server or account changed. No observation saved.");
      if (!options.create && (!existingMarker.exists || !isFenceMarker(existingMarker.data()))) throw new Error("Save this Fence marker to the cloud first.");
      if (options.create && existingMarker.exists) throw new Error("Marker ID already exists.");
      const currentMarker = options.create ? marker : { ...existingMarker.data(), id: marker.id };
      const data = snapshot.exists ? validateFenceTracking(snapshot.data(), serverId) : emptyFenceTracking(serverId);
      const now = Date.now(); // Recalculate within every retry, after all network reads.
      if (result === "not-found" && fenceLocationInfo(currentMarker, data, now).state === "current" && options.confirmedCurrent !== data.current?.observationId)
        throw new Error("CURRENT_CONFLICT");
      const next = applyFenceObservation(data, currentMarker, result, contributor, now, observationId, options.correction);
      // Fail safely well before Firestore's document limit. Never trim history.
      if (new TextEncoder().encode(JSON.stringify(next)).length > 750000) throw new Error("Fence history is approaching the document limit. Export a full backup and contact the maintainer; no history was removed.");
      tx.set(ref, next);
      if (options.create) tx.set(markerRef, sanitizeMarkers([marker])[0]);
      return next;
    });
    if ((saved.revision || 0) >= (fenceTracking?.revision || 0)) fenceTracking = saved;
    cacheFenceTracking(fenceTracking);
    if (options.create && !markers.some(m => m.id === marker.id)) {
      markers.push(marker);
      saveMarkersToLocalStorage(markers);
    }
    fenceTrackingMessage = "Observation saved to shared Fence tracking";
    return saved;
  } finally {
    pendingServerWrites -= 1;
    fenceTrackingBusy = false;
    // A failed transaction has no unsaved optimistic observation to flush.
    releaseWrite({ ok: true });
    refreshFenceViews();
  }
}

async function runFenceAction(markerId, result, correctionId) {
  const marker = getMarkerById(markerId);
  if (!isTrackedFence(marker)) return;
  let correction;
  if (correctionId) {
    const reason = prompt("Why is this observation incorrect? It will remain in history as invalidated.");
    if (!reason?.trim()) return;
    correction = { id: correctionId, reason: reason.trim().slice(0,500) };
  }
  const contributor = prompt("Character or contributor name (optional):", marker.foundBy || "");
  if (contributor === null) return;
  let confirmedCurrent;
  if (result === "not-found" && fenceLocationInfo(marker).state === "current") {
    if (!confirm("This is the confirmed Current Location. Record Not Found and clear its current designation? History and permanent confirmation will be retained.")) return;
    confirmedCurrent = fenceTracking.current.observationId;
  }
  try { await commitFenceObservation(marker, result, { contributor, correction, confirmedCurrent }); }
  catch (error) {
    alert(error.message === "CURRENT_CONFLICT" ? "Another player confirmed this location. Review its current state and try again; explicit confirmation is required." : `${error.message}\nNo observation was reported as saved. Check shared history before retrying.`);
  }
}

function fencePassesFilter(marker) {
  if (!isTrackedFence(marker)) return true;
  const info = fenceLocationInfo(marker);
  return (!fenceStateFilter || info.state === fenceStateFilter) && (!fenceUncheckedOnly || !info.searched);
}

function fenceIconPath(marker) {
  return isTrackedFence(marker) ? `images/icons/fence-${fenceLocationInfo(marker).state}.svg?v=${APP_VERSION}` : null;
}

function fenceDate(value) { return value ? new Date(value).toISOString().replace("T", " ").replace(".000Z", " UTC") : "Not recorded"; }

function fenceMarkerHtml(marker) {
  if (!isTrackedFence(marker)) return "";
  const info = fenceLocationInfo(marker);
  const disabled = !canEditServer() || !fenceTrackingReady || fenceTrackingBusy ? "disabled" : "";
  const button = (action, text) => `<button type="button" data-fence-action="${action}" data-fence-marker="${escapeHtml(marker.id)}" ${disabled}>${text}</button>`;
  return `<section class="fence-marker-info"><strong>${FENCE_LABELS[info.state]}</strong>
    <div>Previously confirmed spawn: ${info.confirmed ? "Yes" : "No"}</div>
    <div>First confirmed: ${fenceDate(info.first?.observedAt)}</div><div>Last confirmed: ${fenceDate(info.last?.observedAt)}</div>
    <div>Confirmed rotations: ${info.count}${info.confirmed && !info.count ? " (earlier history not recorded)" : ""}</div>
    <div>Last searched: ${fenceDate(info.lastSearch?.observedAt)}</div>
    <div>This rotation: ${info.latest ? escapeHtml(info.latest.result) : "Unchecked"}</div>
    <div>Found by: ${escapeHtml(info.last?.contributor || marker.foundBy || "Not recorded")}</div>
    <div>Searched by: ${escapeHtml(info.lastSearch?.contributor || "Not recorded")}</div>
    <p>${escapeHtml(marker.notes || "")}</p>
    ${marker.description ? `<p>${escapeHtml(marker.description)}</p>` : ""}
    ${button("found", "Fence Found Here")}${button("not-found", "Searched — Not Found")}${button("clear", "Clear Weekly Search Status")}
    ${!info.confirmed ? button("known", "Mark as Historical Known Location") : ""}
    </section>`;
}

function fenceSearchSummary(allMarkers, data = fenceTracking, now = Date.now()) {
  const rows = allMarkers.filter(isFenceMarker).map(marker => ({marker, ...fenceLocationInfo(marker, data, now)}));
  const known = rows.filter(r => r.confirmed), unconfirmed = rows.filter(r => !r.confirmed);
  const knownSearched = known.filter(r => r.searched).length, unconfirmedSearched = unconfirmed.filter(r => r.searched).length;
  return { known:known.length, unconfirmed:unconfirmed.length, knownSearched, unconfirmedSearched,
    searched:knownSearched+unconfirmedSearched, remaining:known.length-knownSearched,
    percent:known.length ? Math.round(knownSearched/known.length*100) : 0, current:rows.find(r => r.state === "current")?.marker };
}

function renderFencePanel() {
  const panel = document.getElementById("fence-panel");
  if (!panel) return;
  document.querySelectorAll("[data-fence-action]").forEach(button => { button.disabled = !canEditServer() || !fenceTrackingReady || fenceTrackingBusy; });
  panel.hidden = !fenceTracking?.schedule || !activeFilters.categories.has("npcs") || !activeFilters.types.get("npcs")?.has("fence");
  if (panel.hidden) return;
  const summary = fenceSearchSummary(markers);
  const rotation = rotatingNpcBoundary(Date.now(), fenceTracking.schedule);
  document.getElementById("fence-summary").textContent = summary.current ? "Found" : `${summary.percent}% checked`;
  document.getElementById("fence-sync-status").textContent = fenceTrackingBusy ? "Saving observation…" : fenceTrackingMessage;
  document.getElementById("fence-progress").value = summary.percent;
  document.getElementById("fence-counts").textContent = `Known: ${summary.known} · Unconfirmed: ${summary.unconfirmed} · Known searched: ${summary.knownSearched} · Unconfirmed searched: ${summary.unconfirmedSearched} · Total searched: ${summary.searched} · Known unchecked: ${summary.remaining}`;
  document.getElementById("fence-current").textContent = summary.current ? `Search successful — ${summary.current.name}` : "Current location not yet confirmed";
  document.getElementById("fence-center").disabled = !summary.current;
  document.getElementById("fence-rotation").textContent = `Rotation: ${fenceDate(rotation.id)}. Next relocation: ${fenceDate(rotation.next)}.`;
  document.getElementById("fence-schedule").textContent = JSON.stringify(fenceTracking.schedule) === JSON.stringify(FENCE_SCHEDULE) ? "Friday at 3:00 AM CDT (fixed 08:00 UTC, year-round)" : `Weekly UTC schedule: weekday ${fenceTracking.schedule.weekday}, ${fenceTracking.schedule.hour}:${String(fenceTracking.schedule.minute).padStart(2,"0")}`;
  renderFenceCountdown();
  renderFenceHistory();
}

function renderFenceCountdown() {
  const label = document.getElementById("fence-countdown");
  if (!label || !fenceTracking?.schedule) return;
  const seconds = Math.max(0, Math.ceil((rotatingNpcBoundary(Date.now(), fenceTracking.schedule).next - Date.now())/1000));
  label.textContent = `Relocates in ${Math.floor(seconds/86400)}d ${Math.floor(seconds/3600)%24}h ${Math.floor(seconds/60)%60}m ${seconds%60}s`;
}

function renderFenceHistory() {
  const select = document.getElementById("fence-history-rotation");
  if (!select || !fenceTracking) return;
  const selected = select.value;
  select.innerHTML = '<option value="">All rotations</option>';
  [...new Set(fenceTracking.observations.map(o => o.rotationId))].sort().reverse().forEach(id => {
    const option = document.createElement("option"); option.value=id; option.textContent=fenceDate(id); select.appendChild(option);
  });
  select.value=selected;
  const list = document.getElementById("fence-history-list"); list.replaceChildren();
  const rows = fenceTracking.observations.filter(o => !select.value || o.rotationId === select.value).slice().reverse();
  if (!rows.length) list.textContent="No recorded observations.";
  for (const record of rows) {
    const row = document.createElement("div"); row.className="fence-history-row";
    const marker = getMarkerById(record.markerId);
    row.textContent=`${fenceDate(record.observedAt)} — ${marker?.name || record.markerId}: ${record.result} · ${record.contributor || "Contributor not recorded"}${record.invalidated ? ` · INVALIDATED: ${record.invalidated.reason} (${record.invalidated.by || "unnamed"}, ${fenceDate(record.invalidated.at)})` : ""}`;
    if (!record.invalidated && marker && canEditServer()) {
      const button = document.createElement("button"); button.type="button"; button.textContent="Correct / invalidate";
      button.dataset.fenceMarker=record.markerId; button.dataset.fenceAction="correct"; button.dataset.fenceObservation=record.id;
      button.disabled=!fenceTrackingReady || fenceTrackingBusy; row.appendChild(button);
    }
    list.appendChild(row);
  }
}

function updateFenceCreationControl() {
  const field = document.getElementById("fence-create-field");
  if (field) field.hidden = !isTrackedFence({category:document.getElementById("marker-category").value,type:document.getElementById("marker-type").value});
}

function initializeFenceUI() {
  const savedFilters = loadSavedFilterState() || {};
  fenceStateFilter = Object.hasOwn(FENCE_LABELS, savedFilters.fenceState) ? savedFilters.fenceState : "";
  fenceUncheckedOnly = savedFilters.fenceUnchecked === true;
  document.getElementById("fence-state-filter").value = fenceStateFilter;
  document.getElementById("fence-unchecked").checked = fenceUncheckedOnly;
  document.getElementById("fence-create-state").addEventListener("change", renderPendingMarkerPreview);
  document.getElementById("fence-state-filter").addEventListener("change", e => { fenceStateFilter=e.target.value; applyFilterChange(); });
  document.getElementById("fence-unchecked").addEventListener("change", e => { fenceUncheckedOnly=e.target.checked; applyFilterChange(); });
  document.getElementById("fence-center").addEventListener("click", () => {
    const marker=fenceSearchSummary(markers).current;
    if (marker) { map.setView([marker.y,marker.x],Math.max(map.getZoom(),0)); selectMarker(marker.id); }
  });
  document.getElementById("fence-history-rotation").addEventListener("change", renderFenceHistory);
  document.addEventListener("click", event => {
    const button=event.target.closest("[data-fence-action]");
    if (button && !button.disabled) runFenceAction(button.dataset.fenceMarker, button.dataset.fenceAction, button.dataset.fenceObservation);
  });
  for (const id of ["marker-category","marker-type"]) document.getElementById(id).addEventListener("change", () => setTimeout(updateFenceCreationControl,0));
}

async function exportFenceTracking(id = activeServerId) {
  if (firebaseDb) {
    try {
      const snapshot = await withFirebaseReadTimeout(fenceDocument(id).get({source:"server"}));
      return snapshot.exists ? fenceClone(validateFenceTracking(snapshot.data(),id)) : null;
    } catch (error) {
      const cached=loadFenceCache(id);
      if (cached) throw new Error("Complete Fence history could not be verified with Firebase. Retry online; cached history remains in browser storage.");
      if (serverProfiles.find(p => p.id === id)?.name.trim().toLowerCase() === "ranch roleplay") throw error;
    }
  }
  const cached=loadFenceCache(id);
  if (cached) return fenceClone(cached);
  if (serverProfiles.find(p => p.id === id)?.name.trim().toLowerCase() === "ranch roleplay") throw new Error("Connect to Firebase before exporting this server's Fence history.");
  return null;
}

async function importFenceTracking(data, replace = false, duringRestore = false) {
  if (!data) return; // Old backups do not erase tracking history.
  validateFenceTracking(data, activeServerId);
  if (!hasEditorAccess() || isServerArchived() || serverSwitching || (!duringRestore && serverLifecycleBusy) || !firebaseDb)
    throw new Error("Connect with editing access before importing Fence history.");
  const generation=accountGeneration;
  const saved=await firebaseDb.runTransaction(async tx => {
    const ref=fenceDocument(); const snapshot=await tx.get(ref);
    const profile=await tx.get(firebaseDb.collection("serverProfiles").doc(activeServerId));
    if (!hasEditorAccess() || generation!==accountGeneration || serverSwitching || profile.data()?.status==="archived") throw new Error("Server/account changed during Fence import.");
    const old=snapshot.exists?validateFenceTracking(snapshot.data(),activeServerId):emptyFenceTracking();
    let next=fenceClone(data);
    if (!replace) {
      if (old.observations.length && JSON.stringify(old.schedule)!==JSON.stringify(data.schedule)) throw new Error("Fence schedules differ; restore a complete archive to change the schedule.");
      next=fenceClone(old); next.schedule=data.schedule;
      for (const [id,loc] of Object.entries(data.locations)) next.locations[id]={confirmed:!!(loc.confirmed || old.locations[id]?.confirmed)};
      const ids=new Map(old.observations.map(o=>[o.id,o]));
      for (const o of data.observations) {
        if (ids.has(o.id) && JSON.stringify(ids.get(o.id))!==JSON.stringify(o)) throw new Error("Conflicting Fence observation IDs. Use a reviewed complete archive restore.");
        if (!ids.has(o.id)) next.observations.push(o);
      }
      next.observations.sort((a,b)=>a.observedAt.localeCompare(b.observedAt));
      // Importing history never supersedes a current shared confirmation.
      next.current=old.current || data.current;
    }
    if (next.current && next.current.rotationId!==rotatingNpcBoundary(Date.now(),next.schedule).id) next.current=null;
    next.revision=(old.revision || 0)+1;
    validateFenceTracking(next,activeServerId);
    if (new TextEncoder().encode(JSON.stringify(next)).length>750000) throw new Error("Fence history import exceeds the safe document size; no history was imported.");
    tx.set(ref,next); return next;
  });
  fenceTracking=saved;cacheFenceTracking(saved);refreshFenceViews();
}
