import fs from "node:fs";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  requiresMappingOverride,
  type ApprovalRecord,
} from "@weavetrail/contracts";
import {
  fscStockQuotesProposal,
  publishedReplaySources,
} from "@weavetrail/published-data";
import {
  mappingApprovalArtifact,
  sha256Canonical,
} from "@weavetrail/replay-engine";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

import { publishedCaseProposal } from "../../../lib/published-case";

/**
 * docs/DATA_HANDLING.md states that a check route keeps nothing a person sends
 * it: no store, no file, no log line and no outbound call. These checks enforce
 * that for every route under `api/check`, including ones added later, which
 * fail here until they are given a canary request below. The two approval
 * routes take a reviewer reference and reasons a person types, so the run-time
 * check covers them too.
 */

const checkDirectory = dirname(fileURLToPath(import.meta.url));
const webDirectory = resolve(checkDirectory, "../../../..");
const repositoryDirectory = resolve(webDirectory, "../..");

const CANARY = "WT-CANARY-PASTED-TEXT-7f3a";

type CanaryRequest = { readonly body: unknown; readonly status: number };

/**
 * Requests carrying the canary in every free-text field. Each route needs at
 * least one that passes validation (HTTP 200), so the run-time check covers
 * the processing path and not only the refusal.
 */
const canaryRequests: Readonly<Record<string, readonly CanaryRequest[]>> = {
  "coverage/route.ts": [
    {
      body: {
        instrumentId: CANARY,
        dateWindow: { start: "2026-09-03", endInclusive: "2026-09-03" },
        field: CANARY,
        resolution: "DAILY",
        definition: { definitionId: CANARY, version: "1.0.0" },
      },
      status: 200,
    },
    {
      // Covered scope, so the definition lookup runs as well.
      body: {
        instrumentId: "코스피 200",
        dateWindow: { start: "2026-09-03", endInclusive: "2026-09-03" },
        field: "clpr",
        resolution: "DAILY",
        definition: { definitionId: CANARY, version: "1.0.0" },
      },
      status: 200,
    },
    {
      body: {
        instrumentId: "코스피 200",
        dateWindow: { start: "2026-09-03", endInclusive: "2026-09-03" },
        field: "clpr",
        resolution: "DAILY",
        note: CANARY,
      },
      status: 422,
    },
    { body: CANARY, status: 422 },
  ],
};

const quotesKey = "real/fsc-stock-quotes-20260903.jsonl";

/** An approval whose reviewer reference and every reason carry the canary. */
const canaryApproval = (
  approvedArtifactHash: string,
  overrides: ApprovalRecord["overrides"] = [],
): ApprovalRecord => ({
  approvedArtifactHash,
  reviewerRef: CANARY,
  decision: "APPROVED",
  overrides,
  approvedAt: "2026-09-07T00:00:00Z",
});

/** Routes outside `api/check` that accept text a person types. */
const approvalRequests: Readonly<Record<string, readonly CanaryRequest[]>> = {
  "../replay/route.ts": [
    {
      body: {
        scenario: quotesKey,
        mutation: "baseline",
        rows: publishedReplaySources[quotesKey].rows,
        mappingApproval: canaryApproval(
          sha256Canonical(mappingApprovalArtifact(fscStockQuotesProposal)),
          fscStockQuotesProposal.fields.flatMap((field, index) =>
            requiresMappingOverride(field)
              ? [{ fieldPath: `fields.${index}`, reason: CANARY }]
              : [],
          ),
        ),
      },
      status: 200,
    },
    {
      body: {
        scenario: quotesKey,
        mutation: "baseline",
        rows: publishedReplaySources[quotesKey].rows,
        mappingApproval: canaryApproval("f".repeat(64), [
          { fieldPath: "fields.0", reason: CANARY },
        ]),
      },
      status: 422,
    },
  ],
  "../case-2026-09-03/route.ts": [
    {
      body: {
        approval: canaryApproval(
          sha256Canonical(publishedCaseProposal().proposal),
        ),
      },
      status: 200,
    },
    {
      body: {
        approval: canaryApproval("f".repeat(64), [
          { fieldPath: "fields.0", reason: CANARY },
        ]),
      },
      status: 422,
    },
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

/**
 * The same calls without `fetch`: the mapping adapter an approval route loads
 * may call a configured provider, which the run-time check rules out for these
 * requests in fixture mode.
 */
const storageOrLogCalls =
  /\bconsole\s*\.|\bprocess\s*\.\s*(?:stdout|stderr)\b|\b(?:writeFile|appendFile|createWriteStream)\w*\s*\(/;

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
    new Request(`http://localhost/api/${dirname(route)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  return { status: response.status, text: await response.text() };
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

async function expectNothingRetained(
  route: string,
  requests: readonly CanaryRequest[],
  echoesScope: boolean,
) {
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
    .mockRejectedValue(new Error("This route must not send requests."));

  expect(requests.some(({ status }) => status === 200)).toBe(true);
  for (const { body, status } of requests) {
    const response = await posted(route, body);
    expect(response.status).toBe(status);
    // A processed check returns its validated scope to the caller only.
    if (echoesScope && status === 200) expect(response.text).toContain(CANARY);
  }

  for (const spy of [...logs, ...streams])
    expect(carriesCanary(spy.mock.calls)).toBe(false);
  for (const spy of files) expect(spy).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
}

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

    it("writes the request to no log, stream or file and sends it nowhere", () =>
      expectNothingRetained(route, canaryRequests[route] ?? [], true));
  });
});

describe("approval routes keep no reviewer text", () => {
  describe.each(Object.keys(approvalRequests))("%s", (route) => {
    it("loads no store and writes to no log, stream or file", () => {
      const graph = moduleGraph(resolve(checkDirectory, route));
      expect(
        graph.local
          .map((file) => relative(repositoryDirectory, file))
          .filter((file) => file.startsWith("packages/service-store/")),
      ).toEqual([]);
      expect(
        graph.local
          .filter((file) => !file.endsWith(".json"))
          .filter((file) => storageOrLogCalls.test(readFileSync(file, "utf8")))
          .map((file) => relative(repositoryDirectory, file)),
      ).toEqual([]);
    });

    it("writes reviewer text to no log, stream or file and sends it nowhere", () =>
      expectNothingRetained(route, approvalRequests[route] ?? [], false));
  });
});
