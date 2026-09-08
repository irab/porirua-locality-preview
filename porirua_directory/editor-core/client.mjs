export function directoryEditorUrl(path) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `/directory-editor${suffix}`;
}

export async function directoryEditorFetch(path, { method = "GET", body, headers } = {}) {
  const response = await fetch(directoryEditorUrl(path), {
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
