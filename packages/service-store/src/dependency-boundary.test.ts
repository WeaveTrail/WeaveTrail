import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const packages = fileURLToPath(new URL("../../", import.meta.url));
const options: ts.CompilerOptions = {
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowJs: true,
};

// Follow exports, type imports and literal dynamic imports as well as imports.
// External libraries are leaves; workspace modules are resolved, not matched
// against a blacklist of today's rule filenames.
function sourceClosure(entry: string): string[] {
  const visited = new Set<string>();
  function visit(file: string) {
    if (visited.has(file)) return;
    visited.add(file);
    const source = ts.preProcessFile(readFileSync(file, "utf8"), true, true);
    for (const { fileName: specifier } of source.importedFiles) {
      if (!specifier.startsWith(".") && !specifier.startsWith("@weavetrail/"))
        continue;
      const resolved = ts.resolveModuleName(specifier, file, options, ts.sys)
        .resolvedModule?.resolvedFileName;
      if (!resolved) throw new Error(`Unresolved ${specifier} from ${file}`);
      visit(resolved);
      // A declaration file must not hide runtime imports in its JS sibling.
      const runtime = resolved.replace(/\.d\.mts$/, ".mjs");
      if (runtime !== resolved && existsSync(runtime)) visit(runtime);
    }
  }
  visit(resolve(packages, entry));
  return [...visited].map((file) => relative(packages, file)).sort();
}

function workspaceDependencies(name: string): string[] {
  const manifest = JSON.parse(
    readFileSync(resolve(packages, name, "package.json"), "utf8"),
  ) as {
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  return Object.keys({
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
    ...manifest.peerDependencies,
  })
    .filter((name) => name.startsWith("@weavetrail/"))
    .map((name) => name.slice("@weavetrail/".length))
    .sort();
}

describe("storage and canonical kernel dependency boundaries", () => {
  it("keeps the entire storage workspace dependency closure below decisions", () => {
    expect(workspaceDependencies("service-store")).toEqual([
      "canonical-kernel",
      "contracts",
    ]);
    expect(workspaceDependencies("canonical-kernel")).toEqual(["contracts"]);
    expect(workspaceDependencies("contracts")).toEqual([]);
    expect(workspaceDependencies("replay-engine")).toEqual([
      "canonical-kernel",
      "contracts",
    ]);
  });

  it("exposes only snapshot contracts and canonical serialization to storage", () => {
    const files = sourceClosure("service-store/src/index.ts");
    expect(files.filter((file) => !file.startsWith("service-store/"))).toEqual([
      "canonical-kernel/src/canonical-json.ts",
      "canonical-kernel/src/canonical-order.ts",
      "contracts/src/service-snapshot.ts",
    ]);
  });

  it("keeps every kernel entry free of rule and verdict contracts", () => {
    const files = sourceClosure("canonical-kernel/src/index.ts");
    expect(
      files.filter((file) => !file.startsWith("canonical-kernel/")),
    ).toEqual([
      "contracts/src/canonical-decimal-runtime.d.mts",
      "contracts/src/canonical-decimal-runtime.mjs",
    ]);
    const jsonFiles = sourceClosure("canonical-kernel/src/canonical-json.ts");
    for (const file of jsonFiles) {
      const imports = ts.preProcessFile(
        readFileSync(resolve(packages, file), "utf8"),
        true,
        true,
      ).importedFiles;
      expect(imports.every(({ fileName }) => fileName.startsWith("."))).toBe(
        true,
      );
    }
  });

  it("keeps engine runtime source dependencies independent of storage", () => {
    const files = sourceClosure("replay-engine/src/index.ts");
    expect(
      [...new Set(files.map((file) => dirname(file).split("/")[0]))].sort(),
    ).toEqual(["canonical-kernel", "contracts", "replay-engine"]);
  });
});
