"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import React from "react";

const groups = [
  [
    "Investigate",
    [
      ["Overview", "/"],
      ["Guided case", "/replay?mode=guided"],
      ["Case Replay", "/replay"],
    ],
  ],
  [
    "Reference",
    [
      ["Why the gate", "/why"],
      ["Architecture", "/architecture"],
      ["Methodology", "/methodology"],
      ["Evals", "/evals"],
    ],
  ],
] as const;

// Guided and working Case Replay share one route and differ only by the
// presentation query, so the current entry is the path with that query, not the
// path alone. Rendered without it while the query is still unavailable.
export function NavigationLinks({ current }: { current: string | null }) {
  return (
    <nav aria-label="Primary navigation">
      <span className="nav-label">Workbench</span>
      {groups.map(([group, items]) => (
        <div aria-label={group} className="nav-group" key={group} role="group">
          <span aria-hidden="true" className="nav-group-label">
            {group}
          </span>
          {items.map(([label, href]) => (
            <Link
              aria-current={current === href ? "page" : undefined}
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function SiteNavigation() {
  const pathname = usePathname();
  const mode = useSearchParams().get("mode");

  return (
    <NavigationLinks
      current={mode === "guided" ? `${pathname}?mode=guided` : pathname}
    />
  );
}
