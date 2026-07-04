/*
==================================================
RosalitaRP Explorer
Version : 1.3.21
Creator : Rathan
==================================================
*/

let USE_DATA = [];

async function loadUseData() {
  const response = await fetch(
    `data/uses.json?v=${encodeURIComponent(APP_VERSION)}`
  );
  USE_DATA = await response.json();
  return USE_DATA;
}

function getUseOptions() {
  return USE_DATA;
}

function getUseLabel(useId) {
  const use = USE_DATA.find((useData) => useData.id === useId);
  return use ? use.label : "";
}

function getUseLabels(useIds = []) {
  return normalizeUses(useIds)
    .map(getUseLabel)
    .filter(Boolean);
}

function normalizeUses(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const validUseIds = new Set(USE_DATA.map((use) => use.id));

  return value
    .map((useId) => String(useId || "").trim())
    .filter((useId, index, useIds) => {
      return useId && validUseIds.has(useId) && useIds.indexOf(useId) === index;
    });
}
