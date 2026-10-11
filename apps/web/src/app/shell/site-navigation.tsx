"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useId, useRef, useState } from "react";

import { useCopy } from "../i18n/language";
import { shellCopy } from "./copy";

type MenuKind = "more" | "all";

export function SiteNavigation() {
  const pathname = usePathname();
  const text = useCopy(shellCopy);
  const navigationGroups = text.navigation;
  // The menu belongs to the page it was opened on. Moving to another page,
  // by a link or by history, clears it during render, so returning to that
  // page later does not reopen it.
  const [opened, setOpened] = useState<{
    kind: MenuKind;
    path: string;
  } | null>(null);
  if (opened !== null && opened.path !== pathname) setOpened(null);
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
    const query = window.matchMedia("(max-width: 56rem)");
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
    <nav aria-label={text.navigationLabel} className="site-nav" ref={root}>
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
          aria-label={open === "all" ? text.closeMenu : text.menu}
          className="site-nav-trigger site-nav-menu-button"
          onClick={() => toggle("all")}
          type="button"
        >
          {text.menu}
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
