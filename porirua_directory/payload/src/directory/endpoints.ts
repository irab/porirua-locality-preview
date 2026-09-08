import type { Endpoint, PayloadRequest } from "payload";
import {
  DIRECTORY_EDITOR_PROXIED_ROUTES,
  handleDirectoryEditorRequest,
  identityFromPayloadUser,
} from "../../../editor-core/operations-proxy.mjs";

async function directoryEditorHandler(req: PayloadRequest): Promise<Response> {
  const url = new URL(req.url);
  const prefix = "/api/directory-editor";
  const path = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) || "/" : url.pathname;
  const mutating = req.method !== "GET" && req.method !== "HEAD";
  let body: unknown;
  if (mutating) {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }
  const result = await handleDirectoryEditorRequest({
    method: req.method,
    path,
    search: url.search,
    body,
    identity: identityFromPayloadUser(req.user),
    operationsUrl: process.env.OPERATIONS_URL,
  });
  return Response.json(result.body, { status: result.status });
}

function endpointPath(routePath: string): string {
  return `/directory-editor${routePath}`;
}

export const directoryEditorEndpoints: Endpoint[] = [
  {
    path: "/directory-editor/health",
    method: "get",
    handler: directoryEditorHandler,
  },
  ...DIRECTORY_EDITOR_PROXIED_ROUTES.map((route) => ({
    path: endpointPath(route.path),
    method: route.method.toLowerCase() as Endpoint["method"],
    handler: directoryEditorHandler,
  })),
];
