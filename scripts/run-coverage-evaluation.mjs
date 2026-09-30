import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { arch, platform, release } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = new URL("../dist/coverage-evaluation/", import.meta.url);
const summary = new URL("summary.json", output);
const receipt = new URL("run.json", output);
mkdirSync(output, { recursive: true });
rmSync(summary, { force: true });
rmSync(receipt, { force: true });
const result = spawnSync(
  "pnpm",
  [
    "exec",
    "vitest",
    "run",
    "packages/evals/src/claim-coverage-publication.test.ts",
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      WEAVETRAIL_COVERAGE_EVALUATION_OUTPUT: fileURLToPath(summary),
    },
  },
);
if (result.status !== 0) process.exit(result.status ?? 1);
const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const paths = git(
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "--",
  "packages",
  "scripts",
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.base.json",
  "vitest.config.ts",
)
  .split("\n")
  .filter(
    (path) => path && !/^packages\/evals\/results\/.*\.run\.json$/.test(path),
  )
  .sort();
const fingerprints = paths.map((path) => [
  path,
  sha256(readFileSync(new URL(path, new URL("../", import.meta.url)))),
]);
writeFileSync(
  receipt,
  JSON.stringify(
    {
      schemaVersion: "1.0",
      command: "pnpm eval:coverage",
      commitSha: git("rev-parse", "HEAD"),
      workingTreeDirty: git("status", "--porcelain").length > 0,
      inputTreeSha256: sha256(JSON.stringify(fingerprints)),
      inputTreeDefinition:
        "SHA-256 of JSON-encoded, path-sorted [path, SHA-256(bytes)] pairs from git ls-files --cached --others --exclude-standard over packages, scripts, package.json, pnpm-lock.yaml, tsconfig.base.json and vitest.config.ts; excludes captured evaluation run receipts.",
      summarySha256: sha256(readFileSync(summary)),
      environment: {
        node: process.version,
        pnpm: execFileSync("pnpm", ["--version"], {
          cwd: root,
          encoding: "utf8",
        }).trim(),
        vitest: JSON.parse(
          readFileSync(
            new URL("../node_modules/vitest/package.json", import.meta.url),
            "utf8",
          ),
        ).version,
        platform: platform(),
        architecture: arch(),
        release: release(),
      },
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "PASS: dist/coverage-evaluation/summary.json and dist/coverage-evaluation/run.json",
);
