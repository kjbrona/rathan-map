const assert = require("node:assert/strict");
const vm = require("node:vm");
const { session, store, cloud, local, collection, read, clone, subscriptions } = require("./server-profiles.test.cjs");

async function main() {
  store.clear(); cloud.clear();
  const raw = { id: "preserve-me", name: "Original discovery", category: "npcs", type: "fence",
    x: 123.5, y: 456, status: "verified", confidence: "exact", knownBy: ["jim"],
    createdAt: "2025-01-01T00:00:00Z", modifiedAt: "2026-01-01T00:00:00Z", foundBy: "Contributor",
    foundDate: "2025-01-01", notes: "Keep this", fields: { custom: 12 }, customExtension: { nested: [1, "keep"] } };
  await collection("markers").doc(raw.id).set(raw);
  local.setItem("rosalitarp-explorer-markers", JSON.stringify([raw]));
  local.setItem("rosalitarp-explorer-removed-possible-location-ids", JSON.stringify(["survey-1"]));
  local.setItem("rosalitarp-explorer-filters", JSON.stringify({ character: "tom", categories: ["npcs"] }));
  const survey = [{ candidateId: "survey-1", category: "herbs", type: "agarita", x: 1, y: 2, source: "Survey", custom: "keep" }];
  local.setItem("rosalitarp-explorer-survey-data", JSON.stringify(survey));
  const app = session();
  const c = app.c;
  const controls = [{ disabled: false }, { disabled: false }];
  c.document.querySelectorAll = () => controls;
  const oldGet = c.document.getElementById;
  c.document.getElementById = id => {
    const e = oldGet(id); e.classList = { add() {}, remove() {} }; e.click = () => {}; return e;
  };
  c.confirm = () => true;
  c.setTimeout = () => 0;
  c.clearTimeout = () => {};
  for (const file of ["categories", "types", "templates", "markerManager", "serverArchive"]) vm.runInContext(read(`js/${file}.js`), c);
  c.categoryData = JSON.parse(read("data/categories.json"));
  c.typeData = Object.fromEntries(c.categoryData.map(cat => [cat.id, JSON.parse(read(`data/types/${cat.id}.json`))]));
  c.groups = JSON.parse(read("data/type-groups.json"));
  c.raw = raw;
  app.run("CATEGORIES=categoryData;TYPE_DATA=typeData;TYPE_GROUP_LIST=groups;TYPE_GROUPS=Object.fromEntries(groups.map(g=>[g.id,g]));markers=[raw];");
  c.clearRenderedMarkers = () => {};
  c.renderMarker = () => {};
  c.updateMarkerStats = () => {};
  await app.run("initializeFirebaseStorage()");
  const before = clone([...cloud.get("markers")]);
  const localBefore = local.getItem("rosalitarp-explorer-markers");
  // Confirmation is mandatory and cancel leaves metadata/data untouched.
  c.confirm = () => false;
  await app.run("setServerArchived('rosalitarp',true)");
  assert.equal(app.run("isServerArchived()"), false);
  c.confirm = () => true;
  await app.run("setServerArchived('rosalitarp',true)");
  assert.equal(app.run("isServerArchived()"), true);
  assert.deepEqual(clone([...cloud.get("markers")]), before);
  assert.equal(local.getItem("rosalitarp-explorer-markers"), localBefore);
  assert(app.run("getActiveServer().archivedAt"));
  assert(controls.every(control => control.disabled));
  assert.equal(c.document.getElementById("add-marker-btn").disabled, true);
  assert.equal(c.document.getElementById("import-markers-btn").disabled, true);
  assert.equal(session().run("isServerArchived()"), true, "Lifecycle survives reload");
  for (const code of ["saveMarkers([raw])", "saveMarker(raw,[raw])", "deleteStoredMarker(raw.id,[])", "addMarker(raw)", "updateMarker(raw.id,{name:'Bad'})", "deleteMarker(raw.id)", "replaceMarkers([])"]) {
    assert.equal((await app.run(code)).ok, false, code);
  }
  assert.equal(await app.run("saveMarkersToFirebase([])"), false);
  assert.equal(app.run("saveMarkersToLocalStorage([]).ok"), false);
  app.run("removePossibleLocation('survey-1');saveCandidateIdSet(REMOVED_POSSIBLE_LOCATIONS_STORAGE_KEY,new Set());");
  assert.equal(local.getItem("rosalitarp-explorer-removed-possible-location-ids"), '["survey-1"]');
  await app.run("loadMarkers()");
  const callback = subscriptions.get("markers");
  callback(await collection("markers").get());
  assert.equal(local.getItem("rosalitarp-explorer-markers"), localBefore, "Read/sync must not rewrite archived cache");
  const archive = clone(await app.run("createServerArchive()"));
  c.archive = archive;
  app.run("validateServerArchive(archive)");
  assert.deepEqual(archive.markers, [raw]);
  assert.deepEqual(archive.candidateSurvey.data, survey);
  assert.equal(archive.settings["rosalitarp-explorer-removed-possible-location-ids"], '["survey-1"]');
  await assert.rejects(app.run("restoreServerArchive(archive)"), /Reactivate/);
  await app.run("setServerArchived('rosalitarp',false)");
  assert.equal(app.run("canEditServer()"), true);
  assert(controls.every(control => !control.disabled));
  assert.deepEqual(clone([...cloud.get("markers")]), before);
  // Modify data then restore the exact original archive, including its archived status.
  await collection("markers").doc("extra").set({ ...raw, id: "extra" });
  local.setItem("rosalitarp-explorer-removed-possible-location-ids", "[]");
  assert.equal(await app.run("restoreServerArchive(archive)"), true);
  assert.deepEqual(clone([...cloud.get("markers")]), before);
  assert.deepEqual(JSON.parse(local.getItem("rosalitarp-explorer-markers")), [raw]);
  assert.equal(local.getItem("rosalitarp-explorer-removed-possible-location-ids"), '["survey-1"]');
  assert.equal(app.run("isServerArchived()"), true);
  assert.equal(JSON.parse(local.getItem("explorer-archive-recovery:rosalitarp")).markers.length, 2);
  assert.equal(local.getItem("explorer-archive-restore-pending:rosalitarp"), null);
  assert(app.reloads() > 0);
  assert.deepEqual(clone(app.run("normalizeStoredMarker(raw).customExtension")), raw.customExtension);
  for (const mutate of [
    a => { a.archiveVersion = 99; }, a => { a.markerCount++; },
    a => { a.markers.push(a.markers[0]); a.markerCount++; },
    a => { a.settings["explorer-active-server"] = '"other"'; },
    a => { a.candidateSurvey.data[0].x = "bad"; },
  ]) {
    c.invalid = clone(archive); mutate(c.invalid);
    assert.throws(() => app.run("validateServerArchive(invalid)"));
  }
  c.legacy = { version: "1.3.58", application: "RosalitaRP Explorer", markers: [raw] };
  assert.equal(app.run("validateMarkerImport(legacy).ok"), true);
  assert.equal(app.run("validateMarkerImport(legacy).server.id"), "rosalitarp");
  console.log("PASS: metadata-only archive/reactivation, read-only guards/UI, persistence across sessions, no archived sync writes, exact complete archive restore, recovery, custom fields, validation, and old backups.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
