import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const webSourceDirectory = resolve(testDirectory, "..");
const webDirectory = resolve(testDirectory, "../..");
const repositoryDirectory = resolve(testDirectory, "../../../..");

const forbiddenProviderVariables = [
  ["AI", "MODE"].join("_"),
  ["AI", "PROVIDER", "BASE", "URL"].join("_"),
  ["AI", "PROVIDER", "API", "KEY"].join("_"),
  ["AI", "PROVIDER", "MODEL"].join("_"),
  ["OPENAI", "API", "KEY"].join("_"),
  ["OPENAI", "MODEL"].join("_"),
  ["DATA", "GO", "KR", "SERVICE", "KEY"].join("_"),
];

const compilerOptions: ts.CompilerOptions = {
  baseUrl: webDirectory,
  jsx: ts.JsxEmit.Preserve,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  paths: { "@/*": ["./src/*"] },
  target: ts.ScriptTarget.ES2022,
};

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return productionSourceFiles(path);
    if (!/\.[cm]?[jt]sx?$/.test(entry.name)) return [];
    if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) return [];
    return [path];
  });
}

function isClientEntry(source: string): boolean {
  return /^\s*["']use client["'];/.test(source);
}

function resolveWorkspaceImport(specifier: string, importer: string) {
  const resolved = ts.resolveModuleName(
    specifier,
    importer,
    compilerOptions,
    ts.sys,
  ).resolvedModule?.resolvedFileName;

  if (!resolved) return undefined;
  const absolute = resolve(resolved);
  if (!absolute.startsWith(`${repositoryDirectory}/`)) return undefined;
  if (absolute.includes("/node_modules/")) return undefined;
  if (/\.d\.[cm]?ts$/.test(absolute)) return undefined;
  return /\.[cm]?[jt]sx?$/.test(extname(absolute)) ? absolute : undefined;
}

function clientModuleGraph(): string[] {
  const sourceFiles = productionSourceFiles(webSourceDirectory);
  const pending = sourceFiles.filter((file) =>
    isClientEntry(readFileSync(file, "utf8")),
  );
  const visited = new Set<string>();

  while (pending.length > 0) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);

    const source = readFileSync(file, "utf8");
    for (const imported of ts.preProcessFile(source, true, true)
      .importedFiles) {
      const dependency = resolveWorkspaceImport(imported.fileName, file);
      if (dependency && !visited.has(dependency)) pending.push(dependency);
    }
  }

  return [...visited].sort();
}

describe("provider client boundary", () => {
  it("keeps every provider configuration name out of the client module graph", () => {
    const clientFiles = clientModuleGraph();
    expect(clientFiles.length).toBeGreaterThan(0);
    expect(clientFiles).toContain(
      resolve(webSourceDirectory, "app/replay/case-replay.tsx"),
    );
    expect(
      clientFiles.some((file) =>
        file.startsWith(resolve(repositoryDirectory, "packages/contracts/src")),
      ),
    ).toBe(true);
    expect(
      clientFiles.some((file) =>
        file.startsWith(
          resolve(repositoryDirectory, "packages/replay-engine/src"),
        ),
      ),
    ).toBe(true);

    for (const file of clientFiles) {
      expect(file).not.toContain("/ai-harness/src/configured-provider");
      expect(file).not.toContain("/lib/mapping-provider");
      const source = readFileSync(file, "utf8");
      for (const variable of forbiddenProviderVariables) {
        expect(source, `${variable} reached ${file}`).not.toContain(variable);
      }
    }
  });
});
