import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  Diagnostic,
  HashRef,
  ProvenanceChip,
  ResultBanner,
  RESULT_BOUNDARY,
} from "./ui";

describe("forensic workbench semantics", () => {
  it.each(["SUPPORTED", "NOT_SUPPORTED", "INCONCLUSIVE"] as const)(
    "renders %s with the interpretation boundary",
    (result) => {
      const markup = renderToStaticMarkup(
        <ResultBanner result={result} rule="RAPID_PRICE_LIFT@1.1">
          evidence
        </ResultBanner>,
      );
      expect(markup).toContain(`data-result="${result}"`);
      expect(markup).toContain(RESULT_BOUNDARY);
    },
  );

  it("keeps a labelled full hash available when display is truncated", () => {
    const value = "0123456789abcdef0123456789abcdef";
    const markup = renderToStaticMarkup(
      createElement(HashRef, { label: "canonicalResultHash", value }),
    );
    expect(markup).toContain("canonicalResultHash");
    expect(markup).toContain(value);
    expect(markup).toContain("01234567…cdef");
  });

  it("preserves lowercase machine values and limits hash label typography", () => {
    const value = "sha256:AbCdEf0123deadbeef";
    const markup = renderToStaticMarkup(
      createElement(HashRef, {
        label: "canonicalResultHash",
        value,
        full: true,
      }),
    );
    const css = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/styles.css"),
      "utf8",
    );

    expect(markup).toContain(`<code title="${value}"`);
    expect(markup).toContain(`>${value}</code>`);
    expect(css).toMatch(
      /\.hash-block\s*>\s*\.hash-ref\s*>\s*span\s*{[^}]*text-transform:\s*uppercase;[^}]*letter-spacing:/s,
    );
    expect(css).not.toMatch(/\.hash-block\s*>\s*span\s*{/);
  });

  it("distinguishes all four provenance sources without color-only labels", () => {
    for (const kind of ["source", "proposed", "approved", "derived"] as const) {
      const markup = renderToStaticMarkup(
        createElement(ProvenanceChip, { kind }),
      );
      expect(markup).toContain(`provenance-${kind}`);
      expect(markup).toContain(kind.toUpperCase());
    }
  });

  it("renders fail-closed refusal separately from results", () => {
    const markup = renderToStaticMarkup(
      <Diagnostic code="REPLAY_REFUSED" field="rows[31]">
        Replay produced no result hash.
      </Diagnostic>,
    );
    expect(markup).toContain('role="alert"');
    expect(markup).not.toContain("result-banner");
  });

  it("rejects prohibited production visual patterns", () => {
    const css = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/styles.css"),
      "utf8",
    );
    expect(css).not.toMatch(/linear-gradient|radial-gradient|scale\(|bounce/i);
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("border: 1px dashed");
  });
});
