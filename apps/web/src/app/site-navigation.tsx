"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

import { useCopy, type Language } from "./i18n/language";

type NavigationGroups = readonly (readonly [
  string,
  readonly (readonly [string, string])[],
])[];

const groups: Readonly<Record<Language, NavigationGroups>> = {
  en: [
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
        ["Evals", "/evals"],
      ],
    ],
  ],
  ko: [
    [
      "여기서 시작",
      [
        ["홈", "/"],
        ["사례 따라가기", "/replay"],
      ],
    ],
    [
      "프로젝트 소개",
      [
        ["게이트가 필요한 이유", "/why"],
        ["아키텍처", "/architecture"],
        ["방법론", "/methodology"],
        ["평가", "/evals"],
      ],
    ],
  ],
};

export function SiteNavigation() {
  const pathname = usePathname();
  const navigationGroups = useCopy(groups);

  return (
    <nav aria-label="Primary navigation">
      {navigationGroups.map(([group, items]) => (
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
