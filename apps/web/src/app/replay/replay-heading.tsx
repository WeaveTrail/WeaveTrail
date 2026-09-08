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
    lede: "Review the executions behind an alert, approve their interpretation and scope, then inspect the result versioned code returns.",
    guidedLede:
      "Take the reviewer's seat on one case: read the committed source, approve how it is read and how far it is scoped, run it, then trace the result back to the rows it came from.",
    guidedMeta: [
      "Seven steps",
      "about 5–10 minutes",
      "no sign-in",
      "a refresh starts over",
    ],
    label: "Case Replay mode",
    modes: [
      {
        label: "Guided walkthrough",
        href: "/replay?mode=guided",
        guided: true,
        detail:
          "Seven steps through one worked case. Each step states what you do, why the step exists and who acted.",
      },
      {
        label: "Working mode",
        href: "/replay?mode=working",
        guided: false,
        detail:
          "The same case controls without the steps. Choose a reviewer-facing source, approve it yourself, and use the input variations declared for that source.",
      },
    ],
  },
  ko: {
    heading: "의심 사례의 근거를 직접 확인합니다.",
    lede: "알림 뒤에 있는 거래를 검토하고 그 해석과 범위를 승인한 뒤, 버전이 고정된 코드가 반환한 결과를 확인하세요.",
    guidedLede:
      "AI가 내놓은 결과를 그대로 받아들이지 않고, 원본 거래자료부터 판단 근거까지 조사자가 직접 확인하는 과정입니다. 일곱 단계를 순서대로 따라가면 됩니다.",
    guidedMeta: [
      "일곱 단계",
      "약 5~10분",
      "회원가입 없음",
      "새로고침하면 처음부터",
    ],
    label: "사례를 확인하는 방식",
    modes: [
      {
        label: "사례 따라가기",
        href: "/replay?mode=guided",
        guided: true,
        detail:
          "하나의 사례를 일곱 단계로 따라갑니다. 단계마다 무엇을 할지, 왜 하는지, 누가 처리했는지를 알려 줍니다.",
      },
      {
        label: "직접 조작",
        href: "/replay?mode=working",
        guided: false,
        detail:
          "단계 안내 없이 같은 기능을 씁니다. 검토용 원본을 직접 고르고 승인한 뒤, 그 원본에 선언된 입력 변경을 사용합니다.",
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
