import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { isDirectExecution, validateAdrIndex } from "./verify-adr-index.mjs";

function fixture(files) {
  const root = mkdtempSync(resolve(tmpdir(), "weavetrail-adr-"));

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
    "README.md": "[ADR 0002](docs/adr/0002-missing.md)\n",
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
    "README.md":
      "[ADR 0002][decision]\n\n[decision]: docs/adr/0002-missing.md\n",
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
