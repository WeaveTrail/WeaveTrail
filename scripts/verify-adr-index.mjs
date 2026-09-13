import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

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
const MARKDOWN_REFERENCE_DEFINITION =
  /^\s{0,3}\[[^\]]+\]:\s*(?:<([^>\n]+)>|(\S+))/gm;

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name) ? [] : walk(path);
    }

    return entry.isFile() ? [path] : [];
  });
}

function withoutMarkdownCode(content) {
  let fence;
  const visibleLines = content.split(/\r?\n/).map((line) => {
    const candidate = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);

    if (fence) {
      if (
        candidate &&
        candidate[1][0] === fence.character &&
        candidate[1].length >= fence.length &&
        candidate[2].trim() === ""
      ) {
        fence = undefined;
      }
      return "";
    }

    if (candidate) {
      fence = {
        character: candidate[1][0],
        length: candidate[1].length,
      };
      return "";
    }

    if (/^(?: {4}|\t)/.test(line)) return "";

    return line;
  });

  return visibleLines.join("\n").replace(/(`+)[\s\S]*?\1/g, "");
}

function adrLinkTarget(file, target, root) {
  const cleanTarget = target.replace(/^<|>$/g, "").split(/[?#]/, 1)[0];
  if (!cleanTarget || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(cleanTarget)) {
    return undefined;
  }

  const resolved = cleanTarget.startsWith(`${ADR_DIRECTORY}/`)
    ? resolve(root, cleanTarget)
    : resolve(dirname(file), cleanTarget);
  const adrDirectory = resolve(root, ADR_DIRECTORY);
  const pathFromAdrDirectory = relative(adrDirectory, resolved);
  return pathFromAdrDirectory &&
    !pathFromAdrDirectory.startsWith("..") &&
    !isAbsolute(pathFromAdrDirectory)
    ? resolved
    : undefined;
}

export function validateAdrIndex(root) {
  const adrDirectory = resolve(root, ADR_DIRECTORY);
  const errors = [];
  const records = new Map();

  for (const file of readdirSync(adrDirectory)) {
    if (!file.endsWith(".md")) continue;

    const filename = file.match(ADR_FILENAME);
    const path = resolve(adrDirectory, file);
    if (!filename) {
      errors.push(`${relative(root, path)} must use a four-digit ADR filename`);
    }

    const heading = readFileSync(path, "utf8").match(ADR_HEADING);
    if (!heading) {
      errors.push(`${relative(root, path)} must begin with an ADR heading`);
      continue;
    }
    if (filename && heading[1] !== filename[1]) {
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
    const linkableContent = file.endsWith(".md")
      ? withoutMarkdownCode(content)
      : content;

    for (const match of linkableContent.matchAll(MARKDOWN_LINK)) {
      const target = adrLinkTarget(file, match[1], root);
      if (target && !existsSync(target)) {
        errors.push(
          `${relative(root, file)} links to missing ADR ${relative(root, target)}`,
        );
      }
    }

    for (const match of linkableContent.matchAll(
      MARKDOWN_REFERENCE_DEFINITION,
    )) {
      const target = adrLinkTarget(file, match[1] ?? match[2], root);
      if (target && !existsSync(target)) {
        errors.push(
          `${relative(root, file)} links to missing ADR ${relative(root, target)}`,
        );
      }
    }
  }

  return errors;
}

export function isDirectExecution(moduleUrl, scriptPath) {
  return moduleUrl === pathToFileURL(resolve(scriptPath)).href;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  const errors = validateAdrIndex(process.cwd());
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  }
}
