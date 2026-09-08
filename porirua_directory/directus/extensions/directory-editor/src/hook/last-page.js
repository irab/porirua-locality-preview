export const EDITOR_LANDING_PAGE = "/directory";

export function isEditorLandingPage(path) {
  return path === EDITOR_LANDING_PAGE || String(path).startsWith(`${EDITOR_LANDING_PAGE}/`);
}

/** Persist only a page the Editor module can show. `/content` is hidden and becomes Page Not Found. */
export function clampEditorLastPage(path) {
  return isEditorLandingPage(path) ? path : EDITOR_LANDING_PAGE;
}
