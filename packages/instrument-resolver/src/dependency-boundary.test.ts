import { readFileSync, existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const packages = fileURLToPath(new URL("../../", import.meta.url));
const options: ts.CompilerOptions = {
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowJs: true,
};

describe("instrument resolver package admission", () => {
  it("declares only downward workspace dependencies, including development and type dependencies", () => {
    for (const [name, allowed] of [
      [
        "instrument-resolver",
        ["@weavetrail/canonical-kernel", "@weavetrail/contracts"],
      ],
      ["canonical-kernel", ["@weavetrail/contracts"]],
      ["contracts", []],
    ] as const) {
      const manifest = JSON.parse(
        readFileSync(resolve(packages, name, "package.json"), "utf8"),
      );
      const dependencies = Object.keys({
        ...manifest.dependencies,
        ...manifest.devDependencies,
        ...manifest.optionalDependencies,
        ...manifest.peerDependencies,
      })
        .filter((name) => name.startsWith("@weavetrail/"))
        .sort();
      expect(dependencies).toEqual(allowed);
      expect(manifest.exports["."]).toBe("./src/index.ts");
      expect(manifest.scripts.typecheck).toBe("tsc --noEmit");
    }
  });

  it("follows the exported runtime/type graph through narrow contracts and kernel entries", () => {
    const visited = new Set<string>();
    const external = new Set<string>();
    function visit(file: string) {
      if (visited.has(file)) return;
      visited.add(file);
      for (const { fileName: specifier } of ts.preProcessFile(
        readFileSync(file, "utf8"),
        true,
        true,
      ).importedFiles) {
        if (
          !specifier.startsWith(".") &&
          !specifier.startsWith("@weavetrail/")
        ) {
          external.add(specifier);
          continue;
        }
        const resolved = ts.resolveModuleName(specifier, file, options, ts.sys)
          .resolvedModule?.resolvedFileName;
        if (!resolved) throw new Error(`Unresolved ${specifier} from ${file}`);
        visit(resolved);
        const runtime = resolved.replace(/\.d\.mts$/, ".mjs");
        if (runtime !== resolved && existsSync(runtime)) visit(runtime);
      }
    }
    visit(resolve(packages, "instrument-resolver/src/index.ts"));
    expect(
      [...visited]
        .map((file) => relative(packages, file))
        .filter((file) => !file.startsWith("instrument-resolver/"))
        .sort(),
    ).toEqual([
      "canonical-kernel/src/canonical-hash.ts",
      "canonical-kernel/src/canonical-json.ts",
      "canonical-kernel/src/canonical-order.ts",
      "contracts/src/instrument-resolution.ts",
      "contracts/src/service-snapshot.ts",
    ]);
    expect([...external].sort()).toEqual(["node:crypto", "zod"]);
  });
});
