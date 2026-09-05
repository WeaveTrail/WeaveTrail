import { describe, expect, it } from "vitest";
import { existingRequestPath } from "./review-path";

describe("request path resolution", () => {
  it.each([
    [
      ["values", "a.b"],
      ["values", "a.b"],
    ],
    [
      ["values", "123"],
      ["values", "123"],
    ],
    [
      ["values", ""],
      ["values", ""],
    ],
    [["values", "missing", "child"], ["values"]],
    [["values", "toString"], ["values"]],
    [
      ["rows", 0, "value"],
      ["rows", 0, "value"],
    ],
    [["rows", 1], ["rows"]],
    [["rows", "0"], ["rows"]],
    [["rows", -1], ["rows"]],
    [["rows", 0.5], ["rows"]],
    [["values", 123], ["values"]],
  ])(
    "preserves literal keys and stops at missing children: %j",
    (path, expected) => {
      const body = {
        values: { "a.b": "x", "123": null, "": false },
        rows: [{ value: 0 }],
      };
      expect(existingRequestPath(body, path)).toEqual(expected);
    },
  );

  it("uses the body for primitive or absent input", () => {
    for (const body of [undefined, null, false, "text", 1]) {
      expect(existingRequestPath(body, ["rows"])).toEqual([]);
    }
  });
});
