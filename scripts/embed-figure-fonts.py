#!/usr/bin/env python3
"""Embed the site's own faces in the Korean README figures.

A README figure is an image, so it cannot load the faces the site serves, and
Korean falls to whatever the reader's system supplies. This script cuts the
committed IBM Plex Sans, IBM Plex Sans KR and JetBrains Mono files down to the
characters each Korean figure actually sets, renames the cut faces so they do
not carry the reserved font name "Plex" (SIL OFL 1.1, section 3), and writes
them into the figure as WOFF2 data. Glyphs, metrics, hinting and the licence
records are the committed faces' own. See ADR 0047.

Each figure gets the faces the browser would choose on the site: `.s` text is
set in IBM Plex Sans with Hangul falling through to IBM Plex Sans KR, and `.m`
text in JetBrains Mono with the same Hangul fallback. Weights resolve the way
CSS resolves them against the weights that are committed.

Run it after changing the words of a Korean figure:

    python3 -m pip install fonttools==4.65.0 brotli==1.2.0
    pnpm diagram:fonts

The output is byte-for-byte reproducible from the committed faces.
`entry-point-diagrams.test.ts` fails when a figure sets a character that the
embedded face and weight the site would draw it in does not hold.
"""

from __future__ import annotations

import base64
import hashlib
import io
import re
import sys
import xml.etree.ElementTree as ET
from collections.abc import Callable
from importlib import metadata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SVG = "{http://www.w3.org/2000/svg}"
TOOL_VERSIONS = (("fonttools", "4.65.0"), ("brotli", "1.2.0"))

# Figure, and the fragment file its generator reads, if it has one.
FIGURES = [
    ("docs/assets/worked-case.ko.svg", "docs/assets/fonts/worked-case.ko.faces.svg"),
    ("docs/assets/layer-separation.ko.svg", None),
    ("docs/assets/design.ko.svg", None),
]

LATIN = {
    400: "apps/web/src/fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2",
    500: "apps/web/src/fonts/ibm-plex-sans/IBMPlexSans-Medium.woff2",
    600: "apps/web/src/fonts/ibm-plex-sans/IBMPlexSans-SemiBold.woff2",
}
HANGUL = {
    400: "apps/web/public/fonts/ibm-plex-sans-kr/IBMPlexSansKR-Regular.woff2",
    500: "apps/web/public/fonts/ibm-plex-sans-kr/IBMPlexSansKR-Medium.woff2",
    600: "apps/web/public/fonts/ibm-plex-sans-kr/IBMPlexSansKR-SemiBold.woff2",
}
MONO = {
    400: "apps/web/src/fonts/jetbrains-mono/JetBrainsMono-Regular.woff2",
    500: "apps/web/src/fonts/jetbrains-mono/JetBrainsMono-Medium.woff2",
    700: "apps/web/src/fonts/jetbrains-mono/JetBrainsMono-Bold.woff2",
}

# The names the cut faces carry, and the families the figures' stacks name first.
FAMILY = {
    "latin": "WeaveTrail Figure Sans",
    "hangul": "WeaveTrail Figure Sans KR",
    "mono": "WeaveTrail Figure Mono",
}
SOURCES = {"latin": LATIN, "hangul": HANGUL, "mono": MONO}

BEGIN = "<!-- embedded faces: begin"
END = "<!-- embedded faces: end -->"


def require_tool_versions(
    version_reader: Callable[[str], str] = metadata.version,
) -> None:
    """Reject generators that cannot reproduce the committed WOFF2 bytes."""
    mismatches = []
    for distribution, expected in TOOL_VERSIONS:
        try:
            actual = version_reader(distribution)
        except metadata.PackageNotFoundError:
            actual = "not installed"
        if actual != expected:
            mismatches.append(f"{distribution} {actual} (expected {expected})")

    if mismatches:
        expected = " ".join(f"{name}=={version}" for name, version in TOOL_VERSIONS)
        raise RuntimeError(
            "diagram font generation requires the declared tool versions; "
            + ", ".join(mismatches)
            + f". Install them with: python3 -m pip install {expected}"
        )


def css_weight(wanted: int, available: list[int]) -> int:
    """The committed weight CSS font matching picks for a requested one."""
    if wanted in available:
        return wanted
    if 400 <= wanted <= 500:
        up = [w for w in available if wanted < w <= 500]
        if up:
            return min(up)
        down = [w for w in available if w < wanted]
        return max(down) if down else min(available)
    if wanted < 400:
        down = [w for w in available if w < wanted]
        return max(down) if down else min(available)
    up = [w for w in available if w > wanted]
    return min(up) if up else max(available)


def class_rules(root: ET.Element) -> list[tuple[str, dict[str, str]]]:
    """Single-class rules in stylesheet order, as class name and declarations."""
    rules = []
    for style in root.iter(f"{SVG}style"):
        for name, body in re.findall(r"\.([\w-]+)\{([^}]*)\}", style.text or ""):
            declarations = {}
            for part in body.split(";"):
                if ":" in part:
                    key, value = part.split(":", 1)
                    declarations[key.strip()] = value.strip()
            rules.append((name, declarations))
    return rules


def set_characters(svg_path: Path) -> dict[tuple[str, int], set[str]]:
    """Characters the figure sets, keyed by stack ("sans" or "mono") and weight."""
    root = ET.parse(svg_path).getroot()
    rules = class_rules(root)
    found: dict[tuple[str, int], set[str]] = {}

    def computed(element: ET.Element, inherited: dict[str, str]) -> dict[str, str]:
        props = dict(inherited)
        for attribute in ("font-weight", "font-family"):
            if element.get(attribute):
                props[attribute] = element.get(attribute)
        classes = (element.get("class") or "").split()
        for name, declarations in rules:
            if name in classes:
                props.update(
                    {k: v for k, v in declarations.items() if k.startswith("font-")}
                )
        return props

    def stack(props: dict[str, str]) -> str:
        return "mono" if "Mono" in props.get("font-family", "").split(",")[0] else "sans"

    def add(text: str | None, props: dict[str, str]) -> None:
        if not text:
            return
        key = (stack(props), int(props.get("font-weight", "400")))
        found.setdefault(key, set()).update(text)

    def walk(element: ET.Element, inherited: dict[str, str], in_text: bool) -> None:
        tag = element.tag.replace(SVG, "")
        if tag in ("title", "desc", "style"):
            return
        props = computed(element, inherited)
        inside = in_text or tag == "text"
        if inside:
            add(element.text, props)
        for child in element:
            walk(child, props, inside)
            if inside:
                add(child.tail, props)

    walk(root, {"font-weight": "400"}, False)
    return found


def cut(source: str, characters: str, family: str, weight: int) -> bytes:
    from fontTools import subset
    from fontTools.ttLib import TTFont

    font = TTFont(ROOT / source, recalcTimestamp=False)
    options = subset.Options()
    options.flavor = "woff2"
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.recalc_timestamp = False
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=characters)
    subsetter.subset(font)

    # Keep the copyright, trademark, vendor, designer and licence records; the
    # font's own names are replaced so the cut face is not presented as "Plex".
    kept = {0, 5, 7, 8, 9, 11, 12, 13, 14}
    names = font["name"]
    names.names = [record for record in names.names if record.nameID in kept]
    postscript = family.replace(" ", "") + f"-W{weight}"
    for name_id, value in (
        (1, family),
        (2, "Regular"),
        (3, postscript),
        (4, f"{family} W{weight}"),
        (6, postscript),
    ):
        names.setName(value, name_id, 3, 1, 0x409)
        names.setName(value, name_id, 1, 0, 0)

    out = io.BytesIO()
    font.flavor = "woff2"
    font.save(out)
    return out.getvalue()


def digest(path: str) -> str:
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def faces_block(svg_path: Path) -> str:
    import fontTools
    from fontTools.ttLib import TTFont

    wanted = set_characters(svg_path)
    latin_cmap = TTFont(ROOT / LATIN[400]).getBestCmap()
    mono_cmap = TTFont(ROOT / MONO[400]).getBestCmap()

    # (role, committed weight) -> characters that face has to draw
    needs: dict[tuple[str, int], set[str]] = {}
    for (stack, weight), characters in wanted.items():
        primary, cmap = ("mono", mono_cmap) if stack == "mono" else ("latin", latin_cmap)
        own = {c for c in characters if ord(c) in cmap}
        fallback = characters - own
        for role, chars in ((primary, own), ("hangul", fallback)):
            if chars:
                resolved = css_weight(weight, sorted(SOURCES[role]))
                needs.setdefault((role, resolved), set()).update(chars)

    lines = [
        f"{BEGIN}",
        "    Written by scripts/embed-figure-fonts.py; do not hand-edit (ADR 0047).",
        "    Cut from the committed faces to the characters this figure sets, renamed so",
        '    the cut faces do not carry the reserved font name "Plex"; SIL OFL 1.1,',
        "    third_party/fonts/{ibm-plex-sans,ibm-plex-sans-kr,jetbrains-mono}/OFL.txt.",
        f"    fontTools {fontTools.version}",
    ]
    for role, weight in sorted(needs):
        source = SOURCES[role][weight]
        lines.append(f"    {FAMILY[role]} {weight}: {source} sha256:{digest(source)}")
    lines.append("  -->")
    lines.append("  <style>")
    for role, weight in sorted(needs):
        data = cut(SOURCES[role][weight], "".join(sorted(needs[(role, weight)])), FAMILY[role], weight)
        encoded = base64.b64encode(data).decode("ascii")
        lines.append(
            f'    @font-face{{font-family:"{FAMILY[role]}";font-weight:{weight};'
            f'src:url(data:font/woff2;base64,{encoded}) format("woff2")}}'
        )
    lines.append("  </style>")
    lines.append(f"  {END}")
    return "  " + "\n".join(lines)


def main() -> int:
    require_tool_versions()
    for figure, fragment in FIGURES:
        path = ROOT / figure
        svg = path.read_text("utf8")
        block = faces_block(path)
        if BEGIN in svg:
            start = svg.index("  " + BEGIN)
            stop = svg.index(END) + len(END)
            svg = svg[:start] + block + svg[stop:]
        else:
            anchor = svg.index("  <defs>")
            svg = svg[:anchor] + block + "\n" + svg[anchor:]
        path.write_text(svg, "utf8")
        print(f"wrote {figure} ({len(svg.encode('utf8'))} bytes)")
        if fragment:
            (ROOT / fragment).parent.mkdir(parents=True, exist_ok=True)
            (ROOT / fragment).write_text(block + "\n", "utf8")
            print(f"wrote {fragment}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
