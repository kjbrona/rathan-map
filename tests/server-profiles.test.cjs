const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const clone = value => JSON.parse(JSON.stringify(value));
const store = new Map();
const cloud = new Map();
let offline = false;
let delayCommit = null;
const subscriptions = new Map();
const local = {
  getItem: key => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, value),
  removeItem: key => store.delete(key),
};
function collection(name) {
  if (!cloud.has(name)) cloud.set(name, new Map());
  const data = cloud.get(name);
  return {
    path: name,
    doc(id) {
      return {
        id, path: `${name}/${id}`,
        collection: child => collection(`${name}/${id}/${child}`),
        async set(value) { if (offline) throw Error("offline"); data.set(id, clone(value)); },
        async delete() { if (offline) throw Error("offline"); data.delete(id); },
      };
    },
    async get() {
      if (offline) throw Error("offline");
      return { docs: [...data].map(([id, value]) => ({ id, data: () => clone(value), ref: this.doc(id) })) };
    },
    onSnapshot(callback) { subscriptions.set(name, callback); return () => subscriptions.delete(name); },
  };
}
const db = {
  collection,
  batch() {
    const operations = [];
    return {
      set: (ref, data) => operations.push(() => ref.set(data)),
      delete: ref => operations.push(() => ref.delete()),
      async commit() {
        if (delayCommit) await delayCommit;
        for (const operation of operations) await operation();
      },
    };
  },
};
function session(id = "rosalitarp") {
  local.setItem("explorer-active-server", id);
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: "", innerHTML: "", children: [],
      appendChild(child) { this.children.push(child); }, addEventListener() {}, querySelectorAll: () => [] });
    return elements.get(id);
  };
  let reloads = 0;
  const c = vm.createContext({
    setTimeout, clearTimeout,
    console: { log() {}, warn() {}, error() {} }, localStorage: local,
    sessionStorage: local, window: { addEventListener() {} },
    location: { reload() { reloads++; } }, alert() {},
    document: { getElementById: element, createElement: () => element(Math.random()), addEventListener() {} },
    map: { getCenter: () => ({ lat: 2, lng: 3 }), getZoom: () => 1 },
    L: { layerGroup: () => ({}) },
    initializeFirebaseApp: () => ({}), firebase: { firestore: () => db },
    getStateIdForCoordinates: () => "", normalizeUses: value => Array.isArray(value) ? value : [],
    applyRemoteMarkers() {},
  });
  for (const file of ["config", "serverProfiles", "firebaseStorage", "storage", "candidateSurvey"]) {
    vm.runInContext(read(`js/${file}.js`), c, { filename: file });
  }
  return { run: code => vm.runInContext(code, c), c, reloads: () => reloads };
}
const marker = { id: "same-id", name: "Old location", category: "npcs", type: "fence",
  x: 10, y: 20, status: "verified", knownBy: ["jim"], notes: "Keep metadata" };
async function main() {
  for (const file of fs.readdirSync(path.join(root, "js")).filter(f => f.endsWith(".js"))) new vm.Script(read(`js/${file}`));
  local.setItem("explorer-server-profiles", JSON.stringify([{ id: "other", name: "Other RedM" }]));
  local.setItem("rosalitarp-explorer-markers", JSON.stringify([marker]));
  await collection("markers").doc(marker.id).set(marker);
  const originalCloud = clone([...cloud.get("markers")]);
  const rosa = session();
  assert.equal(rosa.run("activeServerId"), "rosalitarp");
  assert.equal((await rosa.run("loadMarkers()"))[0].id, marker.id);
  assert.equal(rosa.run("serverStorageKey(MARKER_STORAGE_KEY)"), "rosalitarp-explorer-markers");
  rosa.run("saveCandidateIdSet(REMOVED_POSSIBLE_LOCATIONS_STORAGE_KEY, new Set(['rosa-candidate']))");
  rosa.run("saveFilterStateToStorage({character:'jim'})");
  const other = session("other");
  assert.equal((await other.run("loadMarkers()")).length, 0);
  assert.equal(other.run("loadRemovedPossibleLocationIds().size"), 0);
  assert.equal(other.run("loadSavedFilterState()"), null);
  other.c.item = { ...marker, name: "Other location" };
  assert((await other.run("saveMarkers([item])")).ok);
  assert.equal(cloud.get("servers/other/markers").get(marker.id).name, "Other location");
  assert.deepEqual(clone([...cloud.get("markers")]), originalCloud);
  other.c.item.notes = "Edited on Other";
  await other.run("saveMarker(item,[item])");
  assert.equal(cloud.get("servers/other/markers").get(marker.id).notes, "Edited on Other");
  const exported = other.run("createMarkerExport([item])");
  assert.equal(exported.server.id, "other");
  other.c.backup = clone(exported);
  assert(other.run("validateMarkerImport(backup).ok"));
  delete other.c.backup.server;
  assert.equal(other.run("validateMarkerImport(backup).server.id"), "rosalitarp");
  await other.run("deleteStoredMarker(item.id,[])");
  assert.equal(cloud.get("servers/other/markers").size, 0);
  assert.equal(cloud.get("markers").size, 1);
  offline = true;
  assert((await other.run("saveMarkers([item])")).ok);
  assert.equal(other.run("loadMarkersFromLocalStorage()[0].notes"), "Edited on Other");
  assert.equal(rosa.run("loadMarkersFromLocalStorage()[0].notes"), "Keep metadata");
  const offlineOther = session("other");
  assert.equal((await offlineOther.run("loadMarkers()"))[0].name, "Other location");
  offline = false;
  const recovered = session("other");
  assert.equal((await recovered.run("loadMarkers()"))[0].notes, "Edited on Other");
  assert.equal(recovered.run("hasPendingLocalMarkers()"), true);
  const delayed = session("other");
  await delayed.run("initializeFirebaseStorage()");
  delayed.c.item = { ...marker, name: "Captured before switch" };
  let release;
  delayCommit = new Promise(resolve => { release = resolve; });
  const saving = delayed.run("saveMarkers([item])");
  delayed.c.item.name = "Later mutation";
  const switching = delayed.run("switchServer('rosalitarp')");
  await Promise.resolve();
  assert.equal(delayed.reloads(), 0);
  release(); await saving; await switching; delayCommit = null;
  assert.equal(delayed.reloads(), 1);
  assert.equal(cloud.get("servers/other/markers").get(marker.id).name, "Captured before switch");
  assert.deepEqual(clone([...cloud.get("markers")]), originalCloud);
  assert.equal(local.getItem("explorer-active-server"), "rosalitarp");
  assert.equal(session("other").run("activeServerId"), "other");
  // Survey decisions survive independently, including the original legacy key.
  assert.equal(rosa.run("loadRemovedPossibleLocationIds().has('rosa-candidate')"), true);
  assert.equal(other.run("loadRemovedPossibleLocationIds().has('rosa-candidate')"), false);
  const profiles = session("other");
  await profiles.run("initializeFirebaseStorage()");
  profiles.c.prompt = () => "Renamed Server";
  await profiles.run("editServerProfile(false)");
  assert.equal(profiles.run("getActiveServer().name"), "Renamed Server");
  assert.equal(cloud.get("serverProfiles").get("other").name, "Renamed Server");
  profiles.c.prompt = () => "Third Server";
  profiles.c.crypto = { randomUUID: () => "third" };
  await profiles.run("editServerProfile(true)");
  assert.equal(profiles.reloads(), 1);
  const third = session("third");
  assert.equal((await third.run("loadMarkers()")).length, 0);
  assert.equal(third.run("getActiveServer().name"), "Third Server");
  third.run("populateSuggestedHerbFilter=()=>{}");
  await third.run("loadCandidateSurveyData()");
  assert.equal(third.run("candidateSurveyData.length"), 0);
  // Exercise the UI import flow: cross-server imports require explicit confirmation.
  vm.runInContext(read("js/sidebar.js"), third.c);
  third.run("requestImportMode=async()=> 'replace'; renderCategoryList=()=>{}; updateMarkerStats=()=>{}");
  let importCalls = 0;
  let confirmation = "";
  third.c.replaceMarkers = async () => { importCalls++; return { imported: 1, skipped: 0 }; };
  third.c.confirm = message => { confirmation = message; return false; };
  third.c.importEvent = { target: { value: "file", files: [{ text: async () => JSON.stringify(exported) }] } };
  await third.run("importMarkersFromFile(importEvent)");
  assert.equal(importCalls, 0);
  assert(confirmation.includes("Other RedM") && confirmation.includes("Third Server") && confirmation.includes("ALL"));
  third.c.confirm = () => true;
  await third.run("importMarkersFromFile(importEvent)");
  assert.equal(importCalls, 1);
  let releaseFile;
  third.c.importEvent.target.files[0].text = () => new Promise(resolve => { releaseFile = resolve; });
  const reading = third.run("importMarkersFromFile(importEvent)");
  third.run("serverSwitching=true");
  releaseFile(JSON.stringify(exported));
  await reading;
  assert.equal(importCalls, 1, "An old file read must not import during a switch");
  console.log("PASS: legacy mapping, independent cloud/local data, create/edit/delete, filters/survey isolation, offline fallback, backups, immutable queued writes and switching after saves.");
}
module.exports = { session, store, cloud, local, collection, db, subscriptions, read, clone };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
