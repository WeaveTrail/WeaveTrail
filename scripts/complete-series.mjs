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

function dateScope(value) {
  if (typeof value === "string") {
    if (!validTradingDate(value)) fail();
    return { begin: value, endExclusive: undefined };
  }
  keys(value, ["kind", "begin", "endExclusive"]);
  if (
    value.kind !== "range" ||
    !validTradingDate(value.begin) ||
    !validTradingDate(value.endExclusive) ||
    value.begin >= value.endExclusive
  )
    fail();
  return { begin: value.begin, endExclusive: value.endExclusive };
}

function publisherObservations(value) {
  if (!Array.isArray(value)) fail();
  for (const observation of value) {
    if (observation?.kind === "RANGE_END_EXCLUSIVE") {
      keys(observation, ["kind", "statement", "evidence", "checkedAt"]);
    } else if (observation?.kind === "ROUNDED_DECIMAL") {
      keys(observation, [
        "kind",
        "column",
        "decimalPlaces",
        "statement",
        "evidence",
        "checkedAt",
      ]);
      if (
        typeof observation.column !== "string" ||
        !/^[A-Za-z][A-Za-z0-9_]*$/.test(observation.column) ||
        typeof observation.decimalPlaces !== "string" ||
        !/^(0|[1-9]\d*)$/.test(observation.decimalPlaces)
      )
        fail();
    } else {
      fail();
    }
    if (
      typeof observation.statement !== "string" ||
      !observation.statement.trim() ||
      typeof observation.evidence !== "string" ||
      !observation.evidence.trim()
    )
      fail();
    timestamp(observation.checkedAt);
  }
  return value;
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
  if (value.scope !== "complete-series" || count(value.pageSize) < 1n) fail();
  const selectedDates = dateScope(value.date);
  timestamp(value.declaredAt);
  keys(value.filter, ["kind", "value"]);
  const { kind, value: identifier } = value.filter;
  const named = ["index", "index-family", "instrument-family"].includes(kind);
  if (
    ![
      "instrument",
      "index",
      "series",
      "date",
      "index-family",
      "instrument-family",
    ].includes(kind) ||
    typeof identifier !== "string" ||
    !(named
      ? /^[\p{L}\p{N}][\p{L}\p{N} ._():+-]{0,127}$/u.test(identifier)
      : /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(identifier))
  )
    fail();
  if (
    kind === "date" &&
    (selectedDates.endExclusive !== undefined || identifier !== value.date)
  )
    fail();
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
  const selectedDates = dateScope(declaration.date);
  const dateEntries = selectedDates.endExclusive
    ? [
        [adapter.rangeParameters?.begin, selectedDates.begin],
        [adapter.rangeParameters?.endExclusive, selectedDates.endExclusive],
      ]
    : [[adapter.dateParameter, selectedDates.begin]];
  const entries = [
    ...dateEntries,
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
      rangeParameters: adapter.rangeParameters,
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
    identityKeys: new Set(),
    total: undefined,
  };
}

export function appendCompleteSeriesPage(state, bytes, adapter) {
  // Decoding all returned rows and checking provider success is adapter-owned;
  // adapters must expose the complete item array with no projection/filtering.
  // Buffer.prototype.slice() aliases its input, unlike Uint8Array.prototype
  // .slice(). Always construct a Uint8Array so offline admission cannot let a
  // decoder mutate the retained response bytes read from disk.
  const page = adapter.decodePage(Uint8Array.from(bytes), state.declaration);
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
  if (page.identityKeys !== undefined) {
    if (
      !Array.isArray(page.identityKeys) ||
      page.identityKeys.length !== page.rows.length ||
      page.identityKeys.some(
        (identity) =>
          typeof identity !== "string" ||
          !identity ||
          state.identityKeys.has(identity),
      )
    )
      throw new Error("Publisher row identity is missing or duplicated");
    page.identityKeys.forEach((identity) => state.identityKeys.add(identity));
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

export function finishCompleteSeries(state, retrievedAt, observations = []) {
  timestamp(retrievedAt);
  publisherObservations(observations);
  const selectedDates = dateScope(state.declaration.date);
  const latestSelectedDate = selectedDates.endExclusive ?? selectedDates.begin;
  const retrievalDate = retrievedAt.slice(0, 10).replaceAll("-", "");
  if (
    !state.pages.length ||
    BigInt(state.rows.length) !== state.total ||
    retrievedAt < state.declaration.declaredAt ||
    retrievedAt.slice(0, 10) !== state.declaration.declaredAt.slice(0, 10) ||
    retrievedAt.slice(0, 10) !==
      state.declaration.permission.checkedAt.slice(0, 10) ||
    latestSelectedDate > retrievalDate ||
    (selectedDates.endExclusive === undefined &&
      latestSelectedDate === retrievalDate)
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
      publisherObservations: structuredClone(observations),
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
  publisherObservations(record.publisherObservations);
  const state = startCompleteSeries(record.declaration, adapter);
  for (const bytes of rawPages) appendCompleteSeriesPage(state, bytes, adapter);
  const expected = finishCompleteSeries(
    state,
    record.retrievedAt,
    record.publisherObservations,
  );
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
