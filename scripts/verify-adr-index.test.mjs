import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { validateAdrIndex } from "./verify-adr-index.mjs";

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
