import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Every user-visible string lives in a page's typed bilingual copy module
 * (ADR 0076). Markup only reads from it. These checks parse every component
 * file and refuse visible text written into the markup itself, so a string can
 * never exist in one language only or hide where no contributor looks for it.
 */

const webSource = resolve(fileURLToPath(import.meta.url), "../..");

function components(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return components(path);
    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.")
      ? [path]
      : [];
  });
}

/** Attributes a reader sees or hears. */
const VISIBLE_ATTRIBUTES = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "aria-roledescription",
  "aria-valuetext",
  "label",
  "placeholder",
  "title",
]);

/**
 * Contract identifiers and field names carry one spelling in both languages,
 * so they may sit in markup: `REVIEW_REQUIRED`, `sourceArtifactHash`.
 */
const IDENTIFIER = /^(?:[A-Z][A-Z0-9_]*|[a-z]+(?:[A-Z][a-z0-9]*)+)$/;

const hasWords = (text: string) =>
  text
    .split(/[\s·→—:,.()]+/)
    .filter(Boolean)
    .some((token) => /\p{L}/u.test(token) && !IDENTIFIER.test(token));

/** The literals an expression can render as text, following its branches. */
function displayed(expression: ts.Expression): ts.Node[] {
  if (ts.isParenthesizedExpression(expression))
    return displayed(expression.expression);
  if (ts.isConditionalExpression(expression))
    return [
      ...displayed(expression.whenTrue),
      ...displayed(expression.whenFalse),
    ];
  if (ts.isBinaryExpression(expression)) {
    const operator = expression.operatorToken.kind;
    if (
      operator === ts.SyntaxKind.AmpersandAmpersandToken ||
      operator === ts.SyntaxKind.BarBarToken ||
      operator === ts.SyntaxKind.QuestionQuestionToken
    )
      return [...displayed(expression.left), ...displayed(expression.right)];
    if (operator === ts.SyntaxKind.PlusToken)
      return [...displayed(expression.left), ...displayed(expression.right)];
    return [];
  }
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  )
    return hasWords(expression.text) ? [expression] : [];
  if (ts.isTemplateExpression(expression))
    return [expression.head, ...expression.templateSpans.map((s) => s.literal)]
      .map((part) => part.text)
      .some(hasWords)
      ? [expression]
      : [];
  return [];
}

/** Text inside `<code>`, `<kbd>` or `<samp>` is a machine value, not copy. */
function inMachineValue(node: ts.JsxText): boolean {
  const element = node.parent;
  return (
    ts.isJsxElement(element) &&
    ["code", "kbd", "samp"].includes(element.openingElement.tagName.getText())
  );
}

function violations(path: string, text = readFileSync(path, "utf8")) {
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  const report = (node: ts.Node, what: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    found.push(
      `${relative(webSource, path)}:${line + 1} ${what}: ${node
        .getText()
        .replace(/\s+/g, " ")
        .slice(0, 80)}`,
    );
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && hasWords(node.text) && !inMachineValue(node))
      report(node, "text");
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      !ts.isJsxAttribute(node.parent)
    )
      for (const literal of displayed(node.expression)) report(literal, "text");
    if (
      ts.isJsxAttribute(node) &&
      VISIBLE_ATTRIBUTES.has(node.name.getText()) &&
      node.initializer
    ) {
      const value = ts.isJsxExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;
      if (value)
        for (const literal of displayed(value)) report(literal, "attribute");
    }
    // A translated pair written beside the markup is copy outside its module.
    if (ts.isObjectLiteralExpression(node)) {
      const keys = node.properties.map((property) => property.name?.getText());
      if (keys.includes("en") && keys.includes("ko"))
        report(node, "bilingual copy outside a copy module");
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["t", "replayText"].includes(node.expression.text) &&
      node.arguments.some(
        (argument) =>
          ts.isStringLiteralLike(argument) && hasWords(argument.text),
      )
    )
      report(node, "inline translated pair");
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("copy placement", () => {
  const files = components(webSource);

  it("finds the component files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("writes no user-visible string inline in markup", () => {
    expect(files.flatMap((file) => violations(file))).toEqual([]);
  });

  it("reports every kind of inline string, and lets identifiers through", () => {
    const found = violations(
      resolve(webSource, "app/fixture.tsx"),
      `const copy = { en: "Hello", ko: "안녕" };
      export const A = () => (
        <p title="Shown" className="plain">
          Visible {flag ? "Yes" : null} {t("Pair", "쌍")} REVIEW_REQUIRED →{" "}
          <code>pnpm test</code>
        </p>
      );`,
    ).map((violation) =>
      violation.split(": ")[0]!.split(" ").slice(1).join(" "),
    );
    expect(found.sort()).toEqual(
      [
        "attribute",
        "bilingual copy outside a copy module",
        "inline translated pair",
        "text",
        "text",
      ].sort(),
    );
  });
});
