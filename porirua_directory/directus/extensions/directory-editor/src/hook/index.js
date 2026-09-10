import { clampEditorLastPage, isEditorLandingPage } from "./last-page.js";

async function userIsEditor(key, { services, getSchema }) {
  const schema = await getSchema();
  const users = new services.UsersService({ schema, accountability: { admin: true } });
  const roles = new services.RolesService({ schema, accountability: { admin: true } });
  const user = await users.readOne(key, { fields: ["role"] });
  if (!user?.role) return false;
  const role = await roles.readOne(user.role, { fields: ["name"] });
  return String(role?.name ?? "").trim().toLowerCase() === "editor";
}

export default ({ filter }, context) => {
  filter("users.update", async (payload, meta) => {
    if (!payload || typeof payload.last_page !== "string") return payload;
    if (isEditorLandingPage(payload.last_page)) return payload;
    const keys = meta?.keys ?? [];
    for (const key of keys) {
      if (await userIsEditor(key, context)) {
        payload.last_page = clampEditorLastPage(payload.last_page);
        return payload;
      }
    }
    return payload;
  });
};
