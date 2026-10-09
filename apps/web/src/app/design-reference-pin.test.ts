import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// apps/web/src/design-reference/snapshot.json is the one authoritative
// design-reference pin. Every other record either reads it or must repeat the
// same revision, so a re-pin cannot leave a stale citation behind.
const root = resolve(import.meta.dirname, "../../../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const snapshot = JSON.parse(
  read("apps/web/src/design-reference/snapshot.json"),
) as {
  revision: string;
  files: Record<string, string>;
};
const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

// ADRs keep the revision current when they were accepted.
const citingFiles = trackedFiles.filter(
  (path) =>
    !path.startsWith("docs/adr/") && /\.(md|svg|ts|tsx|mjs)$/.test(path),
);

// Hand-authored and generated figures that map literal hex values to tokens.
const tokenFigures = trackedFiles.filter(
  (path) =>
    path.endsWith(".svg") &&
    read(path).includes(
      "WeaveTrail design system, pinned at design-reference@",
    ),
);

describe("design-reference pin", () => {
  it("cites only the revision snapshot.json pins", () => {
    const stale = citingFiles.flatMap((path) =>
      [...read(path).matchAll(/design-reference@([0-9a-f]{7,40})/g)]
        .filter((match) => match[1] !== snapshot.revision)
        .map((match) => `${path}: ${match[1]}`),
    );
    expect(stale).toEqual([]);
  });

  it("names the pinned revision wherever the prose records it", () => {
    for (const path of [
      "THIRD_PARTY_NOTICES.md",
      "docs/ARCHITECTURE.md",
      "docs/ARCHITECTURE.ko.md",
      "apps/web/src/design-reference/README.md",
    ])
      expect(read(path), path).toContain(snapshot.revision);
  });

  it("ships both copies of the mark as the pinned bytes", () => {
    for (const path of [
      "apps/web/public/brand/mark.svg",
      "docs/assets/brand/mark.svg",
    ])
      expect(
        createHash("sha256")
          .update(readFileSync(resolve(root, path)))
          .digest("hex"),
        path,
      ).toBe(snapshot.files["assets/mark.svg"]);
  });

  it("maps each figure's literal hex to the pinned token it names", () => {
    const declared = new Map<string, string>();
    for (const match of read(
      "apps/web/src/design-reference/tokens/colors.css",
    ).matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      const [, token = "", value = ""] = match;
      if (!declared.has(token)) declared.set(token, value.trim());
    }
    const valueOf = (token: string) => {
      let value = declared.get(token);
      for (let depth = 0; value?.startsWith("var(--") && depth < 8; depth++)
        value = declared.get(value.slice(6, -1));
      return value?.toLowerCase();
    };

    expect(tokenFigures.length).toBeGreaterThan(0);
    const mismatched = tokenFigures.flatMap((path) => {
      const comment = read(path).match(/<!--[\s\S]*?-->/)?.[0] ?? "";
      // The first name after a hex is its token; later names are role labels.
      return [...comment.matchAll(/(#[0-9a-f]{6}) ([a-z][a-z0-9-]*)/g)]
        .filter(([, hex, token = ""]) => valueOf(token) !== hex)
        .map(([, hex, token]) => `${path}: ${hex} ${token}`);
    });
    expect(mismatched).toEqual([]);
  });
});
