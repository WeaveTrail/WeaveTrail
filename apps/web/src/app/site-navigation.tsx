"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

const groups = [
  [
    "Start here",
    [
      ["Home", "/"],
      ["Walk through a case", "/replay"],
    ],
  ],
  [
    "About this project",
    [
      ["Why the gate", "/why"],
      ["Architecture", "/architecture"],
      ["Methodology", "/methodology"],
      ["Expected results", "/expectations"],
      ["Evals", "/evals"],
    ],
  ],
] as const;

export function SiteNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation">
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
