import fs from "node:fs";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  requiresMappingOverride,
  type ApprovalRecord,
} from "@weavetrail/contracts";
import { committedReplayScenarios } from "@weavetrail/scenarios";
import {
  mappingApprovalArtifact,
  sha256Canonical,
} from "@weavetrail/replay-engine";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * docs/DATA_HANDLING.md states that the application keeps nothing a person
 * types: no store, no file and no log line. The replay route takes a reviewer
 * reference and reasons a person types, so it gets a canary request in every
 * free-text field. Every API route, including one added later, is either given
 * canary requests here or listed as taking no typed text; a new route fails
 * until it is one or the other.
 */

const apiDirectory = dirname(fileURLToPath(import.meta.url));
const webDirectory = resolve(apiDirectory, "../../..");
const repositoryDirectory = resolve(webDirectory, "../..");

const CANARY = "WT-CANARY-PASTED-TEXT-7f3a";

type CanaryRequest = { readonly body: unknown; readonly status: number };

const quotesKey = "actorless-multi-instrument-quotes.jsonl";
const source = committedReplayScenarios[quotesKey];
const proposal = source.mappingProposal;

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

/**
 * Routes that accept text a person types, each with requests carrying the
 * canary in every free-text field. At least one passes validation (HTTP 200),
 * so the run-time check covers the processing path and not only the refusal.
 */
const approvalRequests: Readonly<Record<string, readonly CanaryRequest[]>> = {
  "replay/route.ts": [
    {
      body: {
        scenario: quotesKey,
        mutation: "baseline",
        rows: source.rows,
        mappingApproval: canaryApproval(
          sha256Canonical(mappingApprovalArtifact(proposal)),
          proposal.fields.flatMap((field, index) =>
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
        rows: source.rows,
        mappingApproval: canaryApproval("f".repeat(64), [
          { fieldPath: "fields.0", reason: CANARY },
        ]),
      },
      status: 422,
    },
  ],
};

/**
 * Source that writes to a log, a stream or a file. Network calls are left to
 * the run-time check: the mapping adapter the replay route loads may call a
 * configured provider, which fixture mode rules out for these requests.
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

/** API routes that take no text a person types: only a source's name. */
const NO_TYPED_TEXT = ["mapping/route.ts"];

const routes = routeFiles(apiDirectory).map((path) =>
  relative(apiDirectory, path),
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
    /* @vite-ignore */ resolve(apiDirectory, route)
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
    expect(response.text).not.toContain(CANARY);
  }

  for (const spy of [...logs, ...streams])
    expect(carriesCanary(spy.mock.calls)).toBe(false);
  for (const spy of files) expect(spy).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
}

afterEach(() => vi.restoreAllMocks());

describe("every API route is accounted for", () => {
  it("gives each route canary requests or lists it as taking no typed text", () => {
    expect(
      routes.filter(
        (route) =>
          !(route in approvalRequests) && !NO_TYPED_TEXT.includes(route),
      ),
    ).toEqual([]);
  });
});

describe("approval routes keep no reviewer text", () => {
  describe.each(Object.keys(approvalRequests))("%s", (route) => {
    it("loads no store and writes to no log, stream or file", () => {
      const graph = moduleGraph(resolve(apiDirectory, route));
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
      expectNothingRetained(route, approvalRequests[route] ?? []));
  });
});
