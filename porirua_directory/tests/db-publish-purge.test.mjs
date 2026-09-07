import test from "node:test";
import assert from "node:assert/strict";
import {
  getCurrentSnapshot,
  publishCatalog,
  rollbackCatalog,
} from "../scripts/publish-catalog.mjs";
import { CATALOG_PUBLIC_URL, createMemoryEdgeCache } from "../scripts/lib/edge-cache.mjs";
import { withDirectusDatabase } from "./helpers/directus-postgres.mjs";

async function seedListing(client, name = "First Name") {
  await client.query(
    `INSERT INTO organizations (id, public_id, render_grain, name, cluster_key, status, source_primary)
     VALUES ('org-1', 'org-1', 'flat', $1, 'key-1', 'published', 'fsd')`,
    [name]
  );
  await client.query(
    `INSERT INTO services (id, organization_id, line_id, title, source, status)
     VALUES ('fsd-1', 'org-1', 'fsd-1', 'Line', 'fsd', 'published')`
  );
}

function listingName(envelope) {
  return envelope.services[0]?.name;
}

test("publishCatalog purges the public catalog URL before reporting the version", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await seedListing(client);
    const purged = [];
    const result = await publishCatalog({
      db: client,
      publishedBy: "test",
      purge: async (urls) => {
        purged.push(urls);
      },
    });
    assert.equal(typeof result.version, "number");
    assert.deepEqual(purged, [[CATALOG_PUBLIC_URL]]);
  });
});

test("a failed purge is a failed publish and does not leave the new snapshot current", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await seedListing(client);
    const first = await publishCatalog({
      db: client,
      publishedBy: "v1",
      purge: async () => {},
    });
    await client.query(`UPDATE organizations SET name = 'Second Name' WHERE id = 'org-1'`);

    await assert.rejects(
      () =>
        publishCatalog({
          db: client,
          publishedBy: "v2",
          purge: async () => {
            throw new Error("edge unreachable");
          },
        }),
      /cache purge failed/i
    );

    const current = await getCurrentSnapshot(client);
    assert.equal(Number(current.version), first.version);
    assert.equal(listingName(current.envelope), "First Name");
  });
});

test("rollback purges the public catalog URL", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await seedListing(client);
    const first = await publishCatalog({
      db: client,
      publishedBy: "v1",
      purge: async () => {},
    });
    await client.query(`UPDATE organizations SET name = 'Second Name' WHERE id = 'org-1'`);
    await publishCatalog({
      db: client,
      publishedBy: "v2",
      purge: async () => {},
    });

    const purged = [];
    await rollbackCatalog({
      db: client,
      version: first.version,
      purge: async (urls) => {
        purged.push(urls);
      },
    });
    assert.deepEqual(purged, [[CATALOG_PUBLIC_URL]]);
  });
});

test("a second publish is served on the public read path after purge without waiting out a TTL", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await seedListing(client, "First Name");
    const edge = createMemoryEdgeCache({
      originGet: async () => {
        const current = await getCurrentSnapshot(client);
        return current.envelope;
      },
    });

    await publishCatalog({
      db: client,
      publishedBy: "v1",
      purge: (urls) => edge.purge(urls),
    });
    edge.seed(CATALOG_PUBLIC_URL, await edge.get(CATALOG_PUBLIC_URL));
    assert.equal(listingName(await edge.get(CATALOG_PUBLIC_URL)), "First Name");

    await client.query(`UPDATE organizations SET name = 'Second Name' WHERE id = 'org-1'`);
    await publishCatalog({
      db: client,
      publishedBy: "v2",
      purge: (urls) => edge.purge(urls),
    });

    const served = await edge.get(CATALOG_PUBLIC_URL);
    assert.equal(listingName(served), "Second Name");
  });
});

test("a status change alone does not change what the public read path serves", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await seedListing(client, "Visible");
    const edge = createMemoryEdgeCache({
      originGet: async () => {
        const current = await getCurrentSnapshot(client);
        return current?.envelope ?? null;
      },
    });
    await publishCatalog({
      db: client,
      publishedBy: "v1",
      purge: (urls) => edge.purge(urls),
    });
    edge.seed(CATALOG_PUBLIC_URL, await edge.get(CATALOG_PUBLIC_URL));

    await client.query(`UPDATE organizations SET status = 'hidden' WHERE id = 'org-1'`);
    assert.equal(listingName(await edge.get(CATALOG_PUBLIC_URL)), "Visible");

    await publishCatalog({
      db: client,
      publishedBy: "v2",
      purge: (urls) => edge.purge(urls),
    });
    const afterPublish = await edge.get(CATALOG_PUBLIC_URL);
    assert.equal(listingName(afterPublish), undefined);
    assert.equal(afterPublish.services.length, 0);
  });
});
