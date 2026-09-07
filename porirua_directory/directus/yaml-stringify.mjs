function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function quote(value) {
  if (value === "") return '""';
  if (/[:#\n'"{}[\],&*?|<>=!%@`]/.test(value) || value !== value.trim()) {
    return JSON.stringify(value);
  }
  return value;
}

function dump(value, indent = 0) {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return quote(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        if (isPlainObject(item) || Array.isArray(item)) {
          const inner = dump(item, indent + 1);
          if (inner === "[]" || inner === "{}") return `${pad}- ${inner}`;
          return `${pad}-\n${inner}`;
        }
        return `${pad}- ${dump(item, indent + 1)}`;
      })
      .join("\n");
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    return keys
      .map((key) => {
        const child = value[key];
        if (isPlainObject(child) || Array.isArray(child)) {
          const inner = dump(child, indent + 1);
          if (inner === "[]" || inner === "{}") return `${pad}${key}: ${inner}`;
          return `${pad}${key}:\n${inner}`;
        }
        return `${pad}${key}: ${dump(child, indent + 1)}`;
      })
      .join("\n");
  }
  return quote(String(value));
}

export function stringify(value) {
  return `${dump(value, 0)}\n`;
}
