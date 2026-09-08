/**
 * Keep aligned with editor-core/catalog-publisher.mjs — the Directus image
 * build cannot import that file.
 */
export const CATALOG_PUBLISHER_DIRECTUS = "directus";
export const CATALOG_PUBLISHER_PAYLOAD = "payload";
export const DEFAULT_CATALOG_PUBLISHER = CATALOG_PUBLISHER_DIRECTUS;

export const PUBLISH_MUTATION_PATHS = ["/publish", "/undo-publish"];

export function resolveCatalogPublisher(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === CATALOG_PUBLISHER_PAYLOAD ? CATALOG_PUBLISHER_PAYLOAD : CATALOG_PUBLISHER_DIRECTUS;
}

export function catalogPublisherFromEnv(env = {}) {
  return resolveCatalogPublisher(env.CATALOG_PUBLISHER ?? process.env.CATALOG_PUBLISHER);
}

export function thisHostCanPublish(thisHost, publisher) {
  return resolveCatalogPublisher(thisHost) === resolveCatalogPublisher(publisher);
}

export function isPublishMutationPath(path) {
  const raw = String(path || "");
  const trimmed = raw.startsWith("/") ? raw : `/${raw}`;
  const pathname = trimmed.length > 1 && trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  return PUBLISH_MUTATION_PATHS.includes(pathname);
}

export function publishHostForbiddenMessage(publisher) {
  const host =
    resolveCatalogPublisher(publisher) === CATALOG_PUBLISHER_PAYLOAD
      ? "admin-payload-directory-dev.bsky.nz"
      : "admin-directory-dev.bsky.nz";
  return `This admin host cannot publish the catalog. Publish from ${host}.`;
}
