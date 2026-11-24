const assert = require("node:assert/strict");
const { createPreviewServer } = require("../tools/serve.cjs");
(async () => {
  const server = createPreviewServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const index = await fetch(base);
    assert.equal(index.status, 200);
    assert((await index.text()).includes("RedM Explorer"));
    const catalog = await fetch(`${base}/data/categories.json?v=test`);
    assert.equal(catalog.status, 200);
    assert((await catalog.json()).some(category => category.id === "npcs"));
    assert.equal((await fetch(`${base}/.git/config`)).status, 404);
    assert.equal((await fetch(`${base}/js/%2e%2e%5c.git/config`)).status, 404);
    assert.equal((await fetch(base, { method: "POST" })).status, 405);
    console.log("PASS: local HTML/catalog loading, query strings, private-path blocking, read-only HTTP methods.");
  } finally { server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
