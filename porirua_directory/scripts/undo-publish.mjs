import { refuseUndoPublish, undoPublishAvailability } from "../editor-core/undo-publish.mjs";
import {
  lastEventForAvailability,
  loadLatestPublishEvent,
  recordCatalogPublishEvent,
} from "./catalog-publish-events.mjs";
import { getCurrentSnapshot, rollbackCatalog } from "./publish-catalog.mjs";

export class UndoPublishError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "UndoPublishError";
    this.statusCode = statusCode;
  }
}

export async function undoPublish({ db, expectedVersion, undoneBy, purge, now } = {}) {
  if (!db) throw new Error("undoPublish requires db");
  const current = await getCurrentSnapshot(db);
  const lastEvent = lastEventForAvailability(await loadLatestPublishEvent(db));
  const availability = undoPublishAvailability({
    currentVersion: current?.version ?? null,
    lastEvent,
    now,
  });
  const refused = refuseUndoPublish({
    expectedVersion,
    currentVersion: current?.version ?? null,
    availability,
  });
  if (refused.refuse) {
    throw new UndoPublishError(refused.statusCode, refused.message);
  }
  const result = await rollbackCatalog({
    db,
    version: availability.previousVersion,
    purge,
  });
  await recordCatalogPublishEvent(db, {
    action: "undo-publish",
    snapshotVersion: Number(expectedVersion),
    previousVersion: result.version,
    actor: undoneBy ?? null,
  });
  return { ok: true, version: result.version, counts: result.envelope.counts };
}
