/** Resolve structural segments against the original body, stopping at a missing child. */
export function existingRequestPath(
  body: unknown,
  path: readonly PropertyKey[],
): (string | number)[] {
  const resolved: (string | number)[] = [];
  let value = body;
  for (const segment of path) {
    if (value === null || typeof value !== "object") break;
    if (Array.isArray(value)) {
      if (
        typeof segment !== "number" ||
        !Number.isInteger(segment) ||
        segment < 0 ||
        segment >= value.length
      )
        break;
    } else if (typeof segment !== "string") {
      break;
    }
    if (!Object.hasOwn(value, segment)) break;
    resolved.push(segment);
    value = (value as Record<string | number, unknown>)[segment];
  }
  return resolved;
}
