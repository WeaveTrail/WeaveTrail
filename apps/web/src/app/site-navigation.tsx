"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

import { useCopy, type Language } from "./i18n/language";

type NavigationGroups = readonly (readonly [
  string,
  readonly (readonly [string, string])[],
])[];

export const navigationCopy: Readonly<Record<Language, NavigationGroups>> = {
  en: [
    [
      "Start here",
      [
        ["Home", "/"],
        ["Walk through a case", "/replay"],
        ["The 2026-09-03 case", "/case-2026-09-03"],
      ],
    ],
    [
      "About this project",
      [
        ["Where it fits", "/why"],
        ["Architecture", "/architecture"],
        ["Methodology", "/methodology"],
        ["Expected results", "/expectations"],
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
        ["9월 3일 사례", "/case-2026-09-03"],
      ],
    ],
    [
      "프로젝트 소개",
      [
        ["어디에 쓰이나", "/why"],
        ["아키텍처", "/architecture"],
        ["방법론", "/methodology"],
        ["기대 결과", "/expectations"],
        ["평가", "/evals"],
      ],
    ],
  ],
};

export function SiteNavigation() {
  const pathname = usePathname();
  const navigationGroups = useCopy(navigationCopy);

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
