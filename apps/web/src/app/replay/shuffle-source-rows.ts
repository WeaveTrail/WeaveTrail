import type { ReplayRequest } from "@weavetrail/contracts";

type SourceRow = ReplayRequest["rows"][number];

// Only request order is random. Coordinates and verbatim values stay intact.
export function shuffleSourceRows(
  rows: readonly SourceRow[],
  previousOrder: readonly SourceRow[] = rows,
  random: () => number = Math.random,
): SourceRow[] {
  const shuffled = [...rows];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[selected]] = [
      shuffled[selected]!,
      shuffled[index]!,
    ];
  }
  const unchanged =
    shuffled.length === previousOrder.length &&
    shuffled.every(
      ({ coordinate }, index) =>
        coordinate.sourceArtifactHash ===
          previousOrder[index]!.coordinate.sourceArtifactHash &&
        coordinate.rowNumber === previousOrder[index]!.coordinate.rowNumber,
    );
  // A bounded fallback also guarantees alternation for two-row inputs.
  if (shuffled.length > 1 && unchanged) {
    [shuffled[0], shuffled[1]] = [shuffled[1]!, shuffled[0]!];
  }
  return shuffled;
}
