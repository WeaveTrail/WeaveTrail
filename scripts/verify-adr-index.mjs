import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import process from "node:process";

const ADR_DIRECTORY = "docs/adr";
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  "coverage",
  "node_modules",
]);
const ADR_HEADING = /^# ADR (\d{4}): /m;
const ADR_FILENAME = /^(\d{4})-.+\.md$/;
const MARKDOWN_LINK = /\[[^\]]+\]\(([^)\s]+)(?:\s+[^)]*)?\)/g;

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name) ? [] : walk(path);
    }

    return entry.isFile() ? [path] : [];
  });
}

function adrLinkTarget(file, target, root) {
  const cleanTarget = target.replace(/^<|>$/g, "").split("#", 1)[0];
  if (!cleanTarget || /^(?:[a-z]+:|\/)/i.test(cleanTarget)) return undefined;

  const resolved = resolve(dirname(file), cleanTarget);
  const adrDirectory = resolve(root, ADR_DIRECTORY);
  return resolved.startsWith(`${adrDirectory}/`) ? resolved : undefined;
}

export function validateAdrIndex(root) {
  const adrDirectory = resolve(root, ADR_DIRECTORY);
  const errors = [];
  const records = new Map();

  for (const file of readdirSync(adrDirectory)) {
    const filename = file.match(ADR_FILENAME);
    if (!filename) continue;

    const path = resolve(adrDirectory, file);
    const heading = readFileSync(path, "utf8").match(ADR_HEADING);
    if (!heading) {
      errors.push(`${relative(root, path)} must begin with an ADR heading`);
      continue;
    }
    if (heading[1] !== filename[1]) {
      errors.push(
        `${relative(root, path)} names ADR ${filename[1]} but its heading names ADR ${heading[1]}`,
      );
    }

    const existing = records.get(heading[1]);
    if (existing) {
      errors.push(
        `ADR ${heading[1]} is used by both ${relative(root, existing)} and ${relative(root, path)}`,
      );
    } else {
      records.set(heading[1], path);
    }
  }

  for (const file of walk(root)) {
    const content = readFileSync(file, "utf8");
    if (content.includes("\0")) continue;

    for (const match of content.matchAll(MARKDOWN_LINK)) {
      const target = adrLinkTarget(file, match[1], root);
      if (target && !existsSync(target)) {
        errors.push(
          `${relative(root, file)} links to missing ADR ${relative(root, target)}`,
        );
      }
    }
  }

  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = validateAdrIndex(process.cwd());
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  }
}
