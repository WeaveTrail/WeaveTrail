import { createHash } from "node:crypto";
import { validTradingDate } from "./derive-fsc-stock-quotes.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fail = () => {
  throw new Error("Invalid complete-series declaration or evidence");
};
function keys(value, expected) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join() !== [...expected].sort().join()
  )
    fail();
}
function count(value) {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) fail();
  return BigInt(value);
}
function timestamp(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    fail();
}

// Closed logical filters. Publisher parameter names are owned by reviewed
// adapters, never supplied as filter fields by the operator.
export function validateCompleteSeriesDeclaration(value) {
  keys(value, [
    "scope",
    "date",
    "filter",
    "pageSize",
    "declaredAt",
    "permission",
  ]);
  if (
    value.scope !== "complete-series" ||
    !validTradingDate(value.date) ||
    count(value.pageSize) < 1n
  )
    fail();
  timestamp(value.declaredAt);
  keys(value.filter, ["kind", "value"]);
  const { kind, value: identifier } = value.filter;
  if (
    !["instrument", "series", "date"].includes(kind) ||
    typeof identifier !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(identifier)
  )
    fail();
  if (kind === "date" && identifier !== value.date) fail();
  keys(value.permission, [
    "status",
    "label",
    "checkedAt",
    "termsUrl",
    "attribution",
  ]);
  const permission = value.permission;
  if (
    permission.status !== "UNRESTRICTED" ||
    [permission.label, permission.termsUrl, permission.attribution].some(
      (text) => typeof text !== "string" || !text.trim(),
    )
  )
    fail();
  timestamp(permission.checkedAt);
  if (
    new URL(permission.termsUrl).protocol !== "https:" ||
    permission.checkedAt > value.declaredAt
  )
    fail();
  return value;
}

function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

// Adapters are repository-reviewed code, not operator/model declarations.
// Only transport/format controls and equality selectors are bound here.
export function completeSeriesRequest(declaration, adapter, pageNumber) {
  validateCompleteSeriesDeclaration(declaration);
  if (count(pageNumber) < 1n) fail();
  const endpoint = new URL(adapter.endpoint);
  if (
    endpoint.protocol !== "https:" ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.username ||
    endpoint.password
  )
    fail();
  const selector =
    declaration.filter.kind === "date"
      ? undefined
      : adapter.selectors[declaration.filter.kind];
  if (declaration.filter.kind !== "date" && !selector) fail();
  const entries = [
    [adapter.dateParameter, declaration.date],
    [adapter.pageParameter, pageNumber],
    [adapter.pageSizeParameter, declaration.pageSize],
    ...(selector ? [[selector, declaration.filter.value]] : []),
  ];
  if (adapter.format)
    entries.push([adapter.format.parameter, adapter.format.value]);
  if (
    entries.some(
      ([key, value]) =>
        typeof key !== "string" ||
        !/^[A-Za-z][A-Za-z0-9_]*$/.test(key) ||
        typeof value !== "string",
    ) ||
    new Set(entries.map(([key]) => key)).size !== entries.length
  )
    fail();
  return freeze({
    endpoint: endpoint.href,
    parameters: Object.fromEntries(entries),
  });
}

export function startCompleteSeries(declaration, adapter) {
  const fixed = freeze(
    structuredClone(validateCompleteSeriesDeclaration(declaration)),
  );
  const requestAdapter = freeze(
    structuredClone({
      endpoint: adapter.endpoint,
      dateParameter: adapter.dateParameter,
      pageParameter: adapter.pageParameter,
      pageSizeParameter: adapter.pageSizeParameter,
      selectors: adapter.selectors,
      format: adapter.format,
    }),
  );
  completeSeriesRequest(fixed, requestAdapter, "1");
  return {
    declaration: fixed,
    requestAdapter,
    pages: [],
    rows: [],
    total: undefined,
  };
}

export function appendCompleteSeriesPage(state, bytes, adapter) {
  // Decoding all returned rows and checking provider success is adapter-owned;
  // adapters must expose the complete item array with no projection/filtering.
  const page = adapter.decodePage(bytes, state.declaration);
  const pageNumber = String(state.pages.length + 1);
  const total = count(page.total);
  if (
    page.pageNumber !== pageNumber ||
    page.pageSize !== state.declaration.pageSize ||
    (state.total !== undefined && state.total !== total)
  )
    throw new Error(
      "Publisher pagination or total changed; stop and re-check the scope",
    );
  const remaining = total - BigInt(state.rows.length);
  const size = count(state.declaration.pageSize);
  const expected = remaining < size ? remaining : size;
  if (
    remaining < 0n ||
    (remaining === 0n && state.pages.length > 0) ||
    !Array.isArray(page.rows) ||
    BigInt(page.rows.length) !== expected
  )
    throw new Error(
      "Publisher total cannot be reconciled with returned rows; stop and re-check the scope",
    );
  for (const row of page.rows) {
    if (
      !row ||
      typeof row !== "object" ||
      Array.isArray(row) ||
      !Object.keys(row).length ||
      Object.values(row).some((value) => typeof value !== "string")
    )
      fail();
  }
  state.total = total;
  for (const row of page.rows) state.rows.push(structuredClone(row));
  state.pages.push({
    file: `page-${pageNumber}.response`,
    request: completeSeriesRequest(
      state.declaration,
      state.requestAdapter,
      pageNumber,
    ),
    rowCount: String(page.rows.length),
    publisherTotal: page.total,
    sha256: digest(bytes),
  });
  return BigInt(state.rows.length) === total;
}

export function finishCompleteSeries(state, retrievedAt) {
  timestamp(retrievedAt);
  if (
    !state.pages.length ||
    BigInt(state.rows.length) !== state.total ||
    retrievedAt < state.declaration.declaredAt ||
    retrievedAt.slice(0, 10) !== state.declaration.declaredAt.slice(0, 10) ||
    retrievedAt.slice(0, 10) !==
      state.declaration.permission.checkedAt.slice(0, 10) ||
    state.declaration.date >= retrievedAt.slice(0, 10).replaceAll("-", "")
  )
    fail();
  const jsonl = state.rows.length
    ? state.rows.map((row) => JSON.stringify(row)).join("\n") + "\n"
    : "";
  return {
    jsonl,
    record: {
      declaration: state.declaration,
      retrievedAt,
      pageCount: String(state.pages.length),
      publisherTotal: String(state.total),
      rowCount: String(state.rows.length),
      pages: state.pages,
      sourceArtifactHash: digest(jsonl),
      // Reserved for future evidence-backed observations; none are inferred.
      publisherObservations: [],
    },
  };
}

// Offline admission check: compare committed bytes against every original page,
// its request, order and reported total, rather than trusting receipt counts.
export function validateCompleteSeriesArtifact(
  record,
  rawPages,
  jsonl,
  adapter,
) {
  keys(record, [
    "declaration",
    "retrievedAt",
    "pageCount",
    "publisherTotal",
    "rowCount",
    "pages",
    "sourceArtifactHash",
    "publisherObservations",
  ]);
  if (
    !Array.isArray(record.publisherObservations) ||
    record.publisherObservations.length
  )
    fail();
  const state = startCompleteSeries(record.declaration, adapter);
  for (const bytes of rawPages) appendCompleteSeriesPage(state, bytes, adapter);
  const expected = finishCompleteSeries(state, record.retrievedAt);
  const equal = (left, right) => {
    if (
      left === null ||
      right === null ||
      typeof left !== "object" ||
      typeof right !== "object"
    )
      return left === right;
    if (Array.isArray(left) !== Array.isArray(right)) return false;
    const keys = Object.keys(left);
    return (
      keys.length === Object.keys(right).length &&
      keys.every(
        (key) => Object.hasOwn(right, key) && equal(left[key], right[key]),
      )
    );
  };
  if (expected.jsonl !== jsonl || !equal(expected.record, record))
    throw new Error(
      "Committed artifact does not match complete-series evidence",
    );
  return expected.record;
}
