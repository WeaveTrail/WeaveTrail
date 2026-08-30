import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function artifactBytes(name: string): Buffer {
  return readFileSync(new URL(`./sources/${name}`, import.meta.url));
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("synthetic source artifacts", () => {
  it.each([
    [
      "concentrated-buy-dialect-a.csv",
      "d4bd80adf6a853adcf98f9ee08092f786b9b9276b349ad11fef6d0af078b867e",
    ],
    [
      "concentrated-buy-dialect-b.jsonl",
      "71a367b78a9bfefa685b9f40414b778712860b358882537b7f87127ab1584cff",
    ],
  ])("pins the exact bytes of %s", (name, expectedHash) => {
    const bytes = artifactBytes(name);

    expect(bytes.includes(13)).toBe(false);
    expect(sha256(bytes)).toBe(expectedHash);
  });
});
