/**
 * In-memory snapshot cache keyed by version. Envelope bodies are immutable.
 * The current-version pointer is re-checked on a short TTL.
 */

import { CATALOG_CURRENT_TTL_MS } from "../scripts/config.mjs";

export class CatalogUnavailableError extends Error {
  constructor() {
    super("catalog unavailable");
    this.name = "CatalogUnavailableError";
  }
}

export function createCatalogService({
  repository,
  now = Date.now,
  currentTtlMs = CATALOG_CURRENT_TTL_MS,
} = {}) {
  if (!repository) {
    throw new Error("createCatalogService requires a snapshot repository");
  }

  const byVersion = new Map();
  let lastCurrent = null;
  let currentCheckedAt = Number.NEGATIVE_INFINITY;

  function remember(snapshot, { asCurrent = false } = {}) {
    if (!snapshot) return null;
    byVersion.set(snapshot.version, snapshot);
    if (asCurrent || snapshot.isCurrent) {
      lastCurrent = snapshot;
    }
    return snapshot;
  }

  function pointerIsFresh() {
    return lastCurrent != null && now() - currentCheckedAt < currentTtlMs;
  }

  async function resolveCurrent() {
    if (pointerIsFresh()) return lastCurrent;

    try {
      const version = await repository.getCurrentVersion();
      currentCheckedAt = now();
      if (version == null) {
        if (lastCurrent) return lastCurrent;
        throw new CatalogUnavailableError();
      }
      if (byVersion.has(version)) {
        lastCurrent = byVersion.get(version);
        return lastCurrent;
      }
      const snapshot = remember(await repository.getByVersion(version), {
        asCurrent: true,
      });
      if (snapshot) return snapshot;
      if (lastCurrent) return lastCurrent;
      throw new CatalogUnavailableError();
    } catch (error) {
      if (error instanceof CatalogUnavailableError) throw error;
      if (lastCurrent) {
        currentCheckedAt = now();
        return lastCurrent;
      }
      throw new CatalogUnavailableError();
    }
  }

  return {
    async getCatalog({ version } = {}) {
      if (version != null) {
        if (byVersion.has(version)) return byVersion.get(version);
        try {
          return remember(await repository.getByVersion(version));
        } catch {
          throw new CatalogUnavailableError();
        }
      }
      return resolveCurrent();
    },

    async health() {
      try {
        await repository.ping();
        return { ok: true, database: "reachable" };
      } catch {
        return { ok: false, database: "unreachable" };
      }
    },
  };
}
