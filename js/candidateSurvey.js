/*
==================================================
RosalitaRP Explorer
Possible Locations Layer
==================================================
*/

const CANDIDATE_SURVEY_DATA_PATH =
  "candidate-survey/phase2/wildflower-candidate-survey-quality.json";
const POSSIBLE_LOCATIONS_VISIBLE_STORAGE_KEY =
  "rosalitarp-explorer-possible-locations-visible";
const POSSIBLE_LOCATIONS_FILTER_STORAGE_KEY =
  "rosalitarp-explorer-possible-locations-filter";
const REMOVED_POSSIBLE_LOCATIONS_STORAGE_KEY =
  "rosalitarp-explorer-removed-possible-location-ids";
const LEGACY_CANDIDATE_LAYER_VISIBLE_STORAGE_KEY =
  "rosalitarp-explorer-candidate-layer-visible";
const LEGACY_HIDDEN_CANDIDATES_STORAGE_KEY =
  "rosalitarp-explorer-hidden-candidates";

let candidateSurveyLayer = L.layerGroup();
let candidateSurveyData = [];
let candidateSurveySkippedCount = 0;
let possibleLocationFilter = loadPossibleLocationFilter();
let removedPossibleLocationIds = loadRemovedPossibleLocationIds();
let candidateSurveyVisible = loadPossibleLocationsVisible();

async function initializeCandidateSurveyLayer() {
  initializePossibleLocationControls();
  await loadCandidateSurveyData();
  updatePossibleLocationControls();
  renderCandidateSurveyLayer();
}

function initializePossibleLocationControls() {
  const visibleToggle = document.getElementById("show-candidate-survey");
  const suggestedHerbFilter = document.getElementById(
    "possible-location-suggested-herb-filter"
  );
  const restoreButton = document.getElementById("restore-hidden-candidates");

  if (visibleToggle) {
    visibleToggle.addEventListener("change", function () {
      candidateSurveyVisible = this.checked;
      savePossibleLocationsVisible(candidateSurveyVisible);
      renderCandidateSurveyLayer();
      updateMapLayerSummary();
    });
  }

  if (suggestedHerbFilter) {
    suggestedHerbFilter.addEventListener("change", function () {
      possibleLocationFilter.suggestedHerb = this.value;
      savePossibleLocationFilter();
      renderCandidateSurveyLayer();
    });
  }

  if (restoreButton) {
    restoreButton.addEventListener("click", restoreRemovedPossibleLocations);
  }
}

async function loadCandidateSurveyData() {
  const status = document.getElementById("candidate-survey-status");

  try {
    const response = await fetch(
      `${CANDIDATE_SURVEY_DATA_PATH}?v=${encodeURIComponent(APP_VERSION)}`
    );

    if (!response.ok) {
      throw new Error(`Possible Locations dataset failed to load: ${response.status}`);
    }

    const rawCandidates = await response.json();
    const validated = rawCandidates.reduce(
      (result, candidate) => {
        const normalizedCandidate = normalizeCandidateSurveyRecord(candidate);

        if (normalizedCandidate) {
          result.loaded.push(normalizedCandidate);
        } else {
          result.skipped += 1;
        }

        return result;
      },
      { loaded: [], skipped: 0 }
    );

    candidateSurveyData = validated.loaded;
    candidateSurveySkippedCount = validated.skipped;
    populateSuggestedHerbFilter();

    if (status) {
      status.textContent = `${candidateSurveyData.length} possible locations loaded` +
        (candidateSurveySkippedCount
          ? `; ${candidateSurveySkippedCount} skipped`
          : "");
    }
  } catch (error) {
    console.warn("Possible Locations data could not be loaded.", error);
    candidateSurveyData = [];
    candidateSurveySkippedCount = 0;
    populateSuggestedHerbFilter();

    if (status) {
      status.textContent = "Possible Locations could not be loaded";
    }
  }
}

function normalizeCandidateSurveyRecord(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const candidateId = String(candidate.candidateId || "").trim();
  const category = String(candidate.category || "").trim();
  const type = String(candidate.type || candidate.suggestedHerb || "").trim();
  const x = Number(candidate.x);
  const y = Number(candidate.y);
  const source = String(candidate.source || "").trim();

  if (
    !candidateId ||
    category !== "herbs" ||
    !type ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !source ||
    !getTypeById(category, type)
  ) {
    return null;
  }

  const typeRecord = getTypeById(category, type);

  return {
    ...candidate,
    candidateId,
    category,
    type,
    suggestedHerb: type,
    typeName: candidate.typeName || candidate.suggestedHerbName || typeRecord.name,
    x,
    y,
    source,
  };
}

function populateSuggestedHerbFilter() {
  const filter = document.getElementById(
    "possible-location-suggested-herb-filter"
  );

  if (!filter) {
    return;
  }

  const options = (TYPE_DATA.herbs || [])
    .filter((type) => type.enabled !== false)
    .map((type) => [type.id, type.name])
    .sort((left, right) => left[1].localeCompare(right[1]));

  filter.innerHTML = `<option value="">All Suggested Herbs</option>`;

  options.forEach(([typeId, typeName]) => {
    const option = document.createElement("option");
    option.value = typeId;
    option.textContent = typeName;
    filter.appendChild(option);
  });

  if (
    possibleLocationFilter.suggestedHerb &&
    options.some(([typeId]) => typeId === possibleLocationFilter.suggestedHerb)
  ) {
    filter.value = possibleLocationFilter.suggestedHerb;
  } else {
    possibleLocationFilter.suggestedHerb = "";
    filter.value = "";
    savePossibleLocationFilter();
  }
}

function renderCandidateSurveyLayer() {
  candidateSurveyLayer.clearLayers();

  if (candidateSurveyVisible && !map.hasLayer(candidateSurveyLayer)) {
    candidateSurveyLayer.addTo(map);
  }

  if (!candidateSurveyVisible) {
    if (map.hasLayer(candidateSurveyLayer)) {
      candidateSurveyLayer.remove();
    }
    updateCandidateSurveySummary([]);
    updateMapLayerSummary();
    return;
  }

  const visibleCandidates = getVisibleCandidateSurveyData();

  visibleCandidates.forEach((candidate) => {
    renderCandidateSurveyMarker(candidate);
  });

  updateCandidateSurveySummary(visibleCandidates);
  updateMapLayerSummary();
}

function getVisibleCandidateSurveyData() {
  return candidateSurveyData.filter((candidate) => {
    return (
      !removedPossibleLocationIds.has(candidate.candidateId) &&
      (!possibleLocationFilter.suggestedHerb ||
        candidate.suggestedHerb === possibleLocationFilter.suggestedHerb)
    );
  });
}

function renderCandidateSurveyMarker(candidate) {
  const group = getTypeGroupForType(candidate.category, candidate.type);
  const iconPath = getTypeGroupIconUrl(group);
  const iconLabel = group ? group.name : candidate.typeName || "Possible Location";

  const leafletMarker = L.marker([candidate.y, candidate.x], {
    icon: createCandidateSurveyMarkerIcon(iconPath, iconLabel),
  }).addTo(candidateSurveyLayer);

  leafletMarker.bindPopup(createCandidateSurveyPopupHtml(candidate));
  leafletMarker.on("click", function (event) {
    if (event.originalEvent) {
      L.DomEvent.stopPropagation(event.originalEvent);
    }
  });
}

function createCandidateSurveyMarkerIcon(iconPath, iconLabel) {
  const iconHtml = iconPath
    ? `<img class="candidate-survey-icon-image" src="${escapeHtml(
        iconPath
      )}" alt="${escapeHtml(iconLabel)}" />`
    : "";

  return L.divIcon({
    className: "candidate-survey-marker possible-location-marker",
    html: `<div class="candidate-survey-marker-icon">${iconHtml}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

function createCandidateSurveyPopupHtml(candidate) {
  return `
    <div class="candidate-popup">
      <h3>Possible Location</h3>
      <dl>
        <dt>Suggested Herb</dt>
        <dd>${escapeHtml(candidate.typeName || candidate.type)}</dd>
        <dt>Coordinates</dt>
        <dd>X ${formatCandidateCoordinate(candidate.x)} | Y ${formatCandidateCoordinate(
    candidate.y
  )}</dd>
        <dt>Source</dt>
        <dd>${escapeHtml(candidate.source)}</dd>
        <dt>Survey Confidence</dt>
        <dd>${escapeHtml(formatSurveyConfidence(candidate.surveyConfidence))}</dd>
      </dl>
      <p class="candidate-popup-note">
        Approximate search location. Normal Explorer markers are authoritative.
      </p>
      <div class="candidate-popup-actions">
        <button type="button" data-candidate-action="promote" data-candidate-id="${escapeHtml(
          candidate.candidateId
        )}">Add Marker Here</button>
        <button type="button" data-candidate-action="remove" data-candidate-id="${escapeHtml(
          candidate.candidateId
        )}">Remove Survey Point</button>
      </div>
    </div>
  `;
}

document.addEventListener("click", function (event) {
  if (!(event.target instanceof Element)) {
    return;
  }

  const actionButton = event.target.closest("[data-candidate-action]");

  if (!actionButton) {
    return;
  }

  const candidateId = actionButton.dataset.candidateId;
  const action = actionButton.dataset.candidateAction;

  if (action === "promote") {
    addMarkerFromPossibleLocation(candidateId);
  }

  if (action === "remove") {
    removePossibleLocation(candidateId);
  }
});

async function addMarkerFromPossibleLocation(candidateId) {
  const candidate = getCandidateById(candidateId);

  if (!candidate) {
    return;
  }

  map.closePopup();
  currentMode = MODES.BROWSE;

  await openMarkerDialog(L.latLng(candidate.y, candidate.x), {
    category: "herbs",
    type: candidate.type,
    name: candidate.typeName || getSelectedTypeName("herbs", candidate.type),
    status: "unverified",
    confidence: "guess",
    x: candidate.x,
    y: candidate.y,
    itemNotes: `Started from Possible Location.\nSource: ${candidate.source}\nCandidate ID: ${candidate.candidateId}`,
  });
}

function handleCandidatePromotedMarkerSaved() {
  // Possible Locations are field-survey prompts. Adding a normal marker does
  // not automatically remove the prompt; use Remove Survey Point explicitly.
}

function removePossibleLocation(candidateId) {
  if (!getCandidateById(candidateId)) {
    return;
  }

  if (
    !window.confirm("Remove this Possible Location from your survey map?")
  ) {
    return;
  }

  removedPossibleLocationIds.add(candidateId);
  saveCandidateIdSet(
    REMOVED_POSSIBLE_LOCATIONS_STORAGE_KEY,
    removedPossibleLocationIds
  );
  renderCandidateSurveyLayer();
  map.closePopup();
}

function restoreRemovedPossibleLocations() {
  if (removedPossibleLocationIds.size === 0) {
    return;
  }

  if (
    !window.confirm(
      `Restore ${removedPossibleLocationIds.size} removed Possible Locations?`
    )
  ) {
    return;
  }

  removedPossibleLocationIds = new Set();
  saveCandidateIdSet(
    REMOVED_POSSIBLE_LOCATIONS_STORAGE_KEY,
    removedPossibleLocationIds
  );
  renderCandidateSurveyLayer();
}

function getCandidateById(candidateId) {
  return candidateSurveyData.find(
    (candidate) => candidate.candidateId === candidateId
  );
}

function updatePossibleLocationControls() {
  const visibleToggle = document.getElementById("show-candidate-survey");
  const suggestedHerbFilter = document.getElementById(
    "possible-location-suggested-herb-filter"
  );

  if (visibleToggle) {
    visibleToggle.checked = candidateSurveyVisible;
  }

  if (suggestedHerbFilter) {
    suggestedHerbFilter.value = possibleLocationFilter.suggestedHerb || "";
  }

  updateCandidateSurveySummary();
}

function updateCandidateSurveySummary() {
  const summary = document.getElementById("candidate-survey-summary");
  const restoreButton = document.getElementById("restore-hidden-candidates");

  if (!summary) {
    return;
  }

  const counts = getCandidateSurveyCounts();
  const rows = summary.querySelectorAll("strong");

  if (rows.length >= 3) {
    rows[0].textContent = counts.total;
    rows[1].textContent = counts.remaining;
    rows[2].textContent = counts.removed;
  }

  if (restoreButton) {
    restoreButton.textContent = `Restore Removed Locations (${counts.removed})`;
    restoreButton.disabled = counts.removed === 0;
  }
}

function getCandidateSurveyCounts() {
  return {
    total: candidateSurveyData.length,
    remaining: candidateSurveyData.length - removedPossibleLocationIds.size,
    removed: removedPossibleLocationIds.size,
  };
}

function getCandidateLayerSummary() {
  if (!candidateSurveyVisible) {
    return "Locations Off";
  }

  return `Locations ${getVisibleCandidateSurveyData().length}`;
}

function getCandidateSurveyLoadSummary() {
  return {
    loaded: candidateSurveyData.length,
    skipped: candidateSurveySkippedCount,
  };
}

function loadPossibleLocationsVisible() {
  try {
    const saved = localStorage.getItem(POSSIBLE_LOCATIONS_VISIBLE_STORAGE_KEY);

    if (saved !== null) {
      return saved === "true";
    }

    return (
      localStorage.getItem(LEGACY_CANDIDATE_LAYER_VISIBLE_STORAGE_KEY) === "true"
    );
  } catch (error) {
    return false;
  }
}

function savePossibleLocationsVisible(visible) {
  try {
    localStorage.setItem(
      POSSIBLE_LOCATIONS_VISIBLE_STORAGE_KEY,
      String(visible)
    );
  } catch (error) {
    console.warn("Possible Locations visibility could not be saved.", error);
  }
}

function loadPossibleLocationFilter() {
  try {
    const savedFilters = JSON.parse(
      localStorage.getItem(POSSIBLE_LOCATIONS_FILTER_STORAGE_KEY) || "{}"
    );

    return {
      suggestedHerb:
        typeof savedFilters.suggestedHerb === "string"
          ? savedFilters.suggestedHerb
          : "",
    };
  } catch (error) {
    return { suggestedHerb: "" };
  }
}

function savePossibleLocationFilter() {
  try {
    localStorage.setItem(
      POSSIBLE_LOCATIONS_FILTER_STORAGE_KEY,
      JSON.stringify(possibleLocationFilter)
    );
  } catch (error) {
    console.warn("Possible Locations filter could not be saved.", error);
  }
}

function loadRemovedPossibleLocationIds() {
  const removedIds = loadCandidateIdSet(REMOVED_POSSIBLE_LOCATIONS_STORAGE_KEY);
  const legacyHiddenIds = loadCandidateIdSet(LEGACY_HIDDEN_CANDIDATES_STORAGE_KEY);

  if (removedIds.size === 0 && legacyHiddenIds.size > 0) {
    saveCandidateIdSet(
      REMOVED_POSSIBLE_LOCATIONS_STORAGE_KEY,
      legacyHiddenIds
    );
    return legacyHiddenIds;
  }

  return removedIds;
}

function loadCandidateIdSet(storageKey) {
  try {
    const values = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return new Set(Array.isArray(values) ? values : []);
  } catch (error) {
    return new Set();
  }
}

function saveCandidateIdSet(storageKey, idSet) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(idSet)));
  } catch (error) {
    console.warn("Possible Locations local state could not be saved.", error);
  }
}

function formatCandidateCoordinate(coordinate) {
  return Number(coordinate).toFixed(2);
}

function formatSurveyConfidence(confidence) {
  if (!confidence) {
    return "Not specified";
  }

  return String(confidence).charAt(0).toUpperCase() + String(confidence).slice(1);
}
