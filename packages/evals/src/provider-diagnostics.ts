import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MAPPING_RUN_OUTPUT_MAX_BYTES } from "@weavetrail/contracts";

/** Explicit local diagnostics only. Never attach this transport to a web route. */
export function diagnosticTransport(
  directory: string,
  transport: typeof fetch = globalThis.fetch,
): typeof fetch {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  return async (url, options) => {
    const response = await transport(url, options);
    if (response.ok || !response.body) return response;
    // Consume the original bounded error stream; return the same bytes to the
    // adapter. Cloning a stalled stream can leave an unbounded tee buffer.
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    const abort = () => {
      void reader.cancel().catch(() => {});
    };
    options?.signal?.addEventListener("abort", abort, { once: true });
    if (options?.signal?.aborted) abort();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAPPING_RUN_OUTPUT_MAX_BYTES) {
          abort();
          writeFileSync(
            resolve(directory, `${randomUUID()}.json`),
            JSON.stringify({
              httpStatus: response.status,
              bodyOmitted: "BODY_TOO_LARGE",
            }) + "\n",
            { flag: "wx", mode: 0o600 },
          );
          return new Response(null, { status: response.status });
        }
        chunks.push(value);
      }
    } finally {
      options?.signal?.removeEventListener("abort", abort);
      abort();
    }
    const bytes = Buffer.concat(chunks);
    writeFileSync(
      resolve(directory, `${randomUUID()}.json`),
      JSON.stringify({
        httpStatus: response.status,
        bodyBase64: bytes.toString("base64"),
      }) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    return new Response(bytes, { status: response.status });
  };
}
