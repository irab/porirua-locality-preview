/** Loads data/services.json for directory UI (MVP). */

export async function loadServices() {
  const res = await fetch("./data/services.json");
  if (!res.ok) throw new Error(`Failed to load services: ${res.status}`);
  return res.json();
}
