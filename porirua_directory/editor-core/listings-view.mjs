import { foldSearch, statusLabel } from "./queue-dto.mjs";

export const LISTINGS_COPY = {
  find: "Find an organisation",
  addOrganisation: "Add organisation",
  addServiceLine: "Add a service line",
  editOrganisation: "Edit organisation",
  edit: "Edit",
  archive: "Archive this service line",
  restore: "Put it back on the site",
  showNotOnSite: "Show listings that are not on the site",
  loading: "Loading organisations…",
  noMatches: "No organisation matches that name.",
  loadError: "Could not load listings.",
  openError: "Could not open that listing.",
  tryAgain: "Try again",
  back: "Back",
  archiveTitle: "Take this service off the public site?",
  archiveBody: "People will not see this service after you publish.",
  archiveOnlyPublic: "This is the only public service. Also take the organisation off the site?",
  takeService: "Take this service off the site",
  takeOrg: "Take the organisation off too",
  cancel: "Cancel",
  nameConflict: "Open the existing one, or Create anyway.",
};

export function emptyListingForm() {
  return {
    name: "",
    description: "",
    address: "",
    phone: "",
    url: "",
    lat: null,
    lng: null,
    categories: [],
    communityFilters: [],
  };
}

export function visibleListings(listings = [], { query = "", showNotOnSite = false } = {}) {
  const needle = foldSearch(query);
  return listings
    .filter((row) => (showNotOnSite ? true : row.status === "published"))
    .filter((row) => !needle || foldSearch(row.name).includes(needle))
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "en", { sensitivity: "base" }));
}

export function listingFormFromOrganization(org = {}) {
  return {
    ...emptyListingForm(),
    name: org.name || "",
    description: org.description || "",
    address: org.address || "",
    phone: org.phone || "",
    url: org.url || "",
    lat: org.lat ?? null,
    lng: org.lng ?? null,
    communityFilters: org.community_filters || org.communityFilters || [],
  };
}

export function listingFormFromServiceLine(line = {}, org = {}) {
  return {
    name: line.title || line.service_name || org.name || "",
    description: line.description || "",
    address: line.address || org.address || "",
    phone: line.phone || org.phone || "",
    url: line.url || org.url || "",
    lat: line.lat ?? org.lat ?? null,
    lng: line.lng ?? org.lng ?? null,
    categories: Array.isArray(line.categories) ? line.categories : [],
    communityFilters: org.community_filters || org.communityFilters || [],
  };
}

export function listingFormHighlight(youSetThis = []) {
  return {
    changed: [],
    youSetThis: Array.isArray(youSetThis) ? youSetThis : [],
    focusField: null,
    focusOption: null,
  };
}

export function archiveDialogModel(services = []) {
  const published = services.filter((row) => row.status === "published");
  return { onlyPublicLine: published.length <= 1 };
}

export function listingPin(source = {}) {
  if (source?.lat == null || source?.lng == null) return null;
  const lat = Number(source.lat);
  const lng = Number(source.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function listingVerificationSource(detail) {
  const org = detail?.organization || {};
  const lines = Array.isArray(detail?.services) ? detail.services : [];
  const withUrl = lines.find((line) => line.url) || {};
  const withPin = lines.find((line) => listingPin(line)) || {};
  return {
    listingUrl: org.url || withUrl.url || "",
    phone: org.phone || lines[0]?.phone || "",
    address: org.address || lines[0]?.address || "",
    pin: listingPin(org) || listingPin(withPin),
  };
}

export function listingFormTitle(kind) {
  if (kind === "serviceLine") return LISTINGS_COPY.addServiceLine;
  if (kind === "edit") return "Edit listing";
  return LISTINGS_COPY.addOrganisation;
}

export function nameMatchesPath(name, { formKind, organizationId } = {}) {
  const query = `name=${encodeURIComponent(name)}`;
  if (formKind === "serviceLine" && organizationId) {
    return `/listings/name-matches?${query}&organizationId=${encodeURIComponent(organizationId)}`;
  }
  return `/listings/name-matches?${query}`;
}

export function existingListingId(match) {
  return match?.organizationId || match?.id || "";
}

export function createListingBody(form, { kind = "organization", organizationId, confirmCreateAnyway = false } = {}) {
  const body = {
    name: form.name,
    description: form.description,
    address: form.address,
    phone: form.phone,
    url: form.url,
    lat: form.lat,
    lng: form.lng,
    categories: form.categories,
    communityFilters: form.communityFilters,
    confirmCreateAnyway: confirmCreateAnyway === true,
  };
  if (kind === "serviceLine") {
    body.kind = "serviceLine";
    body.organizationId = organizationId;
    body.title = form.name;
  }
  return body;
}

export function updateListingBody(form, { organizationId, serviceId } = {}) {
  if (serviceId) {
    return {
      organizationId,
      serviceId,
      payload: {
        title: form.name,
        serviceName: form.name,
        description: form.description,
        address: form.address,
        phone: form.phone,
        url: form.url,
        lat: form.lat,
        lng: form.lng,
        categories: form.categories,
        communityFilters: form.communityFilters,
      },
    };
  }
  return {
    organizationId,
    payload: {
      name: form.name,
      description: form.description,
      address: form.address,
      phone: form.phone,
      url: form.url,
      lat: form.lat,
      lng: form.lng,
      communityFilters: form.communityFilters,
    },
  };
}

export function listingStatusLabel(status) {
  return statusLabel(status);
}
