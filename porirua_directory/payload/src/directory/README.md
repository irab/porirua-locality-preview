# Directory shells (Payload)

Listings, Review, and Publish import these instead of rebuilding them.

| Export | File | Job |
|--------|------|-----|
| `DirectoryHome` | `DirectoryHome.tsx` | First-login landing: status band + three tabs |
| `ListingsPanel` | `ListingsPanel.tsx` | Find → open → add/edit/archive. Calls listings routes only; Save does not Review or Publish |
| `StatusBand` | `StatusBand.tsx` | Persistent band, `role="status"`. Display from `/publish-status`. Pass `onPublish` / `onUndoPublish` when Publish wires them |
| `DirectoryTabs` | `DirectoryTabs.tsx` | Needs confirmation, Review, Listings — count in the label when non-zero |
| `VerificationBar` | `VerificationBar.tsx` | Website (new tab; omitted from the tab order when there is no URL), phone, address, map slot |
| `SharedListingForm` | `SharedListingForm.tsx` | Add organisation, add line, edit, Accept and edit. Prefill via `value`. Marks via `formHighlightFields` |

Copy, DTO, highlight, authorize, and the sidecar proxy stay in `porirua_directory/editor-core/`. Do not add `copy.js` here.

Chip lists: `helpTypeOptions()` / `communityGroupOptions()` from `editor-core/fields.mjs` (same closed lists as `listings.mjs`).

Client calls: `directoryEditorFetch(path, { base: "/api/directory-editor" })`.
