/*
==================================================
RosalitaRP Explorer
Version : 1.1.0
Creator : Rathan
==================================================
*/

let markerSearchInput = null;
let searchResultsPanel = null;
let searchResultsSummary = null;
let searchResultsList = null;

function initializeSearch() {
  markerSearchInput = document.getElementById("marker-search");
  searchResultsPanel = document.getElementById("search-results");
  searchResultsSummary = document.getElementById("search-results-summary");
  searchResultsList = document.getElementById("search-results-list");

  if (!markerSearchInput) {
    return;
  }

  markerSearchInput.disabled = false;
  markerSearchInput.placeholder = "Search markers...";
  markerSearchInput.addEventListener("input", updateSearchResults);
}

function updateSearchResults() {
  if (!markerSearchInput || !searchResultsPanel || !searchResultsList) {
    return;
  }

  const query = normalizeSearchText(markerSearchInput.value);

  if (!query) {
    searchResultsPanel.classList.add("hidden");
    searchResultsList.innerHTML = "";
    updateSearchSummary(0);
    return;
  }

  const matchingMarkers = getVisibleMarkers().filter((markerData) =>
    getSearchHaystack(markerData).includes(query)
  );

  renderSearchResults(matchingMarkers);
}

function renderSearchResults(matchingMarkers) {
  searchResultsPanel.classList.remove("hidden");
  searchResultsList.innerHTML = "";
  updateSearchSummary(matchingMarkers.length);

  if (matchingMarkers.length === 0) {
    const emptyMessage = document.createElement("div");
    emptyMessage.className = "search-empty";
    emptyMessage.textContent = "No visible markers match your search.";
    searchResultsList.appendChild(emptyMessage);
    return;
  }

  matchingMarkers.forEach((markerData) => {
    searchResultsList.appendChild(createSearchResultRow(markerData));
  });
}

function createSearchResultRow(markerData) {
  const category = getCategoryById(markerData.category);
  const type = getTypeById(markerData.category, markerData.type);
  const resultButton = document.createElement("button");

  resultButton.type = "button";
  resultButton.className = "search-result-row";
  resultButton.innerHTML = `
    <span class="search-result-icon">${createTypeGroupIconHtml(
      markerData.category,
      markerData.type,
      "search-result-icon-image"
    )}</span>
    <span class="search-result-main">
      <strong>${escapeHtml(markerData.name)}</strong>
      <small>${escapeHtml(getSearchCategoryTypeLabel(category, type))}</small>
    </span>
    <span class="search-result-status">${escapeHtml(
      markerData.status || "unverified"
    )}</span>
  `;

  resultButton.addEventListener("click", function () {
    selectMarker(markerData.id);

    if (!centerOnMarker(markerData.id)) {
      alert("That marker is currently hidden by filters.");
    }
  });

  return resultButton;
}

function updateSearchSummary(resultCount) {
  if (!searchResultsSummary) {
    return;
  }

  searchResultsSummary.textContent = `${resultCount} matching marker${
    resultCount === 1 ? "" : "s"
  }`;
}

function getSearchHaystack(markerData) {
  const category = getCategoryById(markerData.category);
  const type = getTypeById(markerData.category, markerData.type);
  const group = getTypeGroupForType(markerData.category, markerData.type);
  const values = [
    markerData.name,
    category ? category.name : markerData.category,
    type ? type.name : markerData.type,
    group ? group.name : "",
    markerData.status,
    markerData.confidence,
    markerData.notes,
    markerData.itemName,
    markerData.rarity,
    markerData.foundBy,
    markerData.itemUse,
    markerData.craftingUses,
    markerData.itemNotes,
    ...Object.values(markerData.fields || {}),
    ...Object.values(markerData.templateData || {}),
  ];

  return normalizeSearchText(values.join(" "));
}

function getSearchCategoryTypeLabel(category, type) {
  const categoryName = category ? category.name : "Unknown Category";
  const typeName = type ? type.name : "Unknown Type";
  return `${categoryName} / ${typeName}`;
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase();
}
