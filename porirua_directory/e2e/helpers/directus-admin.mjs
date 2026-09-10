import { ADMIN_ORIGIN, PUBLIC_ORIGIN, loadDevSecrets } from "./dev-env.mjs";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function asJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function loginDirectus(email, password) {
  const response = await fetch(`${ADMIN_ORIGIN}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": BROWSER_UA },
    body: JSON.stringify({ email, password }),
  });
  const data = asJson(await response.text());
  const token = data?.data?.access_token;
  if (!response.ok || !token) {
    throw new Error(`Directus login failed for ${email}: HTTP ${response.status}`);
  }
  return token;
}

export async function adminToken() {
  const { adminEmail, adminPassword } = loadDevSecrets();
  return loginDirectus(adminEmail, adminPassword);
}

export async function editorToken() {
  const { email, password } = loadDevSecrets();
  return loginDirectus(email, password);
}

export async function directusRequest(token, path, { method = "GET", body } = {}) {
  const response = await fetch(`${ADMIN_ORIGIN}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "user-agent": BROWSER_UA,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: asJson(await response.text()) };
}

export async function fetchPublicCatalog() {
  const response = await fetch(`${PUBLIC_ORIGIN}/api/catalog`, {
    headers: { accept: "application/json", "user-agent": BROWSER_UA },
    cache: "no-store",
  });
  const etag = response.headers.get("etag");
  const body = asJson(await response.text());
  return { status: response.status, etag, body };
}

export async function readCurrentSnapshot(token) {
  const result = await directusRequest(
    token,
    "/items/catalog_snapshots?filter[is_current][_eq]=true&fields=version,is_current,generated_at,published_by,counts&limit=1"
  );
  if (result.status !== 200 || !result.data?.data?.[0]) {
    throw new Error(`Could not read current catalog snapshot: HTTP ${result.status}`);
  }
  return result.data.data[0];
}

export async function readQueueItems(token, ids) {
  const params = new URLSearchParams({
    "filter[id][_in]": ids.join(","),
    fields: "id,status,change_summary,entity_id,kind,proposed",
    limit: String(ids.length),
  });
  const result = await directusRequest(token, `/items/review_queue_items?${params}`);
  if (result.status !== 200) {
    throw new Error(`Could not read review_queue_items: HTTP ${result.status}`);
  }
  return result.data.data ?? [];
}

export async function readServices(token, ids) {
  const params = new URLSearchParams({
    "filter[id][_in]": ids.join(","),
    fields: "id,title,address,phone,status,raw_import",
    limit: String(ids.length),
  });
  const result = await directusRequest(token, `/items/services?${params}`);
  if (result.status !== 200) {
    throw new Error(`Could not read services: HTTP ${result.status}`);
  }
  return result.data.data ?? [];
}

function assertThrowawayServiceId(id) {
  if (!String(id).startsWith("e2e-")) {
    throw new Error(`Refusing to seed or clean a non-throwaway service id: ${id}`);
  }
}

function assertThrowawayOrgId(id) {
  if (!String(id).startsWith("org-e2e-")) {
    throw new Error(`Refusing to seed or clean a non-throwaway organisation id: ${id}`);
  }
}

export async function seedReviewPair(token, stamp) {
  const orgId = `org-e2e-${stamp}`;
  const orgName = `E2E ${stamp} Org`;
  assertThrowawayOrgId(orgId);
  const lines = [
    {
      id: `e2e-${stamp}-a`,
      title: `E2E ${stamp} Line A`,
      after: {
        name: orgName,
        serviceName: `E2E ${stamp} Line A`,
        description: "Throwaway Playwright listing A",
        address: `9 New Street A ${stamp}`,
        phone: "04 900 0001",
        url: "https://e2e.example.test/a",
        lat: -41.133,
        lng: 174.84,
        categories: ["support"],
      },
    },
    {
      id: `e2e-${stamp}-b`,
      title: `E2E ${stamp} Line B`,
      after: {
        name: orgName,
        serviceName: `E2E ${stamp} Line B`,
        description: "Throwaway Playwright listing B",
        address: `9 New Street B ${stamp}`,
        phone: "04 900 0002",
        url: "https://e2e.example.test/b",
        lat: -41.134,
        lng: 174.841,
        categories: ["support"],
      },
    },
  ];
  for (const line of lines) assertThrowawayServiceId(line.id);

  const baseline = {
    name: orgName,
    serviceName: "",
    description: "Throwaway Playwright listing",
    phone: "04 111 0000",
    url: "https://e2e.example.test",
    address: "1 Old Street",
    lat: -41.13,
    lng: 174.84,
    categories: ["support"],
  };

  const org = await directusRequest(token, "/items/organizations", {
    method: "POST",
    body: {
      id: orgId,
      public_id: orgId,
      render_grain: "flat",
      name: orgName,
      cluster_key: stamp,
      status: "draft",
      source_primary: "fsd",
    },
  });
  if (org.status !== 200 && org.status !== 201) {
    throw new Error(`Seed organization failed: HTTP ${org.status}`);
  }

  for (const line of lines) {
    const service = await directusRequest(token, "/items/services", {
      method: "POST",
      body: {
        id: line.id,
        organization_id: orgId,
        line_id: line.id,
        title: line.title,
        status: "pending_review",
        source: "fsd",
        address: baseline.address,
        phone: baseline.phone,
        raw_import: { ...baseline, serviceName: line.title },
      },
    });
    if (service.status !== 200 && service.status !== 201) {
      throw new Error(`Seed service ${line.id} failed: HTTP ${service.status}`);
    }
    const createdId = service.data?.data?.id ?? line.id;
    assertThrowawayServiceId(createdId);
    if (createdId !== line.id) {
      throw new Error(`Directus assigned ${createdId} instead of throwaway id ${line.id}`);
    }
  }

  const run = await directusRequest(token, "/items/import_runs", {
    method: "POST",
    body: { source: "e2e", status: "success", notes: `playwright ${stamp}` },
  });
  if ((run.status !== 200 && run.status !== 201) || !run.data?.data?.id) {
    throw new Error(`Seed import_run failed: HTTP ${run.status}`);
  }
  const runId = run.data.data.id;

  const queueItems = [];
  for (const line of lines) {
    const queued = await directusRequest(token, "/items/review_queue_items", {
      method: "POST",
      body: {
        import_run_id: runId,
        entity_type: "service",
        entity_id: line.id,
        kind: "changed",
        proposed: {
          before: { address: baseline.address, phone: baseline.phone },
          after: line.after,
        },
        status: "pending",
      },
    });
    if ((queued.status !== 200 && queued.status !== 201) || !queued.data?.data?.id) {
      throw new Error(`Seed queue item for ${line.id} failed: HTTP ${queued.status}`);
    }
    if (queued.data.data.entity_id !== line.id) {
      throw new Error(
        `Queue item ${queued.data.data.id} pointed at ${queued.data.data.entity_id}, not ${line.id}`
      );
    }
    queueItems.push({
      id: queued.data.data.id,
      serviceId: line.id,
      title: line.title,
      orgName,
      changeSummary: queued.data.data.change_summary,
      after: line.after,
    });
  }

  const persisted = await readQueueItems(
    token,
    queueItems.map((item) => item.id)
  );
  for (const item of queueItems) {
    const row = persisted.find((entry) => entry.id === item.id);
    if (!row?.change_summary) {
      throw new Error(`Seeded queue item ${item.id} has no generated change_summary`);
    }
    item.changeSummary = row.change_summary;
  }

  return { stamp, orgId, orgName, runId, lines, queueItems };
}

export async function seedRemovalItem(token, stamp) {
  const orgId = `org-e2e-${stamp}`;
  const serviceId = `e2e-${stamp}-removed`;
  const orgName = `E2E ${stamp} Removal`;
  assertThrowawayOrgId(orgId);
  assertThrowawayServiceId(serviceId);

  const org = await directusRequest(token, "/items/organizations", {
    method: "POST",
    body: {
      id: orgId,
      public_id: orgId,
      render_grain: "flat",
      name: orgName,
      cluster_key: stamp,
      status: "published",
      source_primary: "fsd",
    },
  });
  if (org.status !== 200 && org.status !== 201) {
    throw new Error(`Seed removal organization failed: HTTP ${org.status}`);
  }

  const service = await directusRequest(token, "/items/services", {
    method: "POST",
    body: {
      id: serviceId,
      organization_id: orgId,
      line_id: serviceId,
      title: orgName,
      status: "published",
      source: "fsd",
      address: "1 Old Street",
      phone: "04 900 0099",
    },
  });
  if (service.status !== 200 && service.status !== 201) {
    throw new Error(`Seed removal service failed: HTTP ${service.status}`);
  }

  const run = await directusRequest(token, "/items/import_runs", {
    method: "POST",
    body: { source: "e2e", status: "success", notes: `playwright removal ${stamp}` },
  });
  if ((run.status !== 200 && run.status !== 201) || !run.data?.data?.id) {
    throw new Error(`Seed removal import_run failed: HTTP ${run.status}`);
  }
  const runId = run.data.data.id;

  const queued = await directusRequest(token, "/items/review_queue_items", {
    method: "POST",
    body: {
      import_run_id: runId,
      entity_type: "service",
      entity_id: serviceId,
      kind: "removed",
      proposed: {
        before: { name: orgName, address: "1 Old Street", phone: "04 900 0099" },
        after: {},
      },
      status: "pending",
    },
  });
  if ((queued.status !== 200 && queued.status !== 201) || !queued.data?.data?.id) {
    throw new Error(`Seed removal queue item failed: HTTP ${queued.status}`);
  }

  return {
    stamp,
    orgId,
    orgName,
    runId,
    lines: [{ id: serviceId, title: orgName }],
    queueItems: [
      {
        id: queued.data.data.id,
        serviceId,
        title: orgName,
        orgName,
        kind: "removed",
      },
    ],
  };
}

export async function cleanupSeed(token, seed) {
  if (!seed) return;
  for (const item of seed.queueItems ?? []) {
    if (!item?.id || !String(item.serviceId ?? "").startsWith("e2e-")) continue;
    await directusRequest(token, `/items/review_queue_items/${item.id}`, { method: "DELETE" });
  }
  for (const line of seed.lines ?? []) {
    assertThrowawayServiceId(line.id);
    await directusRequest(token, `/items/services/${line.id}`, { method: "DELETE" });
  }
  if (seed.orgId) {
    assertThrowawayOrgId(seed.orgId);
    await directusRequest(token, `/items/organizations/${seed.orgId}`, { method: "DELETE" });
  }
  if (seed.runId) {
    await directusRequest(token, `/items/import_runs/${seed.runId}`, { method: "DELETE" });
  }
}

export async function findFlowId(token, name) {
  const params = new URLSearchParams({
    "filter[name][_eq]": name,
    fields: "id,name,status",
    limit: "1",
  });
  const result = await directusRequest(token, `/flows?${params}`);
  return result.data?.data?.[0]?.id ?? null;
}

/** Cleanup-only. The suite still clicks Roll back in the Data Studio. */
export async function triggerRollback(token, version) {
  const flowId = await findFlowId(token, "Roll back");
  if (!flowId) throw new Error("Roll back flow id not found");
  return directusRequest(token, `/flows/trigger/${flowId}`, {
    method: "POST",
    body: { collection: "catalog_snapshots", keys: [String(version)] },
  });
}

export async function restoreSnapshotIfNeeded(token, version) {
  let current = await readCurrentSnapshot(token);
  if (String(current.version) === String(version)) return current;
  const triggered = await triggerRollback(token, version);
  if (triggered.status >= 400) {
    throw new Error(`Cleanup rollback to v${version} failed: HTTP ${triggered.status}`);
  }
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    current = await readCurrentSnapshot(token);
    if (String(current.version) === String(version)) return current;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Cleanup rollback to v${version} left is_current at ${current.version}`);
}
