import { publishVersionDto } from "../editor-core/publish-versions.mjs";
import { recordCatalogPublishEvent } from "./catalog-publish-events.mjs";
import { getCurrentSnapshot, rollbackCatalog } from "./publish-catalog.mjs";

const VERSION_LIMIT = 50;

export class PublishVersionError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "PublishVersionError";
    this.statusCode = statusCode;
  }
}

export async function listPublishVersions({ db } = {}) {
  if (!db) throw new Error("listPublishVersions requires db");
  const result = await db.query(
    `SELECT version, generated_at, published_by, is_current, counts
       FROM catalog_snapshots
      ORDER BY version DESC
      LIMIT $1`,
    [VERSION_LIMIT]
  );
  return {
    versions: result.rows.map((row) => publishVersionDto(row)),
  };
}

export async function switchPublishedVersion({
  db,
  version,
  expectedVersion,
  switchedBy,
  purge,
} = {}) {
  if (!db) throw new Error("switchPublishedVersion requires db");
  const target = Number(version);
  if (!Number.isFinite(target)) {
    throw new PublishVersionError(400, "Choose one published version.");
  }
  const current = await getCurrentSnapshot(db);
  if (!current) {
    throw new PublishVersionError(400, "Nothing has been published yet.");
  }
  if (expectedVersion != null && expectedVersion !== "") {
    if (Number(expectedVersion) !== Number(current.version)) {
      throw new PublishVersionError(
        409,
        "Someone else has published since. Refresh and try again."
      );
    }
  }
  if (Number(current.version) === target) {
    throw new PublishVersionError(400, "That version is already on the public site.");
  }
  const result = await rollbackCatalog({
    db,
    version: target,
    publishedBy: switchedBy,
    purge,
  });
  await recordCatalogPublishEvent(db, {
    action: "rollback",
    snapshotVersion: result.version,
    previousVersion: current.version,
    actor: switchedBy ?? null,
  });
  return { ok: true, version: result.version, counts: result.envelope.counts };
}
