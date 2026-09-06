import { mkdir, open, unlink, rmdir } from "node:fs/promises";
import { join } from "node:path";
import {
  startCompleteSeries,
  completeSeriesRequest,
  appendCompleteSeriesPage,
  finishCompleteSeries,
} from "./complete-series.mjs";

// Manual API only. No default publisher, credentials or network transport.
// fetchPage receives a credential-free request; the reviewed adapter's
// transport reads any credentials from its environment and must list their
// raw/encoded forms in secrets so echoed data is refused before writing.
export async function retrieveCompleteSeries({ declaration, output }, adapter) {
  const state = startCompleteSeries(declaration, adapter);
  const today = new Date().toISOString().slice(0, 10);
  if (
    state.declaration.permission.checkedAt.slice(0, 10) !== today ||
    state.declaration.declaredAt.slice(0, 10) !== today ||
    state.declaration.declaredAt > new Date().toISOString() ||
    state.declaration.date >= today.replaceAll("-", "")
  )
    throw new Error(
      "Recheck unrestricted permission today and predeclare a completed date",
    );
  let secrets;
  try {
    secrets = adapter.secrets();
  } catch {
    throw new Error("Credential preparation failed");
  }
  if (
    !Array.isArray(secrets) ||
    secrets.some((secret) => typeof secret !== "string" || !secret)
  )
    throw new Error("Invalid credential guard");
  const forms = secrets.flatMap((secret) => [
    secret,
    encodeURIComponent(secret),
    new URLSearchParams({ value: secret }).toString().slice(6),
  ]);
  const guard = (text) => {
    if (
      forms.some((secret) => text.toLowerCase().includes(secret.toLowerCase()))
    )
      throw new Error(
        "Credential disclosure refused; no complete acquisition was saved",
      );
  };
  guard(JSON.stringify(state.declaration));
  // Reserve a new directory before any request; never reuse existing outputs.
  await mkdir(output);
  const created = [];
  const write = async (name, bytes) => {
    const path = join(output, name);
    const file = await open(path, "wx");
    const entry = { path, file, closed: false };
    created.push(entry);
    try {
      await file.writeFile(bytes);
    } finally {
      await file.close();
      entry.closed = true;
    }
  };
  try {
    await write(
      "declaration.json",
      JSON.stringify(state.declaration, null, 2) + "\n",
    );
    let done = false;
    while (!done) {
      if (new Date().toISOString().slice(0, 10) !== today)
        throw new Error(
          "Acquisition crossed the permission verification date; stop and re-check permission",
        );
      const request = completeSeriesRequest(
        state.declaration,
        state.requestAdapter,
        String(state.pages.length + 1),
      );
      guard(JSON.stringify(request));
      let bytes;
      try {
        const response = await adapter.fetchPage(request, {
          signal: AbortSignal.timeout(30_000),
          redirect: "error",
        });
        if (!response.ok || response.redirected)
          throw new Error("HTTP failure");
        bytes = new Uint8Array(await response.arrayBuffer());
        guard(
          new TextDecoder().decode(bytes) +
            "\n" +
            (response.headers.get("content-type") ?? ""),
        );
      } catch {
        throw new Error(
          "Retrieval failed at the HTTP, transport or credential boundary",
        );
      }
      try {
        done = appendCompleteSeriesPage(state, bytes, adapter);
      } catch {
        throw new Error(
          "Publisher evidence failed validation; stop and re-check pagination, total and scope",
        );
      }
      await write(state.pages.at(-1).file, bytes);
    }
    const result = finishCompleteSeries(state, new Date().toISOString());
    guard(result.jsonl);
    guard(JSON.stringify(result.record));
    await write("source.jsonl", result.jsonl);
    // A receipt exists only after every page and the complete derived source.
    await write(
      "acquisition.json",
      JSON.stringify(result.record, null, 2) + "\n",
    );
    return result.record;
  } catch (error) {
    const close = await Promise.allSettled(
      created.filter(({ closed }) => !closed).map(({ file }) => file.close()),
    );
    const cleanup = await Promise.allSettled(
      created.map(({ path }) => unlink(path)),
    );
    try {
      await rmdir(output);
    } catch {
      throw new Error(
        "Acquisition failed; incomplete output directory requires inspection",
      );
    }
    if ([...close, ...cleanup].some((result) => result.status === "rejected"))
      throw new Error("Acquisition failed; cleanup requires inspection");
    throw error;
  }
}
