import { brotliDecompressSync } from "node:zlib";

/**
 * Reads what the faces embedded in a Korean README figure can actually draw
 * ([ADR 0047](docs/adr/0047-embed-the-site-faces-in-the-korean-figures.md)), so
 * a test checks each run against the glyphs of the face and weight that sets
 * it rather than against a list the embedding script declares about itself.
 * Test support only; nothing the site serves imports it.
 */

/** WOFF2's known-table index for `cmap`, `glyf` and `loca`. */
const CMAP = 0;
const GLYF = 10;
const LOCA = 11;

const readBase128 = (bytes: Uint8Array, at: number) => {
  let value = 0;
  for (let offset = 0; offset < 5; offset += 1) {
    const byte = bytes[at + offset] ?? 0;
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return { value, next: at + offset + 1 };
  }
  throw new Error("Malformed UIntBase128 in a WOFF2 table directory");
};

/** The code points a WOFF2 face maps to a glyph other than `.notdef`. */
export function woff2CodePoints(woff2: Uint8Array): ReadonlySet<number> {
  const header = new DataView(woff2.buffer, woff2.byteOffset, woff2.byteLength);
  if (header.getUint32(0) !== 0x774f4632) throw new Error("Not a WOFF2 face");
  const tableCount = header.getUint16(12);
  const compressedLength = header.getUint32(20);

  let at = 48;
  let cmap: { start: number; length: number } | undefined;
  let offset = 0;
  for (let table = 0; table < tableCount; table += 1) {
    const flags = woff2[at] ?? 0;
    at += 1;
    const index = flags & 0x3f;
    if (index === 0x3f) at += 4;
    const version = flags >> 6;
    const original = readBase128(woff2, at);
    at = original.next;
    let length = original.value;
    const transformed =
      index === GLYF || index === LOCA ? version === 0 : version !== 0;
    if (transformed) {
      const transform = readBase128(woff2, at);
      at = transform.next;
      length = transform.value;
    }
    if (index === CMAP) cmap = { start: offset, length };
    offset += length;
  }
  if (cmap === undefined) throw new Error("The face carries no cmap table");

  const tables = brotliDecompressSync(
    woff2.subarray(at, at + compressedLength),
  );
  const data = new DataView(
    tables.buffer,
    tables.byteOffset + cmap.start,
    cmap.length,
  );
  return cmapCodePoints(data);
}

function cmapCodePoints(cmap: DataView): ReadonlySet<number> {
  const records = cmap.getUint16(2);
  const subtables = new Map<string, number>();
  for (let record = 0; record < records; record += 1) {
    const base = 4 + record * 8;
    subtables.set(
      `${cmap.getUint16(base)}.${cmap.getUint16(base + 2)}`,
      cmap.getUint32(base + 4),
    );
  }
  const chosen =
    subtables.get("3.10") ??
    subtables.get("0.4") ??
    subtables.get("3.1") ??
    subtables.get("0.3");
  if (chosen === undefined) throw new Error("No Unicode cmap subtable");

  const points = new Set<number>();
  const format = cmap.getUint16(chosen);
  if (format === 12) {
    const groups = cmap.getUint32(chosen + 12);
    for (let group = 0; group < groups; group += 1) {
      const base = chosen + 16 + group * 12;
      const first = cmap.getUint32(base);
      const last = cmap.getUint32(base + 4);
      const glyph = cmap.getUint32(base + 8);
      for (let point = first; point <= last; point += 1)
        if (glyph + (point - first) !== 0) points.add(point);
    }
    return points;
  }
  if (format !== 4) throw new Error(`Unsupported cmap format ${format}`);

  const segments = cmap.getUint16(chosen + 6) / 2;
  const ends = chosen + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const ranges = deltas + segments * 2;
  for (let segment = 0; segment < segments; segment += 1) {
    const last = cmap.getUint16(ends + segment * 2);
    const first = cmap.getUint16(starts + segment * 2);
    const delta = cmap.getInt16(deltas + segment * 2);
    const rangeAt = ranges + segment * 2;
    const range = cmap.getUint16(rangeAt);
    for (let point = first; point <= last && point !== 0xffff; point += 1) {
      let glyph: number;
      if (range === 0) glyph = (point + delta) & 0xffff;
      else {
        const raw = cmap.getUint16(rangeAt + range + (point - first) * 2);
        glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
      }
      if (glyph !== 0) points.add(point);
    }
  }
  return points;
}

/** Each `@font-face` a figure embeds, keyed `family|weight`. */
export function embeddedFaces(
  svg: string,
): ReadonlyMap<string, ReadonlySet<number>> {
  const faces = new Map<string, ReadonlySet<number>>();
  for (const [, family, weight, data] of svg.matchAll(
    /@font-face\{font-family:"([^"]+)";font-weight:(\d+);src:url\(data:font\/woff2;base64,([A-Za-z0-9+/=]+)\)/g,
  ))
    faces.set(
      `${family}|${weight}`,
      woff2CodePoints(Buffer.from(data ?? "", "base64")),
    );
  return faces;
}

export interface TextRun {
  readonly stack: "sans" | "mono";
  readonly weight: number;
  readonly text: string;
}

type Properties = Readonly<Record<string, string>>;

const decode = (text: string) =>
  text
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

/**
 * Every run of text the figure sets, with the font stack and weight its
 * classes, their stylesheet order and its ancestors give it — the same
 * resolution `scripts/embed-figure-fonts.py` performs before it cuts.
 */
export function textRuns(svg: string): readonly TextRun[] {
  const rules = [...svg.matchAll(/\.([\w-]+)\{([^}]*)\}/g)].map(
    ([, name, body]) =>
      [
        name ?? "",
        Object.fromEntries(
          (body ?? "")
            .split(";")
            .map((part) => part.split(":"))
            .filter(
              (pair): pair is [string, string] =>
                pair.length >= 2 && (pair[0] ?? "").trim().startsWith("font-"),
            )
            .map(([key, ...value]) => [key.trim(), value.join(":").trim()]),
        ) as Properties,
      ] as const,
  );

  const runs: TextRun[] = [];
  const stack: Properties[] = [{ "font-weight": "400" }];
  let hidden = 0;
  let textDepth = 0;

  for (const [
    token,
    closing,
    tag,
    attributes,
    selfClosing,
    content,
  ] of svg.matchAll(
    /<!--[\s\S]*?-->|<(\/?)([\w:-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g,
  )) {
    if (token.startsWith("<!--")) continue;
    if (content !== undefined) {
      const top = stack[stack.length - 1] ?? {};
      if (hidden === 0 && textDepth > 0)
        runs.push({
          stack: /Mono/.test((top["font-family"] ?? "").split(",")[0] ?? "")
            ? "mono"
            : "sans",
          weight: Number(top["font-weight"] ?? "400"),
          text: decode(content),
        });
      continue;
    }
    const name = tag ?? "";
    const isHidden = ["title", "desc", "style"].includes(name);
    if (closing) {
      stack.pop();
      if (isHidden) hidden -= 1;
      if (name === "text") textDepth -= 1;
      continue;
    }
    const own = Object.fromEntries(
      [...(attributes ?? "").matchAll(/([\w:-]+)="([^"]*)"/g)].map(
        ([, key, value]) => [key ?? "", value ?? ""],
      ),
    );
    const classes = (own.class ?? "").split(/\s+/);
    const properties: Record<string, string> = {
      ...stack[stack.length - 1],
    };
    for (const attribute of ["font-weight", "font-family"])
      if (own[attribute]) properties[attribute] = own[attribute];
    for (const [rule, declarations] of rules)
      if (classes.includes(rule)) Object.assign(properties, declarations);
    if (selfClosing) continue;
    stack.push(properties);
    if (isHidden) hidden += 1;
    if (name === "text") textDepth += 1;
  }
  return runs;
}

/** The committed weight CSS font matching picks for a requested one. */
export function matchedWeight(
  wanted: number,
  available: readonly number[],
): number {
  if (available.includes(wanted)) return wanted;
  const above = available.filter((weight) => weight > wanted);
  const below = available.filter((weight) => weight < wanted);
  if (wanted >= 400 && wanted <= 500) {
    const upTo500 = above.filter((weight) => weight <= 500);
    if (upTo500.length > 0) return Math.min(...upTo500);
    if (below.length > 0) return Math.max(...below);
    return Math.min(...available);
  }
  if (wanted < 400)
    return below.length > 0 ? Math.max(...below) : Math.min(...available);
  return above.length > 0 ? Math.min(...above) : Math.max(...available);
}
