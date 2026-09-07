/**
 * Directus 11 injects an Axios instance (useApi / $api).
 * `$api.transport` is the old SDK and is undefined in 11.9 — using it
 * crash-loops every listings/queue refresh in the browser.
 */
export async function directoryEditorRequest(client, path, { method = "GET", body, params } = {}) {
  if (!client || typeof client.request !== "function") {
    throw new Error("Directory could not reach the API.");
  }
  const response = await client.request({
    method,
    url: `/directory-editor${path}`,
    data: body,
    params,
  });
  return response?.data ?? response?.raw ?? response;
}
