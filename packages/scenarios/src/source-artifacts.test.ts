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
    [
      "rapid-price-lift-supported.csv",
      "72511e0c67ec066130fcb10d92f0afa43e1147023722ca0fa6d82ef57a90a827",
    ],
    [
      "rapid-price-lift-broad-participation.csv",
      "08b1d150939e10d91c8818424572feab58e55e6fd2e71acd3a2149b72b76f6d0",
    ],
    [
      "rapid-price-lift-insufficient-evidence.csv",
      "15f79ef0265f836b5a01635bbcdd8e2f241431fbcc87fc504a1e2f7ea05582f7",
    ],
  ])("pins the exact bytes of %s", (name, expectedHash) => {
    const bytes = artifactBytes(name);

    expect(bytes.includes(13)).toBe(false);
    expect(sha256(bytes)).toBe(expectedHash);
  });
});
