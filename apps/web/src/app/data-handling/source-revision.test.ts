import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { DataHandlingContent } from "./data-handling-content";
import { UNPINNED_REVISION, sourceRevision } from "./source-revision";

const commit = "4bedd9f0c3a5e2b1d6f7a8b9c0d1e2f3a4b5c6d7";

describe("data handling evidence links", () => {
  it("pin to the commit a deployment was built from", () => {
    expect(sourceRevision(commit)).toBe(commit);
    const markup = renderToStaticMarkup(
      createElement(DataHandlingContent, { revision: commit }),
    );
    const sources = [
      ...markup.matchAll(/href="(https:\/\/github\.com[^"]*\/blob\/[^"]*)"/g),
    ].map((match) => match[1]);
    expect(sources.length).toBeGreaterThan(0);
    for (const url of sources) expect(url).toContain(`/blob/${commit}/`);
    expect(markup).not.toContain("/blob/main/");
  });

  it("fall back to the integration branch without a full commit SHA", () => {
    for (const value of [undefined, "", "main", "4bedd9f"])
      expect(sourceRevision(value)).toBe(UNPINNED_REVISION);
  });
});
