const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

module.exports = async function verifyHiddenMarkers(page, browser, origin) {
  await page.waitForFunction(() => TYPE_DATA.hidden?.length === 2);
  assert((await page.locator('#category-list').innerText()).includes('Hidden'));
  for (const [category, type, name] of [['hidden','stable','Stable'], ['hidden','wardrobe','Wardrobe'], ['npcs','shady-dealer','Shady Dealer']]) {
    await page.evaluate(() => openMarkerDialog({lat:3000,lng:4000}));
    await page.locator('#marker-category').selectOption(category);
    await page.locator('#marker-type').selectOption(type);
    await page.locator('#marker-name').fill(name);
    await page.locator('#marker-save').click();
    await page.waitForFunction(() => pendingServerWrites === 0);
    assert.equal(await page.locator('#edit-marker-type').inputValue(), type);
    await page.locator('#edit-marker-name').fill(`${name} edited`);
    await page.locator('#edit-marker-save').click();
    await page.waitForFunction(() => pendingServerWrites === 0);
    assert(await page.evaluate(name => getSearchHaystack(markers.find(m => m.name === `${name} edited`)).includes(name.toLowerCase()), name));
    await page.evaluate(([cat, id]) => setTypeFilter(cat, id, false), [category,type]);
    assert.equal(await page.evaluate(type => getVisibleMarkers().some(m => m.type === type), type), false);
    await page.evaluate(([cat, id]) => setTypeFilter(cat, id, true), [category,type]);
    assert.equal(await page.evaluate(type => getVisibleMarkers().some(m => m.type === type), type), true);
  }
  const result = await page.evaluate(async () => {
    const backup = createMarkerExport(getMarkersForExport());
    const imported = validateMarkerImport(JSON.parse(JSON.stringify(backup)));
    const archive = validateServerArchive(await createServerArchive(activeServerId));
    await replaceMarkers(imported.markers);
    return {ok:imported.ok, count:markers.length, local:loadMarkersFromLocalStorage().length,
      archived:archive.markers.length, paths:markers.map(m => getTypeGroupForType(m.category,m.type).icon)};
  });
  assert.equal(result.ok,true);
  assert.equal(result.count,3);
  assert.equal(result.local,3);
  assert.equal(result.archived,3);
  assert.equal(new Set(result.paths).size,3);
  // Render at actual 17px marker size beside existing authoritative icons.
  const preview = await browser.newPage();
  const icons = ['general-npc','fence','storefront','hitching-post','wardrobe','shady-dealer'];
  await preview.setContent(`<body style="background:#1b140e;color:#f2e2bd;font:16px sans-serif;display:flex;gap:24px;padding:30px">${icons.map(icon=>`<div style="text-align:center"><p>${icon}</p><div style="margin:auto;background:#d8c3a3;border:2px solid #c49a5a;border-radius:50%;width:24px;height:24px;display:grid;place-items:center"><img width="17" height="17" src="${origin}/images/icons/${icon}.svg"></div><p><img width="72" height="72" src="${origin}/images/icons/${icon}.svg"></p></div>`).join('')}</body>`);
  await preview.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
  const screenshot = path.join(os.tmpdir(),'rathan-hidden-icons.png');
  await preview.screenshot({path:screenshot});
  console.log(`Icon preview: ${screenshot}`);
  await preview.close();
  console.log('PASS: Hidden/NPC creation and editing controls, independent type filters, search, local saves, export/import, archive inclusion, and distinct icon assets.');
};

