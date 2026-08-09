/** Loads and normalises data/services.json for the directory UI. */

export async function loadServices() {
  const res = await fetch("./data/services.json");
  if (!res.ok) throw new Error(`Failed to load services: ${res.status}`);
  const envelope = await res.json();
  const services = (envelope.services ?? []).filter((s) => !s.duplicateOf);
  return { meta: { generatedAt: envelope.generatedAt, counts: envelope.counts }, services };
}
