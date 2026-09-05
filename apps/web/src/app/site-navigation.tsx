"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  ["Overview", "/"],
  ["Architecture", "/architecture"],
  ["Case Replay", "/replay"],
  ["Evals", "/evals"],
  ["Methodology", "/methodology"],
] as const;

export function SiteNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation">
      <span className="nav-label">Workbench</span>
      {navigation.map(([label, href]) => (
        <Link
          aria-current={pathname === href ? "page" : undefined}
          href={href}
          key={href}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
