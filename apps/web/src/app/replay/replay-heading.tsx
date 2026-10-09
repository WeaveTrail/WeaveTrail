"use client";

import Link from "next/link";
import React from "react";

import { useCopy, type Language } from "../i18n/language";

const copy: Readonly<
  Record<
    Language,
    {
      heading: string;
      lede: string;
      guidedLede: string;
      guidedMeta: readonly string[];
      label: string;
      modes: readonly {
        label: string;
        href: string;
        guided: boolean;
        detail: string;
      }[];
    }
  >
> = {
  en: {
    heading: "Follow a case from source to finding.",
    lede: "The same case without the steps: pick a source, approve it, run it.",
    guidedLede:
      "Be the reviewer on one synthetic case: approve what the AI proposed, run it, and trace the result to its rows.",
    guidedMeta: [
      "8 steps · about 5–10 minutes",
      "No sign-in · a refresh starts over",
    ],
    label: "Case Replay mode",
    modes: [
      {
        label: "Guided walkthrough",
        href: "/replay?mode=guided",
        guided: true,
        detail: "Each step says what to do",
      },
      {
        label: "Working mode",
        href: "/replay?mode=working",
        guided: false,
        detail: "The same controls, no steps",
      },
    ],
  },
  ko: {
    heading: "의심 사례의 근거를 직접 확인합니다.",
    lede: "단계 안내 없이 같은 사례를 다룹니다. 원본을 고르고, 승인하고, 실행하세요.",
    guidedLede:
      "합성 사례 하나에서 조사자가 되어, AI의 제안을 승인하고 실행한 뒤 결과를 원본 행까지 따라갑니다.",
    guidedMeta: ["8단계 · 약 5~10분", "회원가입 없음 · 새로고침하면 처음부터"],
    label: "사례를 확인하는 방식",
    modes: [
      {
        label: "사례 따라가기",
        href: "/replay?mode=guided",
        guided: true,
        detail: "단계마다 할 일을 알려 줍니다",
      },
      {
        label: "직접 조작",
        href: "/replay?mode=working",
        guided: false,
        detail: "같은 기능, 단계 안내 없이",
      },
    ],
  },
};

export function ReplayHeading({ guided }: { guided: boolean }) {
  const text = useCopy(copy);
  return (
    <div className="page-heading">
      <h1>{text.heading}</h1>
      <p>{guided ? text.guidedLede : text.lede}</p>
      {guided && (
        <ul className="guided-meta">
          {text.guidedMeta.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      )}
      <nav aria-label={text.label} className="mode-choice">
        {text.modes.map((mode) => (
          <Link
            aria-current={mode.guided === guided ? "page" : undefined}
            href={mode.href}
            key={mode.href}
          >
            <strong>{mode.label}</strong>
            <small>{mode.detail}</small>
          </Link>
        ))}
      </nav>
    </div>
  );
}
