import { readdirSync, readFileSync, statSync } from "node:fs";
import {
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { Parser } from "commonmark";
import ts from "typescript";

const ADR_DIRECTORY = "docs/adr";
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  "coverage",
  "node_modules",
]);
const ADR_HEADING = /^# ADR (\d{4}): /;
const ADR_FILENAME = /^(\d{4})-.+\.md$/;
const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
]);
const parser = new Parser();

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name) ? [] : walk(path);
    }

    return entry.isFile() ? [path] : [];
  });
}

function linkDestinations(markdown) {
  const walker = parser.parse(markdown).walker();
  const targets = [];
  let event;
  while ((event = walker.next())) {
    if (event.entering && ["link", "image"].includes(event.node.type)) {
      targets.push(event.node.destination);
    }
  }
  return targets;
}

// Read documentation comments through the existing TypeScript parser so test
// strings, regex literals and template literals cannot become live references.
function sourceCommentBlocks(file, content) {
  const source = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  const ranges = new Map();
  function visit(node) {
    for (const range of [
      ...(ts.getLeadingCommentRanges(content, node.pos) ?? []),
      ...(ts.getTrailingCommentRanges(content, node.end) ?? []),
    ]) {
      ranges.set(range.pos, range);
    }
    for (const child of node.getChildren(source)) visit(child);
  }
  visit(source);

  const blocks = [];
  let previous;
  for (const { pos: start, end, kind: token } of [...ranges.values()].sort(
    (a, b) => a.pos - b.pos,
  )) {
    const comment = content.slice(start, end);
    const markdown =
      token === ts.SyntaxKind.SingleLineCommentTrivia
        ? comment.slice(2).trimStart()
        : comment
            .slice(2, -2)
            .replace(/^[ \t]*\* ?/gm, "")
            .trim();
    const continuesLineComment =
      previous?.token === ts.SyntaxKind.SingleLineCommentTrivia &&
      token === ts.SyntaxKind.SingleLineCommentTrivia &&
      /^[ \t]*\r?\n[ \t]*$/.test(content.slice(previous.end, start));

    if (continuesLineComment) {
      blocks[blocks.length - 1] += `\n${markdown}`;
    } else {
      blocks.push(markdown);
    }
    previous = { token, end };
  }

  return blocks;
}

function isWithin(directory, path) {
  const child = relative(directory, path);
  return (
    child === "" ||
    (child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child))
  );
}

function adrLinkTarget(file, target, root, markdown) {
  const cleanTarget = target.split(/[?#]/, 1)[0];
  if (
    !cleanTarget ||
    /^[a-z][a-z0-9+.-]*:/i.test(cleanTarget) ||
    cleanTarget.startsWith("//")
  ) {
    return undefined;
  }
  const decoded = decodeURIComponent(cleanTarget);
  const rootRelativeAdr = /^\/docs\/adr(?:\/|$)/i.test(decoded);
  if (decoded.startsWith("/") && !rootRelativeAdr) return undefined;
  const resolved =
    rootRelativeAdr || (!markdown && decoded.startsWith(`${ADR_DIRECTORY}/`))
      ? resolve(root, decoded.replace(/^\//, ""))
      : resolve(dirname(file), decoded);
  const adrDirectory = resolve(root, ADR_DIRECTORY);
  if (resolved === adrDirectory) return undefined;
  // Also check ADR-looking paths that resolve outside the real ADR directory:
  // a nested document's erroneous docs/adr/... link must fail at its actual path.
  return isWithin(adrDirectory, resolved) || /(?:^|\/)adr\//i.test(decoded)
    ? resolved
    : undefined;
}

export function validateAdrIndex(root) {
  const adrDirectory = resolve(root, ADR_DIRECTORY);
  const errors = [];
  const records = new Map();

  for (const file of readdirSync(adrDirectory)) {
    if (extname(file).toLowerCase() !== ".md") continue;

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
    const extension = extname(file).toLowerCase();
    const markdown = extension === ".md";
    if (!markdown && !SOURCE_EXTENSIONS.has(extension)) continue;
    const content = readFileSync(file, "utf8");
    const linkableDocuments = markdown
      ? [content]
      : sourceCommentBlocks(file, content);
    for (const destination of linkableDocuments.flatMap(linkDestinations)) {
      let target;
      try {
        target = adrLinkTarget(file, destination, root, markdown);
      } catch {
        errors.push(
          `${relative(root, file)} has an invalid link URL: ${destination}`,
        );
        continue;
      }
      if (target && !statSync(target, { throwIfNoEntry: false })?.isFile()) {
        errors.push(
          `${relative(root, file)} links to missing ADR ${relative(root, target)}`,
        );
      }
    }
  }

  return errors;
}

export function isDirectExecution(moduleUrl, scriptPath) {
  return (
    typeof scriptPath === "string" &&
    moduleUrl === pathToFileURL(resolve(scriptPath)).href
  );
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  const errors = validateAdrIndex(process.cwd());
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  }
}
