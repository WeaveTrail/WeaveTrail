import { createHash } from "node:crypto";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
  access,
  open,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  validateCompleteSeriesDeclaration,
  validateCompleteSeriesArtifact,
  type CompleteSeriesDeclaration,
  type SeriesAdapter,
} from "../../../scripts/complete-series.mjs";
import {
  retrieveCompleteSeries,
  type SeriesTransport,
} from "../../../scripts/retrieve-complete-series.mjs";
import { deriveFscStockQuotes } from "../../../scripts/derive-fsc-stock-quotes.mjs";
import { verifyPublishedAcquisitions } from "../../../scripts/verify-published-acquisitions.mjs";

// This protocol and every response below are synthetic, not publisher behaviour.
const declaration: CompleteSeriesDeclaration = {
  scope: "complete-series",
  date: "20260903",
  filter: { kind: "series", value: "SYNTHETIC-SERIES" },
  pageSize: "2",
  declaredAt: "2026-09-06T00:00:01.000Z",
  permission: {
    status: "UNRESTRICTED",
    label: "Synthetic permission only",
    checkedAt: "2026-09-06T00:00:00.000Z",
    termsUrl: "https://example.invalid/terms",
    attribution: "Entirely synthetic test data",
  },
};
const rows = ["B", "A", "C", "D", "E"].map((id) => ({
  id,
  date: "20260903",
  price: "900719925474099312345.0100",
  volume: "0001.0",
  note: '합성, "text"\n',
}));
const pageBytes = (
  pageNumber: number,
  total = "5",
  pageRows: Record<string, string>[] = rows.slice(
    (pageNumber - 1) * 2,
    pageNumber * 2,
  ),
) =>
  Buffer.from(
    JSON.stringify(
      { pageNumber: String(pageNumber), pageSize: "2", total, rows: pageRows },
      null,
      2,
    ) + "\n\n",
  );
const adapter: SeriesAdapter = {
  endpoint: "https://example.invalid/series",
  dateParameter: "date",
  pageParameter: "page",
  pageSizeParameter: "size",
  selectors: { instrument: "instrument", series: "series" },
  decodePage: (bytes) =>
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
};
const directories: string[] = [];
beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new Error("Tests must not use network transport"),
  );
});
async function output() {
  const directory = await mkdtemp(
    join(tmpdir(), "weavetrail-complete-series-"),
  );
  directories.push(directory);
  return join(directory, "acquisition");
}
function transport(
  pages = [pageBytes(1), pageBytes(2), pageBytes(3)],
): SeriesTransport {
  return {
    ...adapter,
    secrets: () => ["synthetic-service-key"],
    fetchPage: vi.fn(async (request, options) => {
      expect(options.redirect).toBe("error");
      expect(options.signal).toBeInstanceOf(AbortSignal);
      return new Response(pages[Number(request.parameters.page) - 1]);
    }),
  };
}
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
function clock() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-06T00:00:02.000Z"));
}

describe("complete-series declaration", () => {
  it.each(["instrument", "series", "date"] as const)(
    "admits a single exact %s selector",
    (kind) => {
      expect(
        validateCompleteSeriesDeclaration({
          ...declaration,
          filter: {
            kind,
            value: kind === "date" ? declaration.date : "EXACT-ID",
          },
        }).filter.kind,
      ).toBe(kind);
    },
  );
  it.each(["price", "volume", "outcome", "clpr", "trqu", "result"])(
    "rejects a %s filter",
    (kind) => {
      expect(() =>
        validateCompleteSeriesDeclaration({
          ...declaration,
          filter: { kind, value: "100" },
        }),
      ).toThrow();
    },
  );
  it.each(["A,B", "A|B", ">100", "*", "A B", "[AB]", "A&price=100"])(
    "rejects arbitrary row-set syntax %s",
    (value) => {
      expect(() =>
        validateCompleteSeriesDeclaration({
          ...declaration,
          filter: { kind: "instrument", value },
        }),
      ).toThrow();
    },
  );
  it("rejects undeclared fields, predicate operators, invalid dates and restricted permission", () => {
    for (const candidate of [
      { ...declaration, price: "100" },
      {
        ...declaration,
        filter: { ...declaration.filter, operator: "greaterThan" },
      },
      { ...declaration, date: "20260230" },
      { ...declaration, filter: { kind: "date", value: "20260902" } },
      { ...declaration, pageSize: "0" },
      {
        ...declaration,
        permission: { ...declaration.permission, status: "RESTRICTED" },
      },
      { ...declaration, permission: { ...declaration.permission, label: "" } },
    ])
      expect(() => validateCompleteSeriesDeclaration(candidate)).toThrow();
  });
});

describe("manual complete-series retrieval using synthetic transport", () => {
  it("freezes the declaration before transport and saves every original byte and row in publisher order", async () => {
    clock();
    const path = await output();
    const supplied = structuredClone(declaration);
    const client = transport();
    const fetch = client.fetchPage;
    client.fetchPage = async (request, options) => {
      expect(
        JSON.parse(await readFile(join(path, "declaration.json"), "utf8")),
      ).toEqual(declaration);
      supplied.filter.value = "CHANGED-AFTER-START";
      client.dateParameter = "changed_after_start";
      expect(Object.isFrozen(request.parameters)).toBe(true);
      return fetch(request, options);
    };
    const record = await retrieveCompleteSeries(
      { declaration: supplied, output: path },
      client,
    );
    expect(record.declaration).toEqual(declaration);
    expect(record).toMatchObject({
      pageCount: "3",
      rowCount: "5",
      publisherTotal: "5",
      publisherObservations: [],
    });
    expect(record.pages.map(({ request }) => request.parameters)).toEqual(
      [1, 2, 3].map((page) => ({
        date: "20260903",
        series: "SYNTHETIC-SERIES",
        page: String(page),
        size: "2",
      })),
    );
    const raw = await Promise.all(
      record.pages.map(({ file }) => readFile(join(path, file))),
    );
    expect(raw).toEqual([pageBytes(1), pageBytes(2), pageBytes(3)]);
    const jsonl = await readFile(join(path, "source.jsonl"), "utf8");
    expect(jsonl).toBe(
      rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
    );
    expect(validateCompleteSeriesArtifact(record, raw, jsonl, adapter)).toEqual(
      record,
    );
    expect(
      JSON.parse(await readFile(join(path, "acquisition.json"), "utf8")),
    ).toEqual(record);
  });

  it("rejects a truncated committed source even when its recorded hash and row count are rewritten", async () => {
    clock();
    const path = await output();
    const record = await retrieveCompleteSeries(
      { declaration, output: path },
      transport(),
    );
    const raw = [pageBytes(1), pageBytes(2), pageBytes(3)];
    await writeFile(
      join(path, "synthetic.provenance.json"),
      JSON.stringify({
        artifacts: {
          runtimeJsonl: {
            path: "source.jsonl",
            sha256: record.sourceArtifactHash,
          },
        },
      }),
    );
    await writeFile(
      join(path, "synthetic.acquisition.json"),
      JSON.stringify(record),
    );
    expect(
      await verifyPublishedAcquisitions(path, { [adapter.endpoint]: adapter }),
    ).toBe(1);
    await expect(verifyPublishedAcquisitions(path)).rejects.toThrow(
      "Complete-series artifact requires a committed offline publisher adapter",
    );
    const truncated =
      rows
        .slice(0, -1)
        .map((row) => JSON.stringify(row))
        .join("\n") + "\n";
    await writeFile(join(path, "source.jsonl"), truncated);
    const edited = {
      ...record,
      rowCount: "4",
      sourceArtifactHash: createHash("sha256").update(truncated).digest("hex"),
    };
    // Exercise the same disk admission entry point used for committed sources.
    await writeFile(
      join(path, "synthetic.provenance.json"),
      JSON.stringify({
        artifacts: {
          runtimeJsonl: {
            path: "source.jsonl",
            sha256: edited.sourceArtifactHash,
          },
        },
      }),
    );
    await writeFile(
      join(path, "synthetic.acquisition.json"),
      JSON.stringify(edited),
    );
    await expect(
      verifyPublishedAcquisitions(path, { [adapter.endpoint]: adapter }),
    ).rejects.toThrow(
      "Committed artifact does not match complete-series evidence",
    );
    expect(() =>
      validateCompleteSeriesArtifact(edited, raw, truncated, adapter),
    ).toThrow();
    expect(() =>
      validateCompleteSeriesArtifact(
        record,
        raw.slice(0, -1),
        truncated,
        adapter,
      ),
    ).toThrow();
    expect(() =>
      validateCompleteSeriesArtifact(
        { ...edited, publisherTotal: "4" },
        raw,
        truncated,
        adapter,
      ),
    ).toThrow();
  });

  it.each([2, 5, 6])(
    "cleans partial writes at output %s and permits a clean retry",
    async (position) => {
      clock();
      const path = await output();
      const probePath = join(path, "..", "probe");
      const handle = await open(probePath, "wx");
      const prototype = Object.getPrototypeOf(handle) as {
        writeFile: typeof handle.writeFile;
      };
      const original = prototype.writeFile;
      await handle.close();
      let writes = 0;
      const writeSpy = vi
        .spyOn(prototype, "writeFile")
        .mockImplementation(async function (
          this: typeof handle,
          ...args: Parameters<typeof original>
        ) {
          if (++writes === position) {
            await this.write(Buffer.from("partial"));
            throw new Error("synthetic write failure");
          }
          return original.apply(this, args);
        });
      await expect(
        retrieveCompleteSeries({ declaration, output: path }, transport()),
      ).rejects.toThrow("synthetic write failure");
      await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
      writeSpy.mockRestore();
      expect(
        (
          await retrieveCompleteSeries(
            { declaration, output: path },
            transport(),
          )
        ).rowCount,
      ).toBe("5");
    },
  );

  it("refuses a retrieval that finishes after the verified permission date", async () => {
    clock();
    const client = transport();
    const fetch = client.fetchPage;
    client.fetchPage = async (request, options) => {
      const response = await fetch(request, options);
      if (request.parameters.page === "3")
        vi.setSystemTime(new Date("2026-09-07T00:00:00.000Z"));
      return response;
    };
    const path = await output();
    await expect(
      retrieveCompleteSeries({ declaration, output: path }, client),
    ).rejects.toThrow();
    await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([
    [pageBytes(1), pageBytes(2, "6")],
    [pageBytes(1), pageBytes(2, "5", [rows[2]!])],
    [pageBytes(1), pageBytes(1)],
    [pageBytes(1), pageBytes(2, "5", [])],
    [pageBytes(1), pageBytes(2), pageBytes(3, "5", [rows[4]!, rows[0]!])],
  ])(
    "rejects inconsistent pagination without leaving a complete receipt",
    async (...pages) => {
      clock();
      const path = await output();
      await expect(
        retrieveCompleteSeries({ declaration, output: path }, transport(pages)),
      ).rejects.toThrow("Publisher evidence failed validation");
      await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
    },
  );

  it("permits an honestly empty series and more than the bounded-window ceiling", async () => {
    clock();
    const emptyPath = await output();
    const empty = await retrieveCompleteSeries(
      { declaration, output: emptyPath },
      transport([pageBytes(1, "0", [])]),
    );
    expect(empty).toMatchObject({
      publisherTotal: "0",
      rowCount: "0",
      pageCount: "1",
    });
    expect(await readFile(join(emptyPath, "source.jsonl"), "utf8")).toBe("");
    const many = Array.from({ length: 42 }, (_, index) => ({
      id: `SYNTH-${index}`,
      price: "1.00",
    }));
    const pages = Array.from({ length: 21 }, (_, index) =>
      pageBytes(index + 1, "42", many.slice(index * 2, index * 2 + 2)),
    );
    const record = await retrieveCompleteSeries(
      { declaration, output: await output() },
      transport(pages),
    );
    expect(record).toMatchObject({
      rowCount: "42",
      publisherTotal: "42",
      pageCount: "21",
    });
  });

  it("refuses output collisions and stale permission before consuming a request", async () => {
    clock();
    const path = await output();
    await writeFile(path, "existing bytes");
    const client = transport();
    await expect(
      retrieveCompleteSeries({ declaration, output: path }, client),
    ).rejects.toThrow();
    expect(client.fetchPage).not.toHaveBeenCalled();
    expect(await readFile(path, "utf8")).toBe("existing bytes");
    const stale = {
      ...declaration,
      permission: {
        ...declaration.permission,
        checkedAt: "2026-09-05T00:00:00.000Z",
      },
    };
    await expect(
      retrieveCompleteSeries(
        { declaration: stale, output: await output() },
        client,
      ),
    ).rejects.toThrow("Recheck unrestricted permission");
    expect(client.fetchPage).not.toHaveBeenCalled();
  });

  it.each(["transport", "echo", "http"])(
    "sanitizes %s failure and cleans only newly created outputs",
    async (mode) => {
      clock();
      const client = transport();
      client.fetchPage = vi.fn(async () => {
        if (mode === "transport")
          throw new Error("https://example.invalid/?key=synthetic-service-key");
        return new Response(mode === "echo" ? "synthetic-service-key" : "bad", {
          status: mode === "http" ? 403 : 200,
        });
      });
      const path = await output();
      await expect(
        retrieveCompleteSeries({ declaration, output: path }, client),
      ).rejects.toThrow(
        "Retrieval failed at the HTTP, transport or credential boundary",
      );
      await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
    },
  );
});

describe("committed acquisition scope inventory", () => {
  it("classifies every existing real artifact without rewriting its provenance or source bytes", async () => {
    const directory = new URL("./sources/real/", import.meta.url);
    expect(
      await verifyPublishedAcquisitions(fileURLToPath(directory)),
    ).toBeGreaterThan(0);
    const files = await readdir(directory);
    const provenanceFiles = files.filter((file) =>
      file.endsWith(".provenance.json"),
    );
    expect(provenanceFiles.length).toBeGreaterThan(0);
    for (const file of provenanceFiles) {
      const provenance = JSON.parse(
        await readFile(new URL(file, directory), "utf8"),
      );
      const scope = JSON.parse(
        await readFile(
          new URL(
            file.replace(".provenance.json", ".acquisition.json"),
            directory,
          ),
          "utf8",
        ),
      );
      expect(scope).toEqual({
        scope: "bounded-window",
        provenanceFile: file,
        sourceArtifactHash: provenance.artifacts.runtimeJsonl.sha256,
      });
      const raw = await readFile(
        new URL(provenance.artifacts.rawResponse.path, directory),
      );
      const result = deriveFscStockQuotes(raw, {
        basDt: provenance.basDt,
        market: provenance.request.mrktCls,
      });
      expect(result.rawResponseHash).toBe(
        provenance.artifacts.rawResponse.sha256,
      );
      expect(result.sourceArtifactHash).toBe(scope.sourceArtifactHash);
      expect(result.generatedRowsHash).toBe(
        provenance.artifacts.generatedRows.sha256,
      );
      expect(result.jsonl).toBe(
        await readFile(
          new URL(provenance.artifacts.runtimeJsonl.path, directory),
          "utf8",
        ),
      );
    }
  });
});
