export function isEditorOrAdmin({ admin, roleName } = {}) {
  if (admin === true) return true;
  const name = String(roleName ?? "").trim().toLowerCase();
  return name === "editor" || name === "administrator";
}

export function unauthorizedError() {
  const error = new Error("Editor or Admin role is required");
  error.statusCode = 403;
  error.status = 403;
  return error;
}
