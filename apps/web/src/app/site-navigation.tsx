"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useId, useRef, useState } from "react";

import { useCopy, type Language } from "./i18n/language";

/** A destination: its label, its route and, for the menu, one line on it. */
type NavigationItem = readonly [label: string, href: string, note: string];
type NavigationGroup = readonly [string, readonly NavigationItem[]];
type NavigationGroups = readonly [NavigationGroup, NavigationGroup];

/**
 * Two groups. The first holds what a visitor comes to do and sits in the bar;
 * the second explains how it works and opens from one menu (ADR 0074).
 */
export const navigationCopy: Readonly<Record<Language, NavigationGroups>> = {
  en: [
    [
      "Explore",
      [
        ["Home", "/", "The question and the answer"],
        ["Model comparison", "/evals", "Every candidate on the held-out set"],
        ["Walk through a case", "/replay", "One case, proposal to source row"],
      ],
    ],
    [
      "How it works",
      [
        ["Where it fits", "/why", "The setting the question comes from"],
        ["Architecture", "/architecture", "Packages, boundaries and data flow"],
        ["Methodology", "/methodology", "How a result is computed and hashed"],
        [
          "Expected results",
          "/expectations",
          "What each committed scenario returns",
        ],
        ["Data handling", "/data-handling", "What is stored and what never is"],
      ],
    ],
  ],
  ko: [
    [
      "둘러보기",
      [
        ["홈", "/", "질문과 답"],
        ["모델 비교", "/evals", "보관 평가 집합의 모든 후보"],
        ["사례 따라가기", "/replay", "제안에서 원본 행까지, 사례 하나"],
      ],
    ],
    [
      "작동 방식",
      [
        ["어디에 쓰이나", "/why", "이 질문이 나온 맥락"],
        ["아키텍처", "/architecture", "패키지, 경계, 데이터 흐름"],
        ["방법론", "/methodology", "결과를 계산하고 해시하는 방법"],
        ["기대 결과", "/expectations", "커밋된 시나리오마다 나오는 결과"],
        ["데이터 처리", "/data-handling", "저장하는 것과 저장하지 않는 것"],
      ],
    ],
  ],
};

const menuCopy: Readonly<Record<Language, { menu: string; close: string }>> = {
  en: { menu: "Menu", close: "Close menu" },
  ko: { menu: "메뉴", close: "메뉴 닫기" },
};

type MenuKind = "more" | "all";

export function SiteNavigation() {
  const pathname = usePathname();
  const navigationGroups = useCopy(navigationCopy);
  const menu = useCopy(menuCopy);
  // The menu belongs to the page it was opened on, so moving to another page
  // closes it without an effect.
  const [opened, setOpened] = useState<{
    kind: MenuKind;
    path: string;
  } | null>(null);
  const open = opened?.path === pathname ? opened.kind : null;
  const toggle = (kind: MenuKind) =>
    setOpened(open === kind ? null : { kind, path: pathname });
  const panelId = useId();
  const root = useRef<HTMLElement>(null);
  const [[, primary], [moreLabel, more]] = navigationGroups;
  const moreIsCurrent = more.some(([, href]) => href === pathname);

  // The bar and the single menu swap at the tablet width, so crossing it
  // closes the menu: an open panel always belongs to a visible trigger.
  useEffect(() => {
    const query = window.matchMedia("(max-width: 52rem)");
    const close = () => setOpened(null);
    query.addEventListener("change", close);
    return () => query.removeEventListener("change", close);
  }, []);

  // Escape or a press outside closes the menu; Escape returns focus to the
  // button that opened it.
  useEffect(() => {
    if (open === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpened(null);
      root.current
        ?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')
        ?.focus();
    }
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpened(null);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <nav aria-label="Primary navigation" className="site-nav" ref={root}>
      <ul className="site-nav-bar">
        {primary.map(([label, href]) => (
          <li key={href}>
            <Link
              aria-current={pathname === href ? "page" : undefined}
              href={href}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="site-nav-more">
        <button
          aria-controls={panelId}
          aria-expanded={open === "more"}
          className="site-nav-trigger"
          data-current={moreIsCurrent}
          onClick={() => toggle("more")}
          type="button"
        >
          {moreLabel}
        </button>
        <button
          aria-controls={panelId}
          aria-expanded={open === "all"}
          aria-label={open === "all" ? menu.close : menu.menu}
          className="site-nav-trigger site-nav-menu-button"
          onClick={() => toggle("all")}
          type="button"
        >
          {menu.menu}
        </button>
        <div className="site-nav-panel" hidden={open === null} id={panelId}>
          {navigationGroups.map(([group, items], index) => (
            <div
              aria-label={group}
              className="site-nav-group"
              data-group={index === 0 ? "primary" : "more"}
              key={group}
              role="group"
            >
              <span aria-hidden="true" className="site-nav-group-label">
                {group}
              </span>
              <ul>
                {items.map(([label, href, note]) => (
                  <li key={href}>
                    <Link
                      aria-current={pathname === href ? "page" : undefined}
                      href={href}
                      onClick={() => setOpened(null)}
                    >
                      {label}
                      <small>{note}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}
