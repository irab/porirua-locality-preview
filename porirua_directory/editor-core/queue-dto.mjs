import { fieldLabel } from "./fields.mjs";

export function primaryActionLabel(kind) {
  if (kind === "removed") return "Take it off the site";
  if (kind === "geocode_flag") return "The pin is fine";
  return "Accept";
}

export function queueItemDto(item = {}) {
  const proposed = item.proposed && typeof item.proposed === "object" ? item.proposed : {};
  const locked = proposed.locked_fields ?? [];
  const reviewable = proposed.reviewable_fields ?? [];
  const after = proposed.after && typeof proposed.after === "object" ? proposed.after : {};
  const before = proposed.before && typeof proposed.before === "object" ? proposed.before : {};
  const youSetThis = reviewable.filter((field) => locked.includes(field));
  return {
    id: item.id,
    kind: item.kind,
    status: item.status,
    entityId: item.entity_id ?? item.entityId,
    name: after.name || before.name || "",
    address: after.address || before.address || "",
    primaryActionLabel: primaryActionLabel(item.kind),
    youSetThis: youSetThis.map((field) => ({
      field,
      label: fieldLabel(field),
    })),
    lockedFields: locked.map((field) => ({ field, label: fieldLabel(field) })),
    before,
    after,
  };
}
