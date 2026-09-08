export const DEFAULT_DIRECTORY_EDITOR_BASE = "/directory-editor";

function normalizeBase(base) {
  const raw =
    typeof base === "object" && base
      ? base.base
      : base;
  const value = String(raw ?? DEFAULT_DIRECTORY_EDITOR_BASE).trim();
  const stripped = value.replace(/\/$/, "");
  return stripped || DEFAULT_DIRECTORY_EDITOR_BASE;
}

export function directoryEditorUrl(path, base) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeBase(base)}${suffix}`;
}

export async function directoryEditorFetch(
  path,
  { method = "GET", body, headers, base, fetchImpl = fetch } = {}
) {
  const response = await fetchImpl(directoryEditorUrl(path, base), {
    method,
    credentials: "same-origin",
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    const error = new Error(data?.error || `Directory editor ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
