# RedM Explorer

## v1.3.69 Hidden Locations and Shady Dealer
- Added Hidden with individually selectable/filterable Stable and Wardrobe types, plus alphabetized Shady Dealer under NPCs.
- Added hitching-post, wardrobe, and shady-dealer SVG icons in the existing 24×24 brown/gold style. Existing stable, Fence, and General NPC icons are unchanged.
- Reused shared marker forms, filters, search, persistence, exports, multi-server storage, and archives. No authentication, rules, or production-data changes.

## v1.3.68 Share Missing Ranch Profile
- Repair browser-only Ranch Roleplay profile registration on owner sign-in so fresh browsers can discover the default server.
- Use a create-if-missing transaction with the original ID; preserve existing cloud lifecycle metadata and all marker datasets. Report publication failures in account status.

## v1.3.67 Ranch Roleplay Landing Server
- Open on the existing active Ranch Roleplay profile instead of the browser’s last selection. Discover its original ID through the shared server registry for new visitors.
- Preserve deliberate server switches and archive restore reloads using a one-time tab-local target. No marker data is moved or copied.

## v1.3.66 NPC Filter Ordering and Horse/Carriage Seller
- Moved NPCs to the top of the category filters while preserving the remaining category order.
- Added Horse/Carriage Seller to the alphabetized NPC types using the existing stable icon and shared marker tools.

## v1.3.65 Server-specific Character Filters
- Show the Jim/Tom quick filter only on RosalitaRP, which still defaults to Tom. Other servers ignore character filters, including older saved selections.
- Preserve all existing marker character assignments and server datasets.

## v1.3.64 Collapsible Sidebar Management
- Rolled account management and server controls into compact disclosures, collapsed by default and remembering each browser’s open/closed preference.
- Kept the account role and active server visible in the collapsed headings. Existing controls and permissions are unchanged.

## v1.3.63 Owner and Global Editors
- Added Google sign-in, owner-only server/editor management, and approved editor access across all active servers. Visitors retain viewing and export access.
- Added Firestore rules for legacy and server-scoped markers, global editor grants, and archived-server write protection. Rules require a separate Firebase Console deployment.
- Added an explicit local-marker cloud sync retry that retains cloud-only markers and pending local backups on failure.
- Preserved marker collections, IDs, saved data, and older exports.

## v1.3.62 Local HTTP Preview
- Added Start Local Explorer.cmd and a dependency-free, localhost-only HTTP server so local testing can load category JSON without file-URL browser restrictions.
- Show specific launcher instructions when startup fails under file://.
- Updated application/cache references to v1.3.62. Existing marker storage is unchanged.
## v1.3.61 RedM Explorer Branding
- Renamed the application heading, browser title, logo text, and web manifest to RedM Explorer. The selected server remains identified separately.
- Kept existing server names, storage paths, and backup format identifiers unchanged for compatibility.
- Updated application and cache references to v1.3.61.

## v1.3.60 Startup UI Availability
- Initialize the title, server selector, and management actions before awaiting Firebase reads, and run startup after the management dialog markup exists.
- Bound profile and initial marker reads with timeouts so stalled Firebase falls back to browser-local data instead of leaving the header blank and management button inactive.
- Updated application and cache references to v1.3.60; added stalled/denied/connected Firebase browser coverage.

## v1.3.59 Server Archiving and Preservation
- Added confirmed metadata-only archive/reactivation and a Server Management interface for active and archived profiles. Archived profiles are hidden from the active selector but remain viewable.
- Added Archived / Read Only controls and mutation guards for markers, imports, survey decisions/promotion, local caches, and Firestore writes. Filters, search, navigation, and exports remain available.
- Added versioned complete server archives with raw markers/custom fields, profile metadata, character definitions, survey data/decisions, and server settings. Validated same-server restoration requires confirmation and saves recovery/staged archives first.
- Kept RosalitaRP on its original `/markers` collection and localStorage keys; no production data migration or Firebase security deployment.
- Updated application/cache versions to v1.3.59 and added archive lifecycle, read-only, restoration, and validation regression tests.

## v1.3.58 Server Profiles
- Added server selection, creation, and renaming; remember the last server and share profile metadata through Firestore when available.
- Kept RosalitaRP on its original collection and storage keys without destructive migration. New servers use independent Firestore/localStorage namespaces and start empty.
- Scoped marker operations, filters, add-marker defaults, and Candidate Survey decisions to the server; the bundled survey remains RosalitaRP-only.
- Added server-labelled backups, legacy RosalitaRP backup compatibility, and source/destination confirmation before imports.
- Serialized saves, protected offline edits from stale snapshots, and wait for pending saves before switching while restoring map position.
- Updated application/cache versions to v1.3.58; added isolation and delayed-write regression tests and storage documentation.

## v1.3.57 Distinct NPC Icons
- Added gold-and-brown SVG icons for Fence (handshake), General Store (awning storefront), General NPC (Western-hat silhouette), and Job - House Robberies (house).
- Assigned each existing NPC type its own icon group, preserving saved type identifiers and the Importer's original shopping-bag icon. Marker dimensions and anchors are unchanged.
- Updated application and cache-busting references to v1.3.57 with older backup support retained.

## v1.3.56 Default to Tom
- Open the map on Tom's character view for new and returning visitors, regardless of the previous character selection. Other saved filters are retained.
- Resetting filters returns to Tom; Jim and All Characters remain available for manual selection during the session.
- New markers inherit Tom when using the default view. Existing character assignments are unchanged.
- Updated application and cache-busting references to v1.3.56.

## v1.3.55 Character Filter Refresh
- Routed character changes through the marker-manager filter setter and included character selection in saved-filter migration.
- Refreshed all application asset versions to prevent cached scripts from dropping character selection during control refreshes.

## v1.3.54 Character Knowledge and House Robberies
- Added Job - House Robberies to NPC types using the existing merchant icon.
- Added Known by (Jim, Tom, or both) to marker creation/editing and popups, with a saved Character filter that also limits search results.
- New markers default to the selected character; existing markers without a character assignment belong to Tom. Explicit Jim/Tom/shared assignments are preserved in storage and backup import/export.
- Updated application and cache-busting references to v1.3.54, retaining older backup support.

## v1.3.53 Additional Crafting Benches
- Added Still, Morphine, Poppy Processing, and Cocaine to Crafting Benches with individual type filters and the existing marker creation/editing, search, and storage/import/export behavior.
- Added transparent 24-by-24 SVG icons: copper still, medicine bottle, poppy flower, and laboratory flask.
- Preserved existing bench types and older import versions; updated application and cache-busting references to v1.3.53.

## v1.3.52 Complete Orchid Types
- Added the 12 missing orchid varieties under Herbs using the existing Flowers icon and standard marker controls, filters, search, and storage.
- Preserved Lady's Slipper Orchid and its saved identifier; added Lady Slipper search support and orchid naming aliases for imports and saved filters.
- Updated application and cache-busting references to v1.3.52 while retaining older import support.

## v1.3.51 Silver and Platinum Mining
- Added Silver and Platinum to the existing Mining resource catalog, including marker creation/editing, filters, search, and storage/import/export.
- Added distinct silver and platinum ingot SVG icons using the existing transparent 24-by-24 icon format.
- Preserved existing Mining types and older import versions; updated application and cache-busting references to v1.3.51.

## v1.3.50 Fence NPC
- Added Fence to NPC types using the existing merchant icon, marker forms, filters, and storage.
- Updated application and cache-busting references to v1.3.50.

## v1.3.49 Abandoned Wagons
- Replaced corrupted Add Marker and import dialog close-button text with an encoding-safe close symbol and accessible labels.
- Fixed Animal Group visibility in add/edit forms so it only appears for Animals.
- Added Abandoned Wagons through the existing category, type, and marker system, including filtering, editing, persistence, and import/export.
- Added a covered-wagon SVG with dashed amber Unknown and solid green Found markers. Found confirms a permanent spawn location, not current wagon availability.
- Limited wagon status choices to Unknown and Found; existing category statuses and older import versions remain supported.
- Updated application and cache-busting references to v1.3.49.

## v1.3.48 Animal Category Startup Compatibility
- Restored a compatibility type catalog for stale `dangerous-animals` requests so cached browsers do not stall on the Filters loading state.
- Hardened type loading so old `dangerous-animals` category requests resolve to the new `animals` catalog.
- Updated cache-busting references through v1.3.48.

## v1.3.47 Animals Category
- Renamed the Dangerous Animals category to Animals and migrated the category ID from `dangerous-animals` to `animals`.
- Reorganized animal types into Dangerous and Wildlife groups, preserving Bear, Wolf, Cougar, Panther, Alligator, and Snake as dangerous types.
- Added Boar and Goat as initial Wildlife types without adding small-game or livestock-only entries.
- Kept Danger Radius available only for Animals in the Dangerous group, with old imports and saved filters migrating to the new category.

## v1.3.46 Harrietum Officinalis Correction
- Confirmed the Herb catalog uses `Harrietum Officinalis` with type ID `harrietum-officinalis`.
- Added safe marker/type aliases so old saved or imported Harrietum spelling variants migrate to the corrected type/name.
- Extended supported import versions through v1.3.46 and updated cache-busting references.

## v1.3.45 Herb Catalog Order
- Sorted the Herb type catalog alphabetically by display name.
- Updated cache-busting references so browsers reload the corrected Herb order.

## v1.3.44 Browser Compatibility Fix
- Replaced `String.replaceAll()` usage in marker/type escaping helpers with broadly compatible regular-expression replacements.
- Prevented older or stricter browsers from failing during filter and marker rendering.

## v1.3.43 Startup Resilience
- Made Possible Locations initialization non-blocking so normal filters and markers render even if the survey layer has a browser-specific failure.
- Rendered normal markers before loading the Possible Locations layer.

## v1.3.42 Catalog Cache Fix
- Added app-version cache busting to category, type group, and type catalog JSON requests.
- Ensured browsers reload fresh Herb catalog data after adding new types.

## v1.3.41 Harrietum Officinalis
- Added Harrietum Officinalis to the Herb type catalog with the `flowers` group.
- Left Uses empty until Rosalita-specific usage is confirmed.
- Kept existing markers, Firebase data, and automatic marker creation unchanged.

## v1.3.40 Possible Locations Survey Layer
- Promoted the reviewed Candidate Survey preview into the production Possible Locations dataset with a timestamped backup.
- Simplified blue survey markers to mean approximate field-survey locations rather than precise Rosalita spawn points.
- Replaced candidate classification/review filters with a compact Suggested Herb filter, local Remove Survey Point workflow, Restore Removed Locations, and simple progress counts.
- Kept normal Explorer markers, Firebase sync, normal search, exports, statistics, state zones, and coordinate calibration behavior unchanged.

## v1.3.34 Remember Found By
- Added browser-local persistence for the last non-empty Item Discovery Found By value.
- Reused the Add Marker preferences localStorage object that already stores remembered Status and Confidence.
- Kept blank Found By saves from clearing the remembered browser preference.

## v1.3.33 Sea of Coronado Calibration Points
- Added three verified Sea of Coronado shore calibration points to the world-map calibration dataset.
- Regenerated and stored the quadratic production coefficients from the expanded 20-point dataset.
- Kept existing markers, marker placement workflow, storage, Firebase sync, and import/export behavior unchanged.

## v1.3.32 Calibration Dataset Refactor
- Moved world-map calibration points into `data/calibration/world-map-calibration.json`.
- Updated calibration regeneration and verification helpers to load the JSON dataset while keeping runtime placement on stored coefficients.
- Added dataset warnings for duplicate IDs, duplicate coordinates, unverified points, high residuals, and invalid coefficients.

## v1.3.31 Seventeen-Point Quadratic Calibration
- Updated world-vector placement to use the seventeen-point quadratic calibration constants.
- Expanded calibration regeneration and verification helpers with residual summaries, coefficient tolerance checks, and copy/paste-ready constants.
- Kept vector parsing, marker storage, existing markers, Firebase sync, and manual marker adjustment behavior unchanged.

## v1.3.30 Quadratic World Calibration
- Replaced the seven-point affine world-to-map transform with a fourteen-point second-order polynomial calibration.
- Added development helpers to regenerate quadratic coefficients, report residuals, and warn on out-of-range calibration errors.
- Kept vector parsing, clipboard workflow, marker storage, existing markers, and manual adjustment behavior unchanged.

## v1.3.29 Seven-Point World Calibration
- Replaced the initial four-point world-to-map affine calibration with a seven-point transform.
- Added a read-only calibration report helper for expected coordinates, calculated coordinates, and error distances.
- Kept vector parsing, clipboard workflow, marker storage, and manual adjustment behavior unchanged.

## v1.3.28 Add Marker Layout Correction
- Restored the main marker Notes field to its normal template location and height.
- Moved the full Game Vector workflow into the Add Marker Category Details section.
- Kept Add Marker Save/Cancel directly below the Game Vector controls without duplicating action buttons.
- Kept Item Discovery and Location below Category Details so in-game vector entry can be completed before scrolling further.

## v1.3.27 Add Marker Quick Entry Layout
- Moved Add Marker Save/Cancel below the Game Vector controls for faster in-game entry.
- Relocated the generated Notes field above Game Vector and reduced Notes height.
- Kept marker data, storage, coordinate conversion, and validation behavior unchanged.

## v1.3.26 World Vector Conversion
- Added initial world-vector-to-map coordinate conversion from four verified calibration points.
- Added Paste & Calculate and Use Current Map Position controls to the Add Marker Game Vector section.
- Added a draggable pending marker preview so calculated positions can be fine-adjusted before saving.

## v1.3.25 Game Vector Field
- Added a pasteable Game Vector field to Add Marker and Selected Marker edit flows.
- Added reusable parsing for comma-separated, parenthesized, bracketed, `vector3(...)`, and `vec3(...)` world coordinates.
- Preserved valid `worldPosition` data through storage, Firebase sync, import, and export while leaving map coordinates unchanged.

## v1.3.24 Collapsible Filter Header
- Made Quick Filters and Map Layers collapsed by default with compact status summaries.
- Removed the separate Active Filters block and kept Clear All Filters with the category controls.
- Reclaimed vertical space for the Categories and Types list without changing filter logic.

## v1.3.23 Filter UI Phase 2
- Added compact Quick Filters for State, Status, Confidence, and Uses using the unified filter state model.
- Moved the State Zones toggle into a Map Layers section and added an Active Filters summary with Clear All Filters.
- Replaced All On / All Off with Clear Category Filters while preserving category/type checkbox behavior and saved filter persistence.

## v1.3.22 Unified Filter State
- Added an internal unified filter state model for State, Status, Confidence, Uses, Category, and Type filters.
- Refactored existing category/type visibility checks to use the unified filter object while preserving the current UI.
- Added future filter helper functions and migrated saved filter state without wiping existing category/type settings.

## v1.3.21 Herb Shared Knowledge Sync
- Added automatic syncing of shared Herb knowledge across markers with the same Herb type.
- Shared Herb fields include Uses, Item Category, Item Use, Vendor Value, Crafting Uses, and Item Notes.
- Kept location-specific marker fields such as coordinates, state, status, confidence, found-by/date, yield, and notes per marker.

## v1.3.20 Remove Rarity
- Removed the Rarity field from Item Discovery because it does not exist in-game.
- Removed Rarity from active item-discovery storage fields and search indexing.

## v1.3.19 Flexible Uses System
- Replaced the Herb Sub-category template field with a reusable multi-select Uses checkbox list.
- Added data-driven Uses options and top-level marker `uses` array persistence for future categories.
- Added migration from legacy Herb Sub-category values into Uses and included Uses in search/import/export.

## v1.3.18 Add Marker Workflow Polish
- Remembered the last Add Marker Status and Confidence in browser-local preferences only.
- Moved Add Marker Save/Cancel controls above Item Discovery for faster marker entry.
- Removed the duplicate Item Discovery Item Name controls and defaulted Date Found to the current local date for new markers.

## v1.3.17 Permanent State Zone Data
- Merged the adjusted browser-saved State Zone polygons into `data/state-zones.json`.
- Removed the temporary zone export helper and stopped relying on browser-local State Zone overrides.
- Made the committed zone data the single source of truth for local and deployed versions.

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
