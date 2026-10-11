import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { matchesGlob, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { configDefaults } from "vitest/config";
import { PROMPT_VERSIONS } from "@weavetrail/contracts";
import vitestConfig from "../../../vitest.config";

const root = new URL("../../../", import.meta.url);
// LF-normalized so a CRLF checkout parses the same tables.
const read = (path: string) =>
  readFileSync(new URL(path, root), "utf8").replace(/\r\n/g, "\n");

const logs = {
  en: {
    path: "docs/AI_FAILURE_LOG.md",
    labels: [
      "Role",
      "Model and version",
      "Run record",
      "Assumption",
      "Counterexample",
      "Fix",
      "Regression test",
      "Status",
    ],
    promptHeading: "## Prompt versions",
    entriesHeading: "## Entries",
    burned: /^(No|Yes)\./,
  },
  ko: {
    path: "docs/AI_FAILURE_LOG.ko.md",
    labels: [
      "역할",
      "모델과 버전",
      "실행 기록",
      "가정",
      "반례",
      "수정",
      "회귀 테스트",
      "상태",
    ],
    promptHeading: "## 프롬프트 버전",
    entriesHeading: "## 항목",
    burned: /^(아니요|예)\./,
  },
} as const;

function tableRows(markdown: string): string[][] {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("|") && !/^\|\s*-/.test(line))
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim()),
    );
}

function entries(markdown: string) {
  const parts = markdown.split(/^### (F-\d{3}): .+$/m);
  const result: { id: string; fields: string[][] }[] = [];
  for (let index = 1; index < parts.length; index += 2) {
    result.push({ id: parts[index]!, fields: tableRows(parts[index + 1]!) });
  }
  return result;
}

function section(markdown: string, heading: string) {
  const start = markdown.indexOf(`\n${heading}\n`);
  expect(start, heading).toBeGreaterThanOrEqual(0);
  const rest = markdown.slice(start + heading.length + 2);
  const end = rest.search(/^ {0,3}## /m);
  return end === -1 ? rest : rest.slice(0, end);
}

const tracked = (pattern: string) =>
  execFileSync("git", ["ls-files", "-z", "--", pattern], {
    cwd: fileURLToPath(root),
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);

// The same collection rule `pnpm test` applies: root include globs minus the
// effective excludes (a configured list replaces Vitest's defaults), over files
// Git tracks.
function collected(path: string) {
  const exclude = vitestConfig.test?.exclude ?? configDefaults.exclude;
  return (
    tracked(path).includes(path) &&
    (vitestConfig.test?.include ?? []).some((glob) =>
      matchesGlob(path, glob),
    ) &&
    !exclude.some((glob) => matchesGlob(path, glob))
  );
}

/**
 * Backstop for the `PROMPT_VERSIONS` registry, whose type `ProviderTrace`
 * enforces at compile time. Resolves every value written to a `promptVersion` property (object literal,
 * shorthand or assignment) and every `*PROMPT_VERSION` declaration in tracked
 * non-test sources through the type checker, so constants and aliases count.
 * Test fixtures are out of scope: they never reach a model.
 * A value that is not wholly a string literal type is reported as unresolved
 * rather than silently skipped; only Zod schema definitions are excluded.
 */
function sourcePromptVersions() {
  const files = ["packages", "apps", "scripts"]
    .flatMap(tracked)
    .filter(
      (file) =>
        /\.[cm]?[jt]sx?$/.test(file) && !/\.test\.[cm]?[jt]sx?$/.test(file),
    )
    // TypeScript reports `/`-separated file names on every platform.
    .map((file) => fileURLToPath(new URL(file, root)).split(sep).join("/"));
  const sources = new Set(files);
  const program = ts.createProgram(files, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    allowJs: true,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
  });
  const checker = program.getTypeChecker();
  const versions = new Set<string>();
  const unresolved: string[] = [];
  // Semantic name, so `promptVersion`, `"promptVersion"` and computed literal
  // keys are treated alike.
  const nameOf = (name: ts.PropertyName | ts.BindingName) => {
    if (
      ts.isIdentifier(name) ||
      ts.isPrivateIdentifier(name) ||
      ts.isStringLiteralLike(name) ||
      ts.isNumericLiteral(name)
    )
      return name.text;
    if (ts.isComputedPropertyName(name)) {
      const type = checker.getTypeAtLocation(name.expression);
      if (type.isStringLiteral()) return type.value;
    }
    return undefined;
  };
  const locate = (node: ts.Node) => {
    const source = node.getSourceFile();
    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    return `${relative(fileURLToPath(root), source.fileName)}:${line + 1}`;
  };
  const valueAssignments = new Set<ts.SyntaxKind>([
    ts.SyntaxKind.EqualsToken,
    ts.SyntaxKind.QuestionQuestionEqualsToken,
    ts.SyntaxKind.BarBarEqualsToken,
    ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ]);
  // `x.promptVersion = ...` and `x["promptVersion"] = ...`.
  const assignedName = (target: ts.Expression) => {
    if (ts.isPropertyAccessExpression(target)) return target.name.text;
    if (ts.isElementAccessExpression(target)) {
      const type = checker.getTypeAtLocation(target.argumentExpression);
      if (type.isStringLiteral()) return type.value;
    }
    return undefined;
  };
  const collect = (node: ts.Node, value: ts.Node) => {
    const type = checker.getTypeAtLocation(value);
    const parts = type.isUnion() ? type.types : [type];
    if (parts.every((part) => part.isStringLiteral())) {
      for (const part of parts)
        versions.add((part as ts.StringLiteralType).value);
    } else if (!type.getProperty("safeParse")) {
      // Fail closed on `string`, `any`, `unknown`, numbers and objects alike.
      // The one explicit exclusion is a Zod schema that validates the field.
      unresolved.push(locate(node));
    }
  };
  for (const source of program.getSourceFiles()) {
    if (!sources.has(source.fileName)) continue;
    const visit = (node: ts.Node): void => {
      if (
        ts.isPropertyAssignment(node) &&
        nameOf(node.name) === "promptVersion"
      )
        collect(node, node.initializer);
      else if (
        ts.isShorthandPropertyAssignment(node) &&
        node.name.text === "promptVersion"
      )
        collect(node, node.name);
      else if (
        (ts.isVariableDeclaration(node) ||
          ts.isPropertyDeclaration(node) ||
          ts.isParameter(node)) &&
        /prompt_?version$/i.test(nameOf(node.name) ?? "") &&
        node.initializer
      )
        // Includes defaults such as `constructor(readonly promptVersion = ...)`.
        collect(node, node.initializer);
      else if (
        ts.isBindingElement(node) &&
        /prompt_?version$/i.test(
          nameOf(node.propertyName ?? node.name) ?? "",
        ) &&
        node.initializer
      )
        // Destructuring defaults: `{ promptVersion = ... }`.
        collect(node, node.initializer);
      else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
        assignedName(node.left) === "promptVersion"
      ) {
        // `=`, `??=`, `||=` and `&&=` write the right-hand value; any other
        // compound write (`+=`) has no static value and fails as unresolved.
        if (valueAssignments.has(node.operatorToken.kind))
          collect(node, node.right);
        else unresolved.push(locate(node));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { versions: [...versions].sort(), unresolved };
}

describe("AI failure log", () => {
  const parsed = Object.fromEntries(
    Object.entries(logs).map(([language, log]) => [
      language,
      entries(read(log.path)),
    ]),
  ) as Record<keyof typeof logs, ReturnType<typeof entries>>;

  it.each(Object.entries(logs))(
    "rejects malformed entry headings in the %s log",
    (_, log) => {
      const markdown = read(log.path);
      // Any heading naming an F entry, at any level or position in the file,
      // must be a complete H3 inside the entries section.
      const fHeadings = markdown
        .split("\n")
        .filter((line) => /^ {0,3}#{1,6}\s*F-/.test(line));
      const lines = section(markdown, log.entriesHeading).split("\n");
      expect(lines.filter((line) => /^ {0,3}#{1,6}\s*F-/.test(line))).toEqual(
        fHeadings,
      );
      // CommonMark ATX headings may be indented up to three spaces.
      const headings = lines.filter((line) => /^ {0,3}#/.test(line));
      expect(headings.length).toBeGreaterThan(0);
      for (const heading of headings)
        expect(heading).toMatch(/^### F-\d{3}: \S.*$/);
      // Setext underlines would turn the preceding line into a heading.
      expect(lines.filter((line) => /^ {0,3}(=+|-+)\s*$/.test(line))).toEqual(
        [],
      );
      expect(entries(read(log.path))).toHaveLength(headings.length);
    },
  );

  it.each(Object.entries(logs))(
    "keeps every %s entry complete and bound to a collected test",
    (_, log) => {
      const list = entries(read(log.path));
      expect(list.length).toBeGreaterThan(0);
      list.forEach(({ id, fields }, index) => {
        expect(id).toBe(`F-${String(index + 1).padStart(3, "0")}`);
        const body = fields.slice(1);
        expect(
          body.map(([label]) => label),
          id,
        ).toEqual(log.labels);
        const values = Object.fromEntries(
          body.map(([label, value]) => [label, value ?? ""]),
        );
        for (const label of log.labels)
          expect(values[label], `${id} ${label}`).not.toBe("");
        expect(values[log.labels[5]], `${id} fix PR`).toMatch(/#\d+/);
        const test = /^`([^`]+)`$/.exec(values[log.labels[6]]!)?.[1];
        expect(test, `${id} regression test`).toMatch(
          /^(packages|apps)\/[\w./-]+\.test\.ts$/,
        );
        expect(existsSync(new URL(test!, root)), `${id} ${test}`).toBe(true);
        expect(collected(test!), `${id} ${test} collected`).toBe(true);
        expect(values[log.labels[7]], `${id} status`).toMatch(
          /^`FIXED`$|^`ACCEPTED_RESIDUAL`: \S/,
        );
      });
    },
  );

  it("keeps the Korean entries aligned with the English record", () => {
    const pick = (list: ReturnType<typeof entries>) =>
      list.map(({ id, fields }) => ({
        id,
        test: fields.at(-2)?.[1],
        status: /^`(\w+)`/.exec(fields.at(-1)?.[1] ?? "")?.[1],
      }));
    expect(pick(parsed.ko)).toEqual(pick(parsed.en));
  });

  const prompts = sourcePromptVersions();

  const registry: string[] = [...PROMPT_VERSIONS].sort();

  it("resolves every source prompt version to a registered string literal", () => {
    expect(prompts.unresolved).toEqual([]);
    expect(prompts.versions.length).toBeGreaterThan(0);
    expect(prompts.versions.filter((v) => !registry.includes(v))).toEqual([]);
  });

  it.each(Object.entries(logs))(
    "lists exactly the registered prompt versions in the %s log",
    (_, log) => {
      const [header, ...rows] = tableRows(
        section(read(log.path), log.promptHeading),
      );
      expect(header).toHaveLength(5);
      for (const row of rows) {
        expect(row, row[0]).toHaveLength(header!.length);
        for (const cell of row) expect(cell, row[0]).not.toBe("");
      }
      const listed = rows.map(([version]) => /^`([^`]+)`$/.exec(version!)?.[1]);
      expect([...listed].sort()).toEqual(registry);
      for (const row of rows) expect(row.at(-1)).toMatch(log.burned);
    },
  );

  it("is linked from the evaluation protocols, READMEs and contribution rules", () => {
    expect(read("docs/EVALUATION.md")).toContain("](AI_FAILURE_LOG.md)");
    expect(read("docs/EVALUATION.ko.md")).toContain("](AI_FAILURE_LOG.ko.md)");
    expect(read("README.md")).toContain("](docs/AI_FAILURE_LOG.md)");
    expect(read("README.ko.md")).toContain("](docs/AI_FAILURE_LOG.ko.md)");
    expect(read("CONTRIBUTING.md")).toContain("](docs/AI_FAILURE_LOG.md)");
  });
});
