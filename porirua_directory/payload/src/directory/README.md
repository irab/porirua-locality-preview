# Directory shells (Payload)

Listings, Review, and Publish import these instead of rebuilding them.

| Export | File | Job |
|--------|------|-----|
| `DirectoryHome` | `DirectoryHome.tsx` | First-login landing: status band + three tabs |
| `ListingsPanel` | `ListingsPanel.tsx` | Find → open → add/edit/archive. Calls listings routes only; Save does not Review or Publish |
| `StatusBand` | `StatusBand.tsx` | Persistent band, `role="status"`. Counts from `/publish-status`. Publish/undo live in `editor-core/publish-view.mjs` |
| `DirectoryTabs` | `DirectoryTabs.tsx` | Needs confirmation, Review, Listings — count in the label when non-zero |
| `VerificationBar` | `VerificationBar.tsx` | Website (new tab; omitted from the tab order when there is no URL), phone, address, Now/Proposed pin |
| `PinMap` | `PinMap.tsx` | Leaflet + OpenStreetMap tiles. Read-only Now/Proposed in `VerificationBar`, draggable in `SharedListingForm`. Hides itself via `onTilesFailed` when tiles do not load |
| `SharedListingForm` | `SharedListingForm.tsx` | Add organisation, add line, edit, Accept and edit. Prefill via `value`. Marks via `formHighlightFields` |

Copy, DTO, highlight, authorize, and the sidecar proxy stay in `porirua_directory/editor-core/`. Do not add `copy.js` here.

Chip lists: `helpTypeOptions()` / `communityGroupOptions()` from `editor-core/fields.mjs` (same closed lists as `listings.mjs`).

Client calls: `directoryEditorFetch(path, { base: "/api/directory-editor" })`.

Class names in `directory.css` share a global namespace with Payload's own admin styles. Keep them prefixed (`directory-*`, `pin-map*`, `review-*`): a bare `.verify` inherited Payload's verify-email rule (`min-height: 100vh`) and stretched the verification bar into a blank screen-high gap.
