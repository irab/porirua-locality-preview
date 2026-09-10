export function isEditorOrAdmin({ admin, roleName } = {}) {
  if (admin === true) return true;
  const name = String(roleName ?? "").trim().toLowerCase();
  return name === "editor" || name === "administrator";
}
