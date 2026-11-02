/* Server IDs are stable; a page session is permanently bound to one server. */
const DEFAULT_SERVER = { id: "rosalitarp", name: "RosalitaRP" };
const SERVER_PROFILES_KEY = "explorer-server-profiles";
const ACTIVE_SERVER_KEY = "explorer-active-server";
let serverProfiles = readServerProfiles();
const activeServerId = readActiveServerId();
let serverSwitching = false;
let serverWriteQueue = Promise.resolve({ ok: true });
let serverWriteFailed = false;
let pendingServerWrites = 0;

function validServerProfile(profile) {
  return profile && typeof profile.id === "string" &&
    /^[a-z0-9-]{1,80}$/.test(profile.id) &&
    typeof profile.name === "string" && profile.name.trim().length > 0 &&
    profile.name.length <= 80;
}

function readServerProfiles() {
  try {
    const saved = JSON.parse(localStorage.getItem(SERVER_PROFILES_KEY) || "[]");
    const profiles = new Map([[DEFAULT_SERVER.id, DEFAULT_SERVER]]);
    if (Array.isArray(saved)) saved.filter(validServerProfile).forEach(p => profiles.set(p.id, p));
    return Array.from(profiles.values());
  } catch (_) { return [{ ...DEFAULT_SERVER }]; }
}

function readActiveServerId() {
  try {
    const id = localStorage.getItem(ACTIVE_SERVER_KEY);
    return serverProfiles.some(p => p.id === id) ? id : DEFAULT_SERVER.id;
  } catch (_) { return DEFAULT_SERVER.id; }
}

function getActiveServer() {
  return { ...serverProfiles.find(p => p.id === activeServerId) };
}

function serverStorageKey(key) {
  return activeServerId === DEFAULT_SERVER.id ? key : `${key}:server:${activeServerId}`;
}

function getServerMarkerCollection(db) {
  return activeServerId === DEFAULT_SERVER.id
    ? db.collection("markers")
    : db.collection("servers").doc(activeServerId).collection("markers");
}

// Snapshot arguments at the caller; serialize full-collection writes in this session.
function queueServerWrite(operation) {
  if (serverSwitching) return Promise.resolve({ ok: false, message: "Server switch in progress." });
  pendingServerWrites += 1;
  const result = serverWriteQueue.then(operation).catch(error => {
    console.error("Server save failed", error);
    return { ok: false, message: "Server save failed." };
  }).then(value => {
    if (!value.ok) serverWriteFailed = true;
    pendingServerWrites -= 1;
    return value;
  });
  serverWriteQueue = result;
  return result;
}

async function initializeServerControls() {
  // Registry synchronization is optional; marker storage has its own availability.
  if (firebaseDb) {
    try {
      const snapshot = await firebaseDb.collection("serverProfiles").get();
      snapshot.docs.forEach(doc => {
        const profile = { ...doc.data(), id: doc.id };
        if (!validServerProfile(profile)) return;
        const index = serverProfiles.findIndex(p => p.id === profile.id);
        if (index < 0) serverProfiles.push(profile); else serverProfiles[index] = profile;
      });
      localStorage.setItem(SERVER_PROFILES_KEY, JSON.stringify(serverProfiles));
    } catch (error) { console.warn("Server profiles are using browser-local storage.", error); }
  }
  renderServerControls();
  document.getElementById("server-selector").addEventListener("change", event => switchServer(event.target.value));
  document.getElementById("server-create").addEventListener("click", () => editServerProfile(true));
  document.getElementById("server-rename").addEventListener("click", () => editServerProfile(false));
}

function renderServerControls() {
  const select = document.getElementById("server-selector");
  select.innerHTML = "";
  serverProfiles.forEach(profile => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    option.selected = profile.id === activeServerId;
    select.appendChild(option);
  });
  document.getElementById("app-subtitle").textContent = `${getActiveServer().name} — ${APP_SUBTITLE}`;
}

async function editServerProfile(create) {
  if (serverSwitching) return;
  const name = prompt(create ? "New server name:" : "Rename this server:", create ? "" : getActiveServer().name);
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) { alert("Enter a server name of 1–80 characters."); return; }
  if (serverProfiles.some(p => p.name.toLowerCase() === trimmed.toLowerCase() && (create || p.id !== activeServerId))) {
    alert("A server with that name already exists. Select it from the server list."); return;
  }
  const profile = { id: create ? crypto.randomUUID() : activeServerId, name: trimmed };
  const next = create ? [...serverProfiles, profile] : serverProfiles.map(p => p.id === profile.id ? profile : p);
  try { localStorage.setItem(SERVER_PROFILES_KEY, JSON.stringify(next)); }
  catch (_) { alert("Unable to save the server profile. Check browser storage."); return; }
  serverProfiles = next;
  renderServerControls();
  if (firebaseDb) {
    try { await firebaseDb.collection("serverProfiles").doc(profile.id).set(profile); }
    catch (_) { alert("Profile saved in this browser only. Firestore profile access is unavailable."); }
  }
  if (create) await switchServer(profile.id);
}

async function switchServer(id) {
  if (serverSwitching || id === activeServerId || !serverProfiles.some(p => p.id === id)) return;
  serverSwitching = true;
  const overlay = document.getElementById("server-switch-overlay");
  overlay.hidden = false;
  document.getElementById("sidebar").inert = true;
  try {
    await serverWriteQueue;
    if (serverWriteFailed) throw new Error("A save failed. Export a backup before reloading or switching servers.");
    const center = map.getCenter();
    sessionStorage.setItem("explorer-switch-map-view", JSON.stringify({ lat: center.lat, lng: center.lng, zoom: map.getZoom() }));
    localStorage.setItem(ACTIVE_SERVER_KEY, id);
    // Reload instead of rebinding mutable globals: old async work cannot target the next server.
    location.reload();
  } catch (error) {
    serverSwitching = false;
    overlay.hidden = true;
    document.getElementById("sidebar").inert = false;
    renderServerControls();
    alert(error.message || "Unable to switch servers.");
  }
}

function restoreServerMapView() {
  try {
    const value = sessionStorage.getItem("explorer-switch-map-view");
    sessionStorage.removeItem("explorer-switch-map-view");
    if (!value) return;
    const view = JSON.parse(value);
    if ([view.lat, view.lng, view.zoom].every(Number.isFinite)) map.setView([view.lat, view.lng], view.zoom);
  } catch (_) { /* Keep the normal map view. */ }
}

window.addEventListener("beforeunload", event => {
  if (pendingServerWrites > 0 || serverWriteFailed) { event.preventDefault(); event.returnValue = ""; }
});
