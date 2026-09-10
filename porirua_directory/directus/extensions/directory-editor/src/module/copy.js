/** Keep aligned with porirua_directory/editor-core/queue-dto.mjs — the image build cannot import that file. */

export function actionSuccessMessage({ action, kind, unpublished = true, name } = {}) {
  const who = String(name || "").trim();
  const publishNext = unpublished ? " It stays unpublished until you publish." : "";
  if (action === "publish") return "Published. The public site is up to date.";
  if (action === "undo-publish") {
    return "Publish undone. Those changes are unpublished again.";
  }
  if (action === "defer") {
    return who
      ? `Needs confirmation. ${who} is waiting on the Needs confirmation tab.`
      : "Needs confirmation. It's waiting on the Needs confirmation tab.";
  }
  if (action === "keep-community") {
    return who
      ? `Kept ${who} as a community listing. Next week's government feed will not take it off.`
      : "Kept. This is now a community listing. Next week's government feed will not take it off.";
  }
  if (action === "keep") {
    return who
      ? `Kept your details on ${who}. They stay as you set them.`
      : "Kept your details. They stay as you set them.";
  }
  if (action === "restore") {
    return who ? `Put ${who} back on the site.${publishNext}` : `Put back on the site.${publishNext}`;
  }
  if (action === "archive") {
    return who
      ? `Took ${who} off the site. It will leave the public site when you publish.`
      : "Taken off the site. It will leave the public site when you publish.";
  }
  if (action === "save") return who ? `Saved ${who}.${publishNext}` : `Saved.${publishNext}`;
  if (action === "reject") {
    if (kind === "new") {
      return who
        ? `Rejected ${who}. It will not go on the public site.`
        : "Rejected. It will not go on the public site.";
    }
    if (kind === "geocode_flag") {
      return who
        ? `Skipped the pin check for ${who}. The listing stays as it is.`
        : "Pin check skipped. The listing stays as it is.";
    }
    return who
      ? `Rejected the change to ${who}. The listing stays as it is.`
      : "Rejected. The listing stays as it is.";
  }
  if (kind === "removed") {
    return who
      ? `Took ${who} off the site. It will leave the public site when you publish.`
      : "Taken off the site. It will leave the public site when you publish.";
  }
  if (kind === "geocode_flag") {
    return who ? `Kept the pin for ${who}.${publishNext}` : `Pin kept.${publishNext}`;
  }
  if (kind === "new") return who ? `Added ${who}.${publishNext}` : `Added.${publishNext}`;
  return who ? `Accepted ${who}.${publishNext}` : `Accepted.${publishNext}`;
}

export function finishedDecisionLabel({ action, kind, status } = {}) {
  const resolved = action || (status === "rejected" ? "reject" : "approve");
  if (resolved === "keep") return "Kept yours";
  if (resolved === "keep-community") return "Kept it as a community listing";
  if (resolved === "hide" || (resolved === "approve" && kind === "removed")) {
    return "Took it off the site";
  }
  if (resolved === "reject") {
    if (kind === "new") return "Didn't add this";
    if (kind === "geocode_flag") return "Skipped this pin check";
    return "Didn't use this change";
  }
  if (kind === "new") return "Added this service";
  if (kind === "geocode_flag") return "The pin is fine";
  return "Accepted this change";
}

export function reviewCountLabel(count) {
  const n = Number(count) || 0;
  if (n === 0) return "Nothing to review";
  return n === 1 ? "1 change to review" : `${n} changes to review`;
}

export function reviewActiveCount(items = []) {
  return items.filter((item) => !item.deferred).length;
}

export function reviewStatusBandLabel(items = []) {
  const active = reviewActiveCount(items);
  const deferred = items.filter((item) => item.deferred).length;
  if (active === 0 && deferred > 0) return needConfirmationOnlyTitle(deferred);
  return reviewCountLabel(active);
}

export function waitingCountLabel(count) {
  const n = Number(count) || 0;
  if (n === 0) return "All published";
  return n === 1 ? "1 unpublished" : `${n} unpublished`;
}

export function reviewFinishedLabel(count) {
  const n = Number(count) || 0;
  if (n === 1) return "You've reviewed everything. Put 1 change on the public site.";
  return `You've reviewed everything. Put ${n} changes on the public site.`;
}

export function reviewDeferredFinishLabel(count) {
  const n = Number(count) || 0;
  return n === 1
    ? "You've decided the ones you can. 1 needs confirmation."
    : `You've decided the ones you can. ${n} need confirmation.`;
}

export function needsConfirmationGroupLabel(count) {
  const n = Number(count) || 0;
  return n === 1 ? "Needs confirmation (1)" : `Needs confirmation (${n})`;
}

export function needsConfirmationTabLabel(count) {
  const n = Number(count) || 0;
  return n ? needsConfirmationGroupLabel(n) : "Needs confirmation";
}

function foldLabel(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function queueLineLabel({ name, lineTitle } = {}) {
  const org = String(name || "").trim();
  const line = String(lineTitle || "").trim();
  if (!line) return "";
  if (foldLabel(line) === foldLabel(org)) return "";
  return line;
}

export function queueItemHeading(item, fallback = "this listing") {
  const name = item?.name || fallback;
  return item?.lineLabel ? `${name} — ${item.lineLabel}` : name;
}

export function correctHeading(item) {
  const who = queueItemHeading(item);
  if (item?.kind === "geocode_flag") return `Moving the pin for ${who}`;
  return `Correcting ${who}`;
}

export function landingTab({ activeCount = 0, deferredCount = 0 } = {}) {
  if (activeCount > 0) return "review";
  if (deferredCount > 0) return "needs";
  return "listings";
}

export function needConfirmationOnlyTitle(count) {
  const n = Number(count) || 0;
  return n === 1 ? "1 needs confirmation" : `${n} need confirmation`;
}

export function foldSearch(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
