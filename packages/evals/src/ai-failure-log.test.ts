import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { matchesGlob, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { configDefaults } from "vitest/config";
import vitestConfig from "../../../vitest.config";

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

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
  const end = rest.search(/^## /m);
  return end === -1 ? rest : rest.slice(0, end);
}

const tracked = (pattern: string) =>
  execFileSync("git", ["ls-files", "-z", "--", pattern], {
    cwd: fileURLToPath(root),
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);

// The same collection rule `pnpm test` applies: root include globs minus
// Vitest's default excludes, over files Git tracks.
function collected(path: string) {
  return (
    tracked(path).includes(path) &&
    (vitestConfig.test?.include ?? []).some((glob) =>
      matchesGlob(path, glob),
    ) &&
    !configDefaults.exclude.some((glob) => matchesGlob(path, glob))
  );
}

/**
 * Resolves every `promptVersion` value and `*PROMPT_VERSION` declaration in
 * tracked source through the type checker, so constants and aliases count.
 * A value that is not a string literal type is reported as unresolved rather
 * than silently skipped; schema validators (non-string types) are ignored.
 */
function sourcePromptVersions() {
  const files = [...tracked("packages"), ...tracked("apps")]
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .map((file) => fileURLToPath(new URL(file, root)));
  const program = ts.createProgram(files, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
  });
  const checker = program.getTypeChecker();
  const versions = new Set<string>();
  const unresolved: string[] = [];
  const collect = (node: ts.Node, value: ts.Node) => {
    const type = checker.getTypeAtLocation(value);
    const parts = type.isUnion() ? type.types : [type];
    if (parts.every((part) => part.isStringLiteral())) {
      for (const part of parts)
        versions.add((part as ts.StringLiteralType).value);
    } else if (parts.some((part) => part.flags & ts.TypeFlags.StringLike)) {
      const source = node.getSourceFile();
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      unresolved.push(
        `${relative(fileURLToPath(root), source.fileName)}:${line + 1}`,
      );
    }
  };
  for (const source of program.getSourceFiles()) {
    if (!files.includes(source.fileName)) continue;
    const visit = (node: ts.Node): void => {
      if (
        ts.isPropertyAssignment(node) &&
        node.name.getText() === "promptVersion"
      )
        collect(node, node.initializer);
      else if (
        ts.isShorthandPropertyAssignment(node) &&
        node.name.text === "promptVersion"
      )
        collect(node, node.name);
      else if (
        (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) &&
        /prompt_?version$/i.test(node.name.getText()) &&
        node.initializer
      )
        collect(node, node.initializer);
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

  it("resolves every source prompt version to a string literal", () => {
    expect(prompts.unresolved).toEqual([]);
    expect(prompts.versions.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(logs))(
    "lists every source prompt version in the %s log",
    (_, log) => {
      const rows = tableRows(section(read(log.path), log.promptHeading)).slice(
        1,
      );
      const listed = rows.map(([version]) => /^`([^`]+)`$/.exec(version!)?.[1]);
      expect([...listed].sort()).toEqual(prompts.versions);
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
