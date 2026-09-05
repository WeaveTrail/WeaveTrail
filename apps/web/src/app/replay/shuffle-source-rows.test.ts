import { describe, expect, it, vi } from "vitest";
import { shuffleSourceRows } from "./shuffle-source-rows";

const rows = ["2", "3", "4", "5"].map((rowNumber) =>
  Object.freeze({
    coordinate: Object.freeze({
      sourceArtifactHash: "a".repeat(64),
      rowNumber,
    }),
    values: Object.freeze({ px: "100.00", qty: "0.010", id: rowNumber }),
  }),
);
Object.freeze(rows);

describe("source-row request permutations", () => {
  it("uses injected draws for different permutations while preserving exact records", () => {
    const zero = shuffleSourceRows(rows, rows, () => 0);
    const half = shuffleSourceRows(rows, rows, () => 0.5);
    expect(zero.map((row) => row.coordinate.rowNumber)).toEqual([
      "3",
      "4",
      "5",
      "2",
    ]);
    expect(half.map((row) => row.coordinate.rowNumber)).toEqual([
      "2",
      "5",
      "3",
      "4",
    ]);
    expect(half).not.toEqual(zero);
    for (const shuffled of [zero, half]) {
      expect(shuffled).not.toBe(rows);
      expect(new Set(shuffled)).toEqual(new Set(rows));
      for (const row of shuffled) expect(rows).toContain(row);
    }
    expect(rows.map((row) => row.coordinate.rowNumber)).toEqual([
      "2",
      "3",
      "4",
      "5",
    ]);
  });

  it("swaps once when a draw matches the previous submitted coordinates", () => {
    const identityDraw = vi.fn(() => 0.999);
    expect(
      shuffleSourceRows(rows, structuredClone(rows), identityDraw),
    ).toEqual([rows[1], rows[0], rows[2], rows[3]]);
    expect(identityDraw).toHaveBeenCalledTimes(3);
    const previous = shuffleSourceRows(rows, rows, () => 0);
    const next = shuffleSourceRows(rows, previous, () => 0);
    expect(next).toEqual([previous[1], previous[0], previous[2], previous[3]]);
  });

  it("alternates two rows even with repeated identical draws", () => {
    const pair = rows.slice(0, 2);
    const first = shuffleSourceRows(pair, pair, () => 0);
    const second = shuffleSourceRows(pair, first, () => 0);
    expect(first).toEqual([pair[1], pair[0]]);
    expect(second).toEqual(pair);
  });

  it("returns a fresh unchanged array for empty or singleton inputs without drawing", () => {
    const random = vi.fn();
    for (const input of [[], rows.slice(0, 1)]) {
      const output = shuffleSourceRows(input, input, random);
      expect(output).toEqual(input);
      expect(output).not.toBe(input);
    }
    expect(random).not.toHaveBeenCalled();
  });
});
