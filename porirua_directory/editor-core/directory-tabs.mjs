import { needsConfirmationTabLabel } from "./queue-dto.mjs";

export const DIRECTORY_TAB_ORDER = ["needs", "review", "listings"];

export function directoryTabsModel({ deferredCount = 0, reviewCount = 0, listingsCount = 0 } = {}) {
  const review = Number(reviewCount) || 0;
  const listings = Number(listingsCount) || 0;
  return [
    { id: "needs", label: needsConfirmationTabLabel(deferredCount) },
    { id: "review", label: review ? `Review (${review})` : "Review" },
    { id: "listings", label: listings ? `Listings (${listings})` : "Listings" },
  ];
}
