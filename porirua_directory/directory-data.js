/** Loads and normalises data/services.json for the directory UI. */

import { expandServiceLines } from "./scripts/org-grouping.mjs";

export async function loadServices() {
  const res = await fetch("./data/services.json");
  if (!res.ok) throw new Error(`Failed to load services: ${res.status}`);
  const envelope = await res.json();
  const entries = (envelope.services ?? []).filter((s) => !s.duplicateOf);
  const serviceLines = expandServiceLines(entries);
  return {
    meta: { generatedAt: envelope.generatedAt, counts: envelope.counts },
    entries,
    serviceLines,
    services: serviceLines,
  };
}
