import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const filesBelow = (directory) =>
  readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(entry.parentPath, entry.name));

export function validateLocalPayloadPaths(actualPaths, expectedPaths, allowed) {
  const actual = [...actualPaths].sort();
  const expected = [...expectedPaths].sort();
  for (const path of actual) {
    if (!allowed(path))
      throw new Error(`Local snapshot path is not allowlisted: ${path}`);
  }
  const unexpected = actual.filter((path) => !expected.includes(path));
  const missing = expected.filter((path) => !actual.includes(path));
  if (unexpected.length || missing.length)
    throw new Error(
      `Local snapshot file set differs (unexpected: ${unexpected.join(", ") || "none"}; missing: ${missing.join(", ") || "none"})`,
    );
}

export function verifyDesignSnapshot(root, source) {
  const manifest = JSON.parse(
    readFileSync(
      resolve(root, "apps/web/src/design-reference/snapshot.json"),
      "utf8",
    ),
  );
  const head = readFileSync(resolve(source, ".git/HEAD"), "utf8").trim();
  const commit = head.startsWith("ref: ")
    ? readFileSync(resolve(source, ".git", head.slice(5)), "utf8").trim()
    : head;
  if (commit !== manifest.revision)
    throw new Error(`Expected ${manifest.revision}, got ${commit}`);
  const show = (path) => readFileSync(resolve(source, path));
  const allowlist = show("export-allowlist.txt");
  if (digest(allowlist) !== manifest.allowlistSha256)
    throw new Error("Pinned export allowlist hash differs");
  const rules = allowlist
    .toString("utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const allowed = (path) =>
    rules.some(
      (rule) =>
        rule === path ||
        (rule.endsWith("/**") && path.startsWith(rule.slice(0, -2))) ||
        (rule === "components/**/*.jsx" &&
          /^components\/.+\.jsx$/.test(path)) ||
        (rule === "components/**/*.d.ts" &&
          /^components\/.+\.d\.ts$/.test(path)),
    );

  const designRoot = resolve(root, "apps/web/src/design-reference");
  const brandRoot = resolve(root, "apps/web/public/brand");
  const actualPaths = filesBelow(designRoot)
    .filter(
      (path) =>
        !["README.md", "snapshot.json"].includes(relative(designRoot, path)),
    )
    .map((path) => relative(designRoot, path).replaceAll("\\", "/"));
  actualPaths.push(
    ...filesBelow(brandRoot).map(
      (path) => `assets/${relative(brandRoot, path).replaceAll("\\", "/")}`,
    ),
  );
  validateLocalPayloadPaths(actualPaths, Object.keys(manifest.files), allowed);

  for (const [path, expected] of Object.entries(manifest.files)) {
    const upstream = show(path);
    if (digest(upstream) !== expected)
      throw new Error(`Recorded upstream hash differs: ${path}`);
    const localPath = path.startsWith("assets/")
      ? `apps/web/public/brand/${path.slice(7)}`
      : `apps/web/src/design-reference/${path}`;
    if (digest(readFileSync(resolve(root, localPath))) !== expected)
      throw new Error(`Vendored bytes differ: ${path}`);
  }
  return {
    revision: manifest.revision,
    count: Object.keys(manifest.files).length,
  };
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const root = resolve(import.meta.dirname, "..");
  const source = process.env.DESIGN_REFERENCE_DIR;
  if (!source)
    throw new Error(
      "Set DESIGN_REFERENCE_DIR to a checkout of WeaveTrail/design-reference",
    );
  const result = verifyDesignSnapshot(root, source);
  console.log(
    `PASS design snapshot ${result.revision} (${result.count} allowlisted files)`,
  );
}
