"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const groups = [
  [
    "Investigate",
    [
      ["Overview", "/"],
      ["Case Replay", "/replay"],
    ],
  ],
  [
    "Reference",
    [
      ["Architecture", "/architecture"],
      ["Methodology", "/methodology"],
      ["Evals", "/evals"],
    ],
  ],
] as const;

export function SiteNavigation() {
  const pathname = usePathname();

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
              aria-current={pathname === href ? "page" : undefined}
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
