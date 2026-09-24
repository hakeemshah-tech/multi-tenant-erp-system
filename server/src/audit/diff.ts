export type FieldChange = {
  path: string; // e.g. "personaldetails.firstname"
  old?: any; // JSON-serializable
  new?: any; // JSON-serializable
  op: "add" | "remove" | "replace";
};

function isObject(x: any) {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

export function computeFieldChanges(
  before: any,
  after: any,
  basePath = "",
  whitelist?: Set<string> // optional path whitelist
): FieldChange[] {
  const changes: FieldChange[] = [];

  const keys = new Set<string>([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);

  for (const key of keys) {
    const path = basePath ? `${basePath}.${key}` : key;

    if (
      whitelist &&
      !Array.from(whitelist).some((w) => path === w || path.startsWith(`${w}.`))
    ) {
      continue;
    }

    const a = before?.[key];
    const b = after?.[key];

    if (isObject(a) && isObject(b)) {
      changes.push(...computeFieldChanges(a, b, path, whitelist));
      continue;
    }

    const aJson = a === undefined ? undefined : JSON.stringify(a);
    const bJson = b === undefined ? undefined : JSON.stringify(b);

    if (a === undefined && b !== undefined) {
      changes.push({ path, new: b, op: "add" });
    } else if (a !== undefined && b === undefined) {
      changes.push({ path, old: a, op: "remove" });
    } else if (aJson !== bJson) {
      changes.push({ path, old: a, new: b, op: "replace" });
    }
  }

  return changes;
}
