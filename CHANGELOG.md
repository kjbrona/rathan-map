# RosalitaRP Explorer

## v1.0.0
- Added optional Firebase Web SDK and Firestore shared marker sync.
- Added shared Firestore collection `markers` with marker UUIDs as document IDs.
- Added document-level Firebase saves for marker add, edit, move, and delete workflows.
- Added realtime marker updates from Firestore while keeping filters, search, and sidebar state local.
- Preserved localStorage fallback when Firebase is unavailable or not configured.
- Added footer data source status for Firebase Connected, Firebase Offline, and Local Browser Storage.

## v0.9.0
- Added JSON-driven marker templates for herbs, trees, fishing, mining, NPCs, and crafting benches.
- Added dynamic Add Marker and Selected Marker fields based on marker category.
- Added template-specific marker field persistence while keeping older marker saves and exports compatible.
- Expanded search indexing to include every template field.

## v0.8.2
- Added marker right-click context menu for centering, moving, editing, deleting, and copying coordinates.
- Added map right-click context menu for adding markers and copying coordinates.
- Added context menu close behavior for outside clicks, Escape, and selected actions.

## v0.8.1
- Added Move Marker workflow for correcting selected marker locations.
- Added Move Marker and Cancel Move controls in the Selected Marker panel.
- Added Escape-to-cancel support and map click placement for move mode.
- Preserved existing marker status, confidence, filters, statistics, and autosave behavior when moving markers.

## v0.8.0
- Added live marker search across marker name, category, type, status, confidence, and notes.
- Added sidebar search results with matching counts and marker detail rows.
- Added click-to-select search results that center the map on visible matching markers.
- Kept search results scoped to the current category and type filters.

## v0.7.0
- Added automatic Local Storage persistence through `saveMarkers()` and `loadMarkers()`.
- Added Export Markers backup downloads with versioned pretty-printed JSON.
- Added Import Markers restore flow with Replace Existing Markers and Merge With Existing Markers modes.
- Added import validation for invalid JSON, wrong application, unsupported version, empty files, and missing marker arrays.
- Prevented duplicate markers during merge imports by UUID.
- Added footer autosave status for Saved, Saving..., and Not Saved states.
- Kept saved marker data limited to plain marker fields, without Leaflet objects.
- Updated herb and fishing type lists and ensured category deselect clears child type filters.

## v0.6.2
- Polished the sidebar into fixed header, tools, selected marker, statistics, and footer sections.
- Made the filter area the only scrollable sidebar region.
- Added disabled search placeholder in preparation for future search.
- Improved category/type filter styling with hover states, animated expansion, and partial checkbox states.
- Moved statistics below filters and added a currently visible marker count.
- Added footer metadata for version, creator, and local browser storage data source.

## v0.6.1
- Added nested category and type filters in the sidebar.
- Type filters now roll up under collapsible category names.
- Category filters now hide or show every marker in that category.
- Type filters now hide or show only markers matching that marker type.
- Updated marker filtering logic in preparation for local storage.
- Kept marker status and confidence fields in add/edit workflows.

## v0.1.0
- Initial project structure
- Leaflet map using custom image overlay
- Modular JavaScript and CSS
- Sidebar layout
- Categories loaded from JSON
