# RosalitaRP Explorer

## v1.3.16 Saved State Zone Restore
- Restored loading of previously saved State Zone polygon adjustments from browser storage after finalizing the editor.
- Kept the State Zone Editor removed while preserving saved zone alignment changes at runtime.

## v1.3.15 Finalized State Zones
- Removed the temporary State Zone Editor UI, editing controls, save/copy tools, and editor-only map handlers.
- Kept the Show State Zones overlay toggle and finalized polygon-based State lookup.
- Added a compact State filter dropdown that combines with category/type filters and search using `marker.state`.

## v1.3.14 State Override Support
- Added `stateAuto` and `stateOverride` marker fields so auto-detected State can be manually corrected.
- Added State dropdowns to marker add/edit flows with an Auto-detected helper for overridden markers.
- Updated marker movement and import backfill so manual State choices are preserved while coordinate-based State stays current.

## v1.3.13 State Zone Editor Alignment Tools
- Added Zone Editor modes for adding points, removing points, and moving an entire state zone.
- Add mode inserts points on the nearest polygon edge once a polygon exists.
- Move mode lets the selected zone polygon be dragged around the map for alignment.

## v1.3.12 State Zone Y-Axis Correction
- Flipped generated state-zone Y coordinates to match the app map coordinate system.
- Updated cache-busting references to v1.3.12 so corrected state zones load immediately.

## v1.3.11 Generated State Zone Polygons
- Replaced placeholder state zones with generated polygons traced from the supplied color-coded state map.
- Mapped red, purple, green, yellow, and blue regions to New Austin, West Elizabeth, Ambarino, New Hanover, and Lemoyne.
- Added cache-busting for `data/state-zones.json` and isolated old editor-saved placeholder overrides.

## v1.3.10 State Zone Editor Save
- Added a Save action to the temporary Zone Editor.
- Saved zone polygons persist in browser local storage and apply immediately to state lookup and overlays.
- Kept Copy available for moving finalized polygons into `data/state-zones.json`.

## v1.3.9 Temporary State Zone Editor
- Added a temporary Zone Editor panel for drawing state polygon points directly on the map.
- Added controls to load an existing state polygon, undo points, clear points, and copy generated polygon JSON.
- Kept marker, Firebase, storage, map rendering, and filter behavior separate from the editor workflow.

## v1.3.8 State Zone Support
- Added state-zone data support with placeholder polygons for New Austin, West Elizabeth, Ambarino, New Hanover, and Lemoyne.
- Added marker `state` persistence, coordinate-based state calculation, selected-marker state display, and state search support.
- Added a default-off Show State Zones overlay toggle and updated cache-busting references to v1.3.8.

## v1.3.7 Compact Selected Marker Placeholder
- Collapsed the empty Selected Marker panel into a compact one-row placeholder when no marker is selected.
- Preserved the full selected-marker edit form and actions when a marker is selected.
- Updated cache-busting references to v1.3.7.

## v1.3.6 Sidebar Workspace Optimization
- Kept the favicon-based header logo while tightening header spacing and forcing the application title onto one line.
- Compacted Statistics and footer/status sections to reclaim sidebar space for marker details and filters.
- Tightened the Filters toolbar spacing and updated cache-busting references to v1.3.6.

## v1.3.5 Header and Sidebar Spacing Polish
- Swapped the visible application header logo to the 96px favicon artwork and displayed it larger with contained scaling.
- Tightened header, search, and Filters section spacing while preserving the sidebar layout and western styling.
- Updated cache-busting references to v1.3.5.

## v1.3.4 Sidebar Polish
- Increased the Add Marker sidebar button height slightly so it stays compact without feeling cramped.
- Matched Selected Marker action buttons to the sidebar button typography with 15px text and 600 weight.
- Updated stylesheet and script cache-busting references to v1.3.4.

## v1.2.4 Item Discovery Tracking
- Added optional item-discovery fields to marker add/edit forms.
- Included discovery details in search, imports, exports, Firebase sync, and local browser storage.
- Kept older marker data compatible and kept empty discovery fields tucked away in the selected marker panel.

## v1.2.3 Marker Icon Rendering Fix
- Added SVG URL cache-busting so markers load the current icon artwork.
- Removed marker icon CSS filtering that could muddy icon colors.
- Resized marker SVG images for clearer 70-75% marker-circle coverage with proportional selected marker scaling.
- Preserved marker circle size, border colors, Firebase sync, JSON data, filters, search, and import/export behavior.

## v1.2.2 SVG Icon Contrast Fix
- Increased SVG icon contrast with bright parchment gold and dark brown explicit shape colors.
- Removed inherited SVG paint dependencies so icons stay readable inside circular map markers.
- Preserved SVG filenames, dimensions, transparent backgrounds, icon shapes, marker styling, data, and app behavior.

## v1.2.1 SVG Icon Visual Polish
- Polished all custom SVG icons with a consistent engraved brass/parchment palette.
- Normalized icon fill, stroke, and visual weight for better readability on parchment terrain, roads, rivers, and dark map regions.
- Preserved SVG filenames, dimensions, transparent backgrounds, marker sizes, marker borders, JSON data, and rendering behavior.

## v1.2.0
- Added Type Group icon metadata with SVG-based group icons.
- Updated type data to reference icon groups instead of storing icons per type.
- Replaced marker, sidebar, dialog, and search-result icons with shared Type Group SVGs.
- Preserved marker storage compatibility, imports, exports, filters, search, danger circles, context menus, and marker movement.

## v1.1.1
- Added Google Fonts import for Rye and Inter.
- Updated decorative headings, dialog titles, and the application title to use Rye.
- Updated normal interface text, controls, marker details, statistics, and footer text to use Inter.
- Preserved existing colors, spacing, layout, and sidebar behavior.

## v1.1.0
- Refined Add Marker and Selected Marker layouts with Basic Information, Category Details, and Location sections.
- Moved Status and Confidence into shared Basic Information controls.
- Added All On and All Off filter controls with preserved category/type filter behavior.
- Tightened sidebar filter spacing and added sticky filter/category headers.
- Added Oleander to Herb types.
- Added Dangerous Animals marker category with Bear, Wolf, Cougar, Panther, Alligator, and Snake types.
- Added subtle danger zone circles for Dangerous Animal markers with editable `dangerRadius`.
- Added default 50 map-unit danger radius for new and older Dangerous Animal markers.
- Added description metadata to Mining type data.
- Added resource-specific templates for Mining, Herbs, and Trees.
- Added nested `templateData` marker storage while preserving existing marker fields.
- Updated Mining markers with mine name, possible drops, and notes.
- Updated Mining template so marker Type defines the primary output.
- Renamed Mining type Gold Flakes to Gold and added Sulfur.
- Removed Mining excluded drops from the active template and migration output.
- Removed duplicated Type information from Fishing, Trees, NPCs, Crafting Bench, and defensive legacy template fields.
- Added safe Type migrations from old duplicated template fields where possible.
- Added Farming Supplies and Seed Seller NPC types.
- Updated Herb markers with subcategory, plant count, yield, and notes.
- Updated Tree markers with estimated count, required tool, and notes.
- Expanded search support to include `templateData` values.

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
