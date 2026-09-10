import test from "node:test";
import assert from "node:assert/strict";
import { recordPublicIdAlias } from "../scripts/directus/public-id-alias.mjs";
import { withDirectusDatabase } from "./helpers/directus-postgres.mjs";

test("an admin public_id change writes a public_id_aliases row", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    const row = await recordPublicIdAlias({
      db: client,
      oldPublicId: "fsd-2964",
      newPublicId: "org-whanau-centre",
    });
    assert.deepEqual(row, {
      old_public_id: "fsd-2964",
      new_public_id: "org-whanau-centre",
      entity_type: "organization",
    });
    const stored = await client.query(`SELECT * FROM public_id_aliases`);
    assert.equal(stored.rows.length, 1);
    assert.equal(stored.rows[0].old_public_id, "fsd-2964");
  });
});

test("unchanged public_id does not write an alias", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await recordPublicIdAlias({
      db: client,
      oldPublicId: "fsd-2964",
      newPublicId: "fsd-2964",
    });
    const stored = await client.query(`SELECT count(*)::int AS n FROM public_id_aliases`);
    assert.equal(stored.rows[0].n, 0);
  });
});
