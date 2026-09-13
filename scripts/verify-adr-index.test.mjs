import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { isDirectExecution, validateAdrIndex } from "./verify-adr-index.mjs";

const ADR_DIRECTORY = "docs/adr";
const temporaryRoots = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true });
});

test("checks rendered links in nested lists", () => {
  const root = fixture({
    "docs/adr/0001-first.md": "# ADR 0001: First\n",
    "README.md": `- Decisions\n    - [missing](${ADR_DIRECTORY}/9999-missing.md)\n`,
  });
  assert.match(validateAdrIndex(root).join("\n"), /links to missing ADR/);
});

test("resolves Markdown links relative to the containing document", () => {
  const root = fixture({
    "docs/adr/0001-first.md": "# ADR 0001: First\n",
    "docs/guide.md": `[wrong path](${ADR_DIRECTORY}/0001-first.md)\n`,
  });
  assert.match(
    validateAdrIndex(root).join("\n"),
    /docs\/docs\/adr\/0001-first.md/,
  );
});

test("rejects ADR headings after prose, front matter, or a code fence", () => {
  for (const prefix of ["Prose\n", "---\nstatus: accepted\n---\n", "```md\n"]) {
    const root = fixture({
      "docs/adr/0001-first.md": `${prefix}# ADR 0001: First\n`,
    });
    assert.match(
      validateAdrIndex(root).join("\n"),
      /must begin with an ADR heading/,
    );
  }
});

test("accepts balanced parentheses in link destinations", () => {
  const root = fixture({
    "docs/adr/0001-use-(legacy)-format.md": "# ADR 0001: First\n",
    "README.md": `[ADR](${ADR_DIRECTORY}/0001-use-(legacy)-format.md)\n`,
  });
  assert.deepEqual(validateAdrIndex(root), []);
});

test("allows imports without a script argv entry", () => {
  assert.equal(isDirectExecution(import.meta.url, undefined), false);
});

function fixture(files) {
  const root = mkdtempSync(resolve(tmpdir(), "weavetrail-adr-"));
  temporaryRoots.push(root);

  for (const [path, content] of Object.entries(files)) {
    const destination = resolve(root, path);
    mkdirSync(resolve(destination, ".."), { recursive: true });
    writeFileSync(destination, content);
  }

  return root;
}

test("rejects duplicate ADR numbers", () => {
  const root = fixture({
    "docs/adr/0001-first.md": "# ADR 0001: First\n",
    "docs/adr/0001-second.md": "# ADR 0001: Second\n",
  });

  assert.match(validateAdrIndex(root).join("\n"), /ADR 0001 is used by both/);
});

test("rejects links to ADR files that do not exist", () => {
  const root = fixture({
    "docs/adr/0001-first.md": "# ADR 0001: First\n",
    "README.md": `[ADR 0002](${ADR_DIRECTORY}/0002-missing.md)\n`,
  });

  assert.match(validateAdrIndex(root).join("\n"), /links to missing ADR/);
});

test("rejects malformed ADR filenames and still indexes their headings", () => {
  const root = fixture({
    "docs/adr/0001-first.md": "# ADR 0001: First\n",
    "docs/adr/041-second.md": "# ADR 0001: Second\n",
  });

  const errors = validateAdrIndex(root).join("\n");
  assert.match(errors, /041-second\.md must use a four-digit ADR filename/);
  assert.match(errors, /ADR 0001 is used by both/);
});

test("rejects reference-style links to ADR files that do not exist", () => {
  const root = fixture({
    "docs/adr/0001-first.md": "# ADR 0001: First\n",
    "README.md": `[ADR 0002][decision]\n\n[decision]: ${ADR_DIRECTORY}/0002-missing.md\n`,
  });

  assert.match(validateAdrIndex(root).join("\n"), /links to missing ADR/);
});

test("recognizes direct execution when the script path must be URL-encoded", () => {
  assert.equal(
    isDirectExecution(
      "file:///tmp/tools%20with%20space/verify-adr-index.mjs",
      "/tmp/tools with space/verify-adr-index.mjs",
    ),
    true,
  );
});

test("ignores ADR-like links in Markdown code examples", () => {
  const root = fixture({
    "docs/adr/0001-first.md": "# ADR 0001: First\n",
    "README.md": [
      "```md",
      `[fenced ADR](${ADR_DIRECTORY}/9999-removed.md)`,
      "```",
      "",
      `\`[inline ADR](${ADR_DIRECTORY}/9998-removed.md)\``,
      "",
      `    [indented ADR](${ADR_DIRECTORY}/9997-removed.md)`,
      "",
    ].join("\n"),
  });

  assert.deepEqual(validateAdrIndex(root), []);
});

test("resolves repository-root ADR links from nested source files", () => {
  const root = fixture({
    "docs/adr/0001-first.md": "# ADR 0001: First\n",
    "apps/web/example.test.ts": `// [ADR 0002](${ADR_DIRECTORY}/0002-missing.md)\n`,
  });

  assert.match(validateAdrIndex(root).join("\n"), /links to missing ADR/);
});

test("ignores external links with punctuated URI schemes", () => {
  const root = fixture({
    "docs/adr/0001-first.md":
      "# ADR 0001: First\n\n[upstream](git+https://example.com/repo.git)\n",
  });

  assert.deepEqual(validateAdrIndex(root), []);
});

test("ignores query strings and fragments when resolving ADR files", () => {
  const root = fixture({
    "docs/adr/0001-first.md": "# ADR 0001: First\n",
    "README.md": `[ADR 0001](${ADR_DIRECTORY}/0001-first.md?plain=1#decision)\n`,
  });

  assert.deepEqual(validateAdrIndex(root), []);
});

test("preserves valid relative documentation and root-style source references", () => {
  const root = fixture({
    "docs/adr/0001-first.md": "# ADR 0001: First\n",
    "docs/guide.md": "[ADR](adr/0001-first.md)\n",
    "README.md": "[Decisions](docs/adr)\n",
    "apps/web/example.ts": "/** [ADR](docs/adr/0001-first.md) */\nexport {};\n",
  });
  assert.deepEqual(validateAdrIndex(root), []);
});

test("checks links in blockquotes, list continuations and reference labels", () => {
  for (const text of [
    `> [ADR](${ADR_DIRECTORY}/9999-missing.md)`,
    `- Parent\n    - Child\n      [ADR](${ADR_DIRECTORY}/9999-missing.md)`,
    `- Parent\n    - [ADR][]\n\n[adr]: ${ADR_DIRECTORY}/9999-missing.md`,
    `[ADR]\n\n[ADR]: <${ADR_DIRECTORY}/9999-missing.md>`,
    `[**ADR**](${ADR_DIRECTORY}/9999-missing.md "Decision")`,
  ]) {
    const root = fixture({
      "docs/adr/0001-first.md": "# ADR 0001: First\n",
      "README.md": text,
    });
    assert.equal(validateAdrIndex(root).length, 1, text);
  }
});

test("ignores code examples nested in lists and blockquotes", () => {
  for (const text of [
    `> ~~~md\n> [ADR](${ADR_DIRECTORY}/9999-missing.md)\n> ~~~`,
    `- Example\n\n      [ADR](${ADR_DIRECTORY}/9999-missing.md)`,
    `\`\`[ADR](${ADR_DIRECTORY}/9999-missing.md) with a \` character\`\``,
    `[unused]: ${ADR_DIRECTORY}/9999-missing.md`,
  ]) {
    const root = fixture({
      "docs/adr/0001-first.md": "# ADR 0001: First\n",
      "README.md": text,
    });
    assert.deepEqual(validateAdrIndex(root), [], text);
  }
});

test("decodes escaped and percent-encoded destinations to filesystem paths", () => {
  const root = fixture({
    "docs/adr/0001-use-(legacy)-format.md": "# ADR 0001: First\n",
    "docs/adr/0002-with space.md": "# ADR 0002: Second\n",
    "README.md": [
      `[ADR](${ADR_DIRECTORY}/0001-use-\\(legacy\\)-format.md)`,
      `[ADR](${ADR_DIRECTORY}/0001-use-%28legacy%29-format.md)`,
      `[ADR](<${ADR_DIRECTORY}/0002-with space.md>)`,
    ].join("\n"),
  });
  assert.deepEqual(validateAdrIndex(root), []);
});

test("checks real source comments while ignoring literal test data", () => {
  const root = fixture({
    "docs/adr/0001-first.md": "# ADR 0001: First\n",
    "apps/example.test.ts": [
      'const specimen = "[example](docs/adr/9999-missing.md)";',
      "const template = `[example](docs/adr/9998-missing.md)`;",
      "const interpolated = `before ${value} // [example](docs/adr/9994-missing.md)`;",
      "// [leading](docs/adr/9997-missing.md)",
      "const value = 1; // [trailing](docs/adr/9996-missing.md)",
      "/**",
      " * [block](docs/adr/9995-missing.md)",
      " */",
      "export { value };",
    ].join("\n"),
  });
  const errors = validateAdrIndex(root);
  assert.equal(errors.length, 3);
  for (const number of ["9997", "9996", "9995"]) {
    assert.ok(errors.some((error) => error.includes(number)));
  }
});

test("rejects uppercase Markdown extensions without hiding duplicate headings", () => {
  const root = fixture({
    "docs/adr/0001-first.md": "# ADR 0001: First\n",
    "docs/adr/0046-second.MD": "# ADR 0001: Second\n",
  });
  const errors = validateAdrIndex(root).join("\n");
  assert.match(errors, /0046-second\.MD must use a four-digit ADR filename/);
  assert.match(errors, /ADR 0001 is used by both/);
});

test("keeps Markdown state separate between source comment blocks", () => {
  const root = fixture({
    "docs/adr/0001-first.md": "# ADR 0001: First\n",
    "apps/example.ts": [
      "/**",
      " * ```md",
      " */",
      "const first = 1;",
      "/** [ADR](docs/adr/9999-missing.md) */",
      "export { first };",
    ].join("\n"),
  });
  assert.match(validateAdrIndex(root).join("\n"), /9999-missing/);
});

test("groups contiguous line comments into one Markdown block", () => {
  const root = fixture({
    "docs/adr/0001-first.md": "# ADR 0001: First\n",
    "apps/example.ts": [
      "// [ADR][decision]",
      "//",
      "// [decision]: docs/adr/9999-missing.md",
      "export {};",
    ].join("\n"),
  });
  assert.match(validateAdrIndex(root).join("\n"), /9999-missing/);
});

test("rejects case-mistyped ADR directory links", () => {
  const root = fixture({
    "docs/adr/0001-first.md": "# ADR 0001: First\n",
    "README.md": "[ADR](docs/ADR/0001-first.md)\n",
  });
  assert.match(validateAdrIndex(root).join("\n"), /docs\/ADR\/0001-first.md/);
});

test("resolves root-relative ADR links from the repository root", () => {
  const root = fixture({
    "docs/adr/0001-first.md": "# ADR 0001: First\n",
    "README.md": [
      "[existing](/docs/adr/0001-first.md)",
      "[missing](/docs/adr/9999-missing.md)",
      "[external](//example.com/docs/adr/9998-external.md)",
    ].join("\n"),
  });
  const errors = validateAdrIndex(root);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /docs\/adr\/9999-missing.md/);
});
