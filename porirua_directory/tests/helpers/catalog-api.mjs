/**
 * In-process catalog API for unit tests. Inject a fake snapshot repository
 * so these tests do not need Postgres.
 */

import { createCatalogServer } from "../../api/server.mjs";

export function publishedEnvelope(overrides = {}) {
  return {
    generatedAt: "2026-08-20T11:41:37.964Z",
    counts: {
      community: 2,
      fsd: 1,
      published: 3,
      serviceLines: 3,
      organizations: 0,
      duplicatesHidden: 0,
    },
    services: [
      {
        id: "community-awatea-community-garden",
        name: "Awatea Community Garden",
        source: "community",
      },
      {
        id: "fsd-2964",
        name: "Wesley Community Action",
        source: "fsd",
      },
    ],
    ...overrides,
  };
}

export function snapshot(version, envelope, extras = {}) {
  return {
    version,
    envelope,
    isCurrent: extras.isCurrent ?? true,
    ...extras,
  };
}

export function fakeClock(start = 0) {
  let now = start;
  return {
    now() {
      return now;
    },
    set(value) {
      now = value;
    },
    advance(ms) {
      now += ms;
    },
  };
}

export function fakeRepository(initial = {}) {
  let current = initial.current ?? null;
  const byVersion = new Map(initial.byVersion ?? []);
  if (current) byVersion.set(current.version, current);
  let queryCount = 0;
  let envelopeReads = 0;
  let pointerReads = 0;
  let unreachable = Boolean(initial.unreachable);
  const pingError = initial.pingError ?? null;

  function failIfUnreachable() {
    if (unreachable) throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
  }

  return {
    queryCount() {
      return queryCount;
    },
    envelopeReads() {
      return envelopeReads;
    },
    pointerReads() {
      return pointerReads;
    },
    setCurrent(next) {
      current = next;
      if (next) byVersion.set(next.version, next);
    },
    setUnreachable(value) {
      unreachable = value;
    },
    async getCurrentVersion() {
      queryCount += 1;
      pointerReads += 1;
      failIfUnreachable();
      return current ? current.version : null;
    },
    async getCurrent() {
      queryCount += 1;
      envelopeReads += 1;
      failIfUnreachable();
      return current;
    },
    async getByVersion(version) {
      queryCount += 1;
      envelopeReads += 1;
      failIfUnreachable();
      return byVersion.get(Number(version)) ?? null;
    },
    async ping() {
      queryCount += 1;
      if (unreachable) {
        throw pingError ?? new Error("connect ECONNREFUSED 127.0.0.1:5432");
      }
    },
  };
}

export async function withCatalogApi(t, options, fn) {
  const server = createCatalogServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
  );
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  return fn({
    base,
    get(path, headers) {
      return fetch(`${base}${path}`, { headers });
    },
  });
}
