import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  BOUNDARY_FIGURES,
  figureAlt,
  figurePath,
  figureSvg,
} from "./boundary-figures.mjs";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const documents = [...new Set(BOUNDARY_FIGURES.map((figure) => figure.doc))];

/** The Korean documents a figure's alternative text can reach. */
const KOREAN_OF = { "docs/ARCHITECTURE.md": "docs/ARCHITECTURE.ko.md" };

test("gives every figure a unique identifier and nonempty lines", () => {
  const ids = BOUNDARY_FIGURES.map((figure) => figure.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const figure of BOUNDARY_FIGURES) {
    assert.match(figure.id, /^[a-z][a-z0-9-]*$/);
    assert.ok(figure.lines.length > 0, figure.id);
    assert.ok(figure.title.en.length > 0 && figure.title.ko.length > 0);
    assert.ok(
      figure.lines.every((line) => !line.endsWith(" ")),
      `${figure.id} has a trailing space`,
    );
  }
});

test("renders the same bytes every time", () => {
  for (const figure of BOUNDARY_FIGURES)
    assert.equal(figureSvg(figure), figureSvg(figure));
});

test("draws every line inside the figure it sits in", () => {
  for (const figure of BOUNDARY_FIGURES) {
    const svg = figureSvg(figure);
    const width = Number(svg.match(/viewBox="0 0 (\d+)/)?.[1]);
    const columns = Math.max(...figure.lines.map((line) => line.length));
    assert.ok(Number.isFinite(width), figure.id);
    assert.ok(columns * 7.8 + 24 <= width, `${figure.id} overflows its box`);
  }
});

test("carries accessible text in both languages", () => {
  for (const figure of BOUNDARY_FIGURES) {
    const svg = figureSvg(figure);
    const title = svg.match(/<title[^>]*>([^<]+)<\/title>/)?.[1] ?? "";
    const description = svg.match(/<desc[^>]*>([\s\S]*?)<\/desc>/)?.[1] ?? "";
    assert.match(title, /[가-힣]/, `${figure.id} title`);
    assert.match(description, /[가-힣]/, `${figure.id} description`);
    for (const line of figure.lines)
      assert.ok(
        description.includes(
          line
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;"),
        ),
        `${figure.id} description drops a line`,
      );
  }
});

test("keeps every committed figure equal to what the module renders", () => {
  for (const figure of BOUNDARY_FIGURES)
    assert.equal(
      read(figurePath(figure.id)),
      figureSvg(figure),
      `${figurePath(figure.id)} — run \`pnpm figures:build\``,
    );
});

test("embeds each figure once, in the document that owns it", () => {
  for (const document of documents) {
    const markdown = read(document);
    const embedded = [
      ...markdown.matchAll(
        /!\[([^\]]*)\]\(assets\/boundary\/([a-z0-9-]+)\.svg\)/g,
      ),
    ];
    const owned = BOUNDARY_FIGURES.filter((figure) => figure.doc === document);
    assert.deepEqual(
      embedded.map((match) => match[2]),
      owned.map((figure) => figure.id),
      `${document} figure order`,
    );
    for (const [index, match] of embedded.entries())
      assert.equal(match[1], figureAlt(owned[index], "en"), `${document} alt`);

    const korean = KOREAN_OF[document];
    if (!korean) continue;
    const translated = [
      ...read(korean).matchAll(
        /!\[([^\]]*)\]\(assets\/boundary\/([a-z0-9-]+)\.svg\)/g,
      ),
    ];
    assert.deepEqual(
      translated.map((match) => match[2]),
      owned.map((figure) => figure.id),
      `${korean} figure order`,
    );
    for (const [index, match] of translated.entries())
      assert.equal(match[1], figureAlt(owned[index], "ko"), `${korean} alt`);
  }
});

test("keeps Korean alternative text in the deployed vocabulary", () => {
  // Mirrors the surface-vocabulary check the hand-drawn figures answer to.
  const rejected = [
    "소스 행",
    "항목 대응",
    "관문",
    "스키마 매퍼",
    "자료 해시",
    "결정론적 핵심",
    "계좌 집단",
    "사건 제안기",
    "증거 다발",
    "재정의",
  ];
  for (const figure of BOUNDARY_FIGURES)
    for (const word of rejected)
      assert.ok(
        !figureAlt(figure, "ko").includes(word),
        `${figure.id} must not say ${word}`,
      );
});
