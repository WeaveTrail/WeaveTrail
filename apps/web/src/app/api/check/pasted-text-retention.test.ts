import fs from "node:fs";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * docs/DATA_HANDLING.md states that a check route keeps nothing a person sends
 * it: no store, no file, no log line and no outbound call. These checks enforce
 * that for every route under `api/check`, including ones added later, which
 * fail here until they are given a canary request below.
 */

const checkDirectory = dirname(fileURLToPath(import.meta.url));
const webDirectory = resolve(checkDirectory, "../../../..");
const repositoryDirectory = resolve(webDirectory, "../..");

const CANARY = "WT-CANARY-PASTED-TEXT-7f3a";

/** Requests carrying the canary in every free-text field, valid and invalid. */
const canaryRequests: Readonly<Record<string, readonly unknown[]>> = {
  "coverage/route.ts": [
    {
      instrumentId: CANARY,
      dateWindow: { start: "2026-09-03", endInclusive: "2026-09-03" },
      field: CANARY,
      resolution: "DAILY",
      definition: { definitionId: CANARY, version: "1.0" },
    },
    {
      instrumentId: "코스피 200",
      dateWindow: { start: "2026-09-03", endInclusive: "2026-09-03" },
      field: "clpr",
      resolution: "DAILY",
      note: CANARY,
    },
    CANARY,
  ],
};

/**
 * Packages a check route may load. Anything that can persist, log or send a
 * request (a file system, database, network client, provider adapter or
 * logger) has to be added here deliberately, together with the statement in
 * docs/DATA_HANDLING.md that it changes.
 */
const allowedExternalModules = new Set(["zod", "node:crypto", "next/server"]);

/** Workspace packages that store snapshots or call a model provider. */
const forbiddenWorkspaceDirectories = [
  "packages/service-store/",
  "packages/ai-harness/",
];

/** Source that writes to a log, a stream, a file or the network. */
const forbiddenCalls =
  /\bconsole\s*\.|\bprocess\s*\.\s*(?:stdout|stderr)\b|\bfetch\s*\(|\b(?:writeFile|appendFile|createWriteStream)\w*\s*\(/;

const compilerOptions: ts.CompilerOptions = {
  baseUrl: webDirectory,
  jsx: ts.JsxEmit.Preserve,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  paths: { "@/*": ["./src/*"] },
  target: ts.ScriptTarget.ES2022,
};

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return /^route\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

const routes = routeFiles(checkDirectory).map((path) =>
  relative(checkDirectory, path),
);

/** Repository modules a route loads, and every module it loads from outside. */
function moduleGraph(entry: string) {
  const pending = [entry];
  const local = new Set<string>();
  const external = new Set<string>();
  while (pending.length > 0) {
    const file = pending.pop()!;
    if (local.has(file)) continue;
    local.add(file);
    if (file.endsWith(".json")) continue;
    for (const imported of ts.preProcessFile(readFileSync(file, "utf8"), true)
      .importedFiles) {
      const resolved = ts.resolveModuleName(
        imported.fileName,
        file,
        compilerOptions,
        ts.sys,
      ).resolvedModule?.resolvedFileName;
      const absolute = resolved && resolve(resolved);
      if (
        absolute?.startsWith(`${repositoryDirectory}/`) &&
        !absolute.includes("/node_modules/")
      ) {
        if (!/\.d\.[cm]?ts$/.test(absolute)) pending.push(absolute);
      } else external.add(imported.fileName);
    }
  }
  return { local: [...local], external: [...external] };
}

const posted = async (route: string, body: unknown) => {
  const handlers = (await import(
    /* @vite-ignore */ resolve(checkDirectory, route)
  )) as {
    POST?: (request: Request) => Promise<Response>;
  };
  expect(handlers.POST).toBeTypeOf("function");
  const response = await handlers.POST!(
    new Request(`http://localhost/api/check/${dirname(route)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  await response.text();
};

const carriesCanary = (calls: readonly (readonly unknown[])[]) =>
  calls.some((call) =>
    call.some((argument) => {
      if (typeof argument === "string") return argument.includes(CANARY);
      if (argument instanceof Uint8Array)
        return Buffer.from(argument).toString("utf8").includes(CANARY);
      try {
        return JSON.stringify(argument)?.includes(CANARY) ?? false;
      } catch {
        return false;
      }
    }),
  );

afterEach(() => vi.restoreAllMocks());

describe("check routes keep no pasted text", () => {
  it("finds the check routes and a canary request for each", () => {
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.filter((route) => !(route in canaryRequests))).toEqual([]);
  });

  describe.each(routes)("%s", (route) => {
    const graph = moduleGraph(resolve(checkDirectory, route));

    it("loads no store, file writer, logger, network client or model provider", () => {
      expect(
        graph.external.filter((name) => !allowedExternalModules.has(name)),
      ).toEqual([]);
      expect(
        graph.local
          .map((file) => relative(repositoryDirectory, file))
          .filter((file) =>
            forbiddenWorkspaceDirectories.some((directory) =>
              file.startsWith(directory),
            ),
          ),
      ).toEqual([]);
      expect(
        graph.local
          .filter((file) => !file.endsWith(".json"))
          .filter((file) => forbiddenCalls.test(readFileSync(file, "utf8")))
          .map((file) => relative(repositoryDirectory, file)),
      ).toEqual([]);
    });

    it("writes the request to no log, stream or file and sends it nowhere", async () => {
      const logs = (
        ["log", "info", "warn", "error", "debug", "trace"] as const
      ).map((method) => vi.spyOn(console, method));
      const streams = [
        vi.spyOn(process.stdout, "write"),
        vi.spyOn(process.stderr, "write"),
      ];
      const files = [
        vi.spyOn(fs, "writeFileSync"),
        vi.spyOn(fs, "appendFileSync"),
        vi.spyOn(fs, "writeFile"),
        vi.spyOn(fs, "appendFile"),
        vi.spyOn(fs, "createWriteStream"),
        vi.spyOn(fs.promises, "writeFile"),
        vi.spyOn(fs.promises, "appendFile"),
      ];
      const network = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new Error("A check route must not send requests."));

      for (const body of canaryRequests[route] ?? []) await posted(route, body);

      for (const spy of [...logs, ...streams])
        expect(carriesCanary(spy.mock.calls)).toBe(false);
      for (const spy of files) expect(spy).not.toHaveBeenCalled();
      expect(network).not.toHaveBeenCalled();
    });
  });
});
