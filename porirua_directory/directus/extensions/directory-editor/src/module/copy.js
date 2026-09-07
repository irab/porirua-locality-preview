/** Keep aligned with porirua_directory/editor-core/queue-dto.mjs — the image build cannot import that file. */

export function actionSuccessMessage({ action, kind, unpublished = true } = {}) {
  const publishNext = unpublished ? " It will go on the public site when you publish." : "";
  if (action === "publish") return "Published. The public site is up to date.";
  if (action === "keep") return `Kept your details.${publishNext}`;
  if (action === "restore") return `Put back on the site.${publishNext}`;
  if (action === "archive") return "Taken off the site. It will leave the public site when you publish.";
  if (action === "save") return `Saved.${publishNext}`;
  if (action === "reject") {
    if (kind === "new") return "Not added. It will not go on the public site.";
    if (kind === "geocode_flag") return "Pin check skipped. The listing stays as it is.";
    return "Change declined. The listing stays as it is.";
  }
  if (kind === "removed") return "Taken off the site. It will leave the public site when you publish.";
  if (kind === "geocode_flag") return `Pin kept.${publishNext}`;
  if (kind === "new") return `Added.${publishNext}`;
  return `Accepted.${publishNext}`;
}

export function reviewCountLabel(count) {
  const n = Number(count) || 0;
  return n === 1 ? "1 change to review" : `${n} changes to review`;
}

export function reviewFinishedLabel(count) {
  const n = Number(count) || 0;
  if (n === 1) return "You've reviewed everything. Put 1 change on the public site.";
  return `You've reviewed everything. Put ${n} changes on the public site.`;
}

export function foldSearch(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
