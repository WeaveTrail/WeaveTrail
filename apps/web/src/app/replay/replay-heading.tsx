"use client";

import Link from "next/link";
import React from "react";

import { useCopy } from "../i18n/language";
import { replayCopy } from "./copy";

/**
 * One line for the page and one switch between the modes. In the walkthrough
 * the step rail says what to do, so the heading only says what this is and
 * how long it takes.
 */
export function ReplayHeading({ guided }: { guided: boolean }) {
  const text = useCopy(replayCopy).heading;
  const modes = [
    { label: text.guidedMode, href: "/replay?mode=guided", guided: true },
    { label: text.workingMode, href: "/replay?mode=working", guided: false },
  ];
  return (
    <div className="page-heading replay-heading">
      <div>
        <h1>{text.title}</h1>
        <p>{guided ? text.guidedMeta : text.workingLede}</p>
      </div>
      <nav aria-label={text.modesLabel} className="mode-choice">
        {modes.map((mode) => (
          <Link
            aria-current={mode.guided === guided ? "page" : undefined}
            href={mode.href}
            key={mode.href}
          >
            {mode.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
