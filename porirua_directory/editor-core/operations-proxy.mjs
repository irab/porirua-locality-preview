import { isEditorOrAdmin, unauthorizedError } from "./authorize.mjs";
import {
  CATALOG_PUBLISHER_PAYLOAD,
  annotatePublishStatus,
  catalogPublisherFromEnv,
  isPublishMutationPath,
  publishHostForbiddenMessage,
  thisHostCanPublish,
} from "./catalog-publisher.mjs";

export const DIRECTORY_EDITOR_PROXIED_ROUTES = [
  { method: "GET", path: "/listings/name-matches" },
  { method: "GET", path: "/listings" },
  { method: "GET", path: "/listings/:id" },
  { method: "GET", path: "/queue" },
  { method: "GET", path: "/publish-status" },
  { method: "GET", path: "/geocode" },
  { method: "POST", path: "/listings" },
  { method: "POST", path: "/listings/update" },
  { method: "POST", path: "/listings/archive" },
  { method: "POST", path: "/listings/restore" },
  { method: "POST", path: "/approve" },
  { method: "POST", path: "/keep-curation" },
  { method: "POST", path: "/hide" },
  { method: "POST", path: "/reject" },
  { method: "POST", path: "/edit-and-approve" },
  { method: "POST", path: "/defer" },
  { method: "POST", path: "/keep-community" },
  { method: "POST", path: "/review-undo" },
  { method: "POST", path: "/publish" },
  { method: "POST", path: "/undo-publish" },
];

function normalizePath(path) {
  const raw = String(path || "");
  const trimmed = raw.startsWith("/") ? raw : `/${raw}`;
  if (trimmed.length > 1 && trimmed.endsWith("/")) return trimmed.slice(0, -1);
  return trimmed || "/";
}

export function matchDirectoryEditorRoute(method, path) {
  const verb = String(method || "GET").toUpperCase();
  const pathname = normalizePath(path);
  if (pathname === "/health") return null;
  for (const route of DIRECTORY_EDITOR_PROXIED_ROUTES) {
    if (route.method !== verb) continue;
    if (route.path === pathname) return { ...route, sidecarPath: pathname };
    if (route.path === "/listings/:id") {
      const match = pathname.match(/^\/listings\/([^/]+)$/);
      if (match && match[1] !== "name-matches") {
        return { ...route, sidecarPath: `/listings/${match[1]}` };
      }
    }
  }
  return null;
}

export function identityFromPayloadUser(user) {
  if (!user?.id) return null;
  const role = String(user.role ?? user.roleName ?? "").trim();
  const lowered = role.toLowerCase();
  const admin = user.admin === true || lowered === "admin" || lowered === "administrator";
  return {
    userId: String(user.id),
    admin,
    roleName: admin ? "Administrator" : role,
  };
}

export function authorizeDirectoryRequest(identity) {
  if (!identity?.userId) {
    const error = new Error("Authentication required");
    error.status = 401;
    throw error;
  }
  if (!isEditorOrAdmin(identity)) {
    throw unauthorizedError();
  }
}

export function mergeActorIntoBody(body, userId) {
  const base = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  return {
    ...base,
    createdBy: userId,
    user: userId,
  };
}

function jsonResult(status, body) {
  return { status, body };
}

export async function handleDirectoryEditorRequest({
  method = "GET",
  path,
  search = "",
  body,
  identity,
  operationsUrl,
  fetchImpl = fetch,
  thisHost = CATALOG_PUBLISHER_PAYLOAD,
  catalogPublisher,
  env = process.env,
} = {}) {
  const pathname = normalizePath(path);
  if (String(method).toUpperCase() === "GET" && pathname === "/health") {
    return jsonResult(200, { ok: true });
  }

  try {
    authorizeDirectoryRequest(identity);
  } catch (error) {
    return jsonResult(error.status || error.statusCode || 403, { error: error.message });
  }

  const route = matchDirectoryEditorRoute(method, pathname);
  if (!route) {
    return jsonResult(404, { error: "Not found" });
  }

  const publisher = resolvePublisher(catalogPublisher, env);
  if (isPublishMutationPath(route.sidecarPath) && !thisHostCanPublish(thisHost, publisher)) {
    return jsonResult(403, { error: publishHostForbiddenMessage(publisher) });
  }

  const base = String(operationsUrl || "").replace(/\/$/, "");
  if (!base) {
    return jsonResult(500, { error: "OPERATIONS_URL is not configured" });
  }

  const verb = String(method).toUpperCase();
  const mutating = verb !== "GET" && verb !== "HEAD";
  const query = search && search.startsWith("?") ? search : search ? `?${search}` : "";
  const response = await fetchImpl(`${base}${route.sidecarPath}${query}`, {
    method: verb,
    headers: { "content-type": "application/json" },
    body: mutating ? JSON.stringify(mergeActorIntoBody(body, identity.userId)) : undefined,
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (route.sidecarPath === "/publish-status" && response.status === 200) {
    data = annotatePublishStatus(data, { thisHost, catalogPublisher: publisher });
  }
  return jsonResult(response.status, data);
}

function resolvePublisher(catalogPublisher, env) {
  return catalogPublisher != null && catalogPublisher !== ""
    ? catalogPublisherFromEnv({ CATALOG_PUBLISHER: catalogPublisher })
    : catalogPublisherFromEnv(env);
}
