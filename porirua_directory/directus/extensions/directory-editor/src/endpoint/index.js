import { isEditorOrAdmin } from "./authorize.js";

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

async function roleNameOf(req, { services, getSchema }) {
  const accountability = req.accountability || {};
  if (accountability.admin) return { admin: true, roleName: "Administrator" };
  if (!accountability.role) return { admin: false, roleName: null };
  const schema = await getSchema();
  const roles = new services.RolesService({
    schema,
    accountability: { admin: true },
  });
  const role = await roles.readOne(accountability.role);
  return { admin: false, roleName: role?.name ?? null };
}

async function assertAuthorized(req, context) {
  if (!req.accountability?.user) {
    const error = new Error("Authentication required");
    error.status = 401;
    throw error;
  }
  const identity = await roleNameOf(req, context);
  if (isEditorOrAdmin(identity)) return identity;
  const error = new Error("Editor or Admin role is required");
  error.status = 403;
  throw error;
}

async function proxy(req, res, env, pathname) {
  const base = String(env.OPERATIONS_URL || process.env.OPERATIONS_URL || "").replace(/\/$/, "");
  if (!base) {
    res.status(500).json({ error: "OPERATIONS_URL is not configured" });
    return;
  }
  const search = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const response = await fetch(`${base}${pathname}${search}`, {
    method: req.method,
    headers: { "content-type": "application/json" },
    body: req.method === "GET" || req.method === "HEAD" ? undefined : JSON.stringify(req.body ?? {}),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  res.status(response.status).json(data);
}

export default {
  id: "directory-editor",
  handler: (router, context) => {
    const { env, services, getSchema } = context;

    router.get("/health", (_req, res) => {
      res.json({ ok: true });
    });

    router.use(async (req, res, next) => {
      try {
        if (req.path === "/health") return next();
        if (MUTATING.has(req.method)) {
          await assertAuthorized(req, { services, getSchema });
        } else {
          await assertAuthorized(req, { services, getSchema });
        }
        next();
      } catch (error) {
        res.status(error.status || 403).json({ error: error.message });
      }
    });

    router.get("/listings/name-matches", (req, res) => proxy(req, res, env, "/listings/name-matches"));
    router.get("/listings", (req, res) => proxy(req, res, env, "/listings"));
    router.get("/listings/:id", (req, res) =>
      proxy(req, res, env, `/listings/${encodeURIComponent(req.params.id)}`)
    );
    router.get("/queue", (req, res) => proxy(req, res, env, "/queue"));
    router.get("/publish-status", (req, res) => proxy(req, res, env, "/publish-status"));
    router.get("/geocode", (req, res) => proxy(req, res, env, "/geocode"));
    router.post("/listings", (req, res) => proxy(req, res, env, "/listings"));
    router.post("/listings/update", (req, res) => proxy(req, res, env, "/listings/update"));
    router.post("/listings/archive", (req, res) => proxy(req, res, env, "/listings/archive"));
    router.post("/listings/restore", (req, res) => proxy(req, res, env, "/listings/restore"));
    router.post("/approve", (req, res) => proxy(req, res, env, "/approve"));
    router.post("/keep-curation", (req, res) => proxy(req, res, env, "/keep-curation"));
    router.post("/hide", (req, res) => proxy(req, res, env, "/hide"));
    router.post("/reject", (req, res) => proxy(req, res, env, "/reject"));
    router.post("/edit-and-approve", (req, res) => proxy(req, res, env, "/edit-and-approve"));
    router.post("/publish", (req, res) => proxy(req, res, env, "/publish"));
  },
};
