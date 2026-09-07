/**
 * In-memory snapshot cache keyed by version. Repeat reads do not touch Postgres.
 */

export function createCatalogService({ repository } = {}) {
  if (!repository) {
    throw new Error("createCatalogService requires a snapshot repository");
  }

  const byVersion = new Map();
  let lastCurrent = null;

  function remember(snapshot, { asCurrent = false } = {}) {
    if (!snapshot) return null;
    byVersion.set(snapshot.version, snapshot);
    if (asCurrent || snapshot.isCurrent) {
      lastCurrent = snapshot;
    }
    return snapshot;
  }

  return {
    async getCatalog({ version } = {}) {
      if (version != null) {
        if (byVersion.has(version)) return byVersion.get(version);
        return remember(await repository.getByVersion(version));
      }
      if (lastCurrent) return lastCurrent;
      return remember(await repository.getCurrent(), { asCurrent: true });
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
