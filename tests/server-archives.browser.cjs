// Optional integration test: requires Playwright and an installed browser.
// Uses a temporary browser profile, local fixtures, and blocks all external requests.
const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const file = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  const type = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".jpg": "image/jpeg" }[path.extname(file)];
  res.setHeader("Content-Type", type || "application/octet-stream"); fs.createReadStream(file).pipe(res);
});
async function main() {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_PATH ? { executablePath: process.env.TEST_BROWSER_PATH } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.addInitScript(() => {
      if (localStorage.getItem("test-fixture-ready")) return;
      localStorage.setItem("test-fixture-ready", "true");
      localStorage.setItem("explorer-server-profiles", JSON.stringify([
        { id: "rosalitarp", name: "RosalitaRP", status: "archived", archivedAt: "2026-11-24T00:00:00Z" },
        { id: "new-server", name: "New Server", status: "active" },
      ]));
      localStorage.setItem("rosalitarp-explorer-markers", JSON.stringify([
        { id: "test-location", name: "Preserved location", category: "npcs", type: "fence", x: 4000, y: 3000, knownBy: ["tom"], notes: "Original notes" },
      ]));
    });
    await page.goto(origin);
    await page.waitForFunction(() => document.getElementById("server-readonly-status").textContent.includes("Read Only"));
    assert.equal(await page.locator("#add-marker-btn").isDisabled(), true);
    assert.equal(await page.locator("#import-markers-btn").isDisabled(), true);
    assert.equal(await page.locator('#server-selector option[value="rosalitarp"]').count(), 0);
    assert.equal(await page.locator(".category-marker").count(), 1);
    await page.locator("#marker-search").fill("Preserved");
    await page.waitForFunction(() => document.getElementById("search-results-list").textContent.includes("Preserved location"));
    await page.locator(".category-marker").click();
    assert.equal(await page.locator("#edit-marker-name").isDisabled(), true);
    await page.locator("#server-manage").click();
    assert((await page.locator("#archived-server-list").innerText()).includes("RosalitaRP"));
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#archived-server-list").getByRole("button", { name: "Export Complete Archive" }).click();
    const download = await downloadPromise;
    const archive = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
    assert.equal(archive.markers[0].notes, "Original notes");
    assert.equal(archive.server.status, "archived");
    assert(archive.candidateSurvey.data.length > 0);
    page.on("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Reactivate", exact: true }).click();
    await page.waitForFunction(() => !document.getElementById("add-marker-btn").disabled);
    await Promise.all([
      page.waitForEvent("load"),
      page.locator("#archive-restore-file").setInputFiles(await download.path()),
    ]);
    await page.waitForFunction(() => document.getElementById("server-readonly-status").textContent.includes("Read Only"));
    await page.waitForFunction(() => document.querySelectorAll(".category-marker").length === 1);
    assert.equal(await page.locator(".category-marker").count(), 1);
    await page.locator("#server-selector").selectOption("new-server");
    await page.waitForFunction(() => document.getElementById("app-subtitle").textContent.includes("New Server"));
    assert.equal(await page.locator(".category-marker").count(), 0);
    assert.deepEqual(errors, []);
    // Real SDK-present paths: a hanging Firestore read must not prevent local UI binding.
    for (const mode of ["stalled", "denied", "connected"]) {
      const probe = await browser.newPage();
      const probeErrors = [];
      probe.on("pageerror", error => probeErrors.push(error.message));
      await probe.route("**/*", route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
      await probe.addInitScript(mode => {
        const marker = { id: "cached", name: "Cached marker", category: "npcs", type: "fence", x: 4000, y: 3000, knownBy: ["tom"] };
        localStorage.setItem("rosalitarp-explorer-markers", JSON.stringify([marker]));
        window.firebase = {
          apps: [{}], app: () => ({}),
          firestore: () => ({ collection: name => ({
            get: () => mode === "stalled" ? new Promise(() => {})
              : mode === "denied" ? Promise.reject(new Error("permission-denied"))
              : Promise.resolve({ docs: name === "markers" ? [{ id: marker.id, data: () => marker }] : [] }),
            onSnapshot: () => () => {},
          }) }),
        };
      }, mode);
      await probe.goto(origin);
      await probe.waitForFunction(() => document.getElementById("server-selector").options.length > 0, null, { timeout: 3000 });
      assert.equal(await probe.locator("#app-title").innerText(), "RedM Explorer");
      await probe.locator("#server-manage").click();
      assert.equal(await probe.locator("#server-management-dialog").isVisible(), true);
      await probe.waitForFunction(() => document.querySelectorAll(".category-marker").length === 1, null, { timeout: 20000 });
      assert.deepEqual(probeErrors, []);
      await probe.close();
    }
    console.log("PASS: isolated browser read-only controls, visible markers/search, hidden archived dropdown entry, full archive download/restore, reactivation and empty-server switch.");
    console.log("PASS: header, selector, management dialog and markers with stalled, denied and connected mock Firestore.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
