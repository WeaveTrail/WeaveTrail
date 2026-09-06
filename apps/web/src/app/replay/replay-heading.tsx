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
    label: "Case Replay mode",
    modes: [
      {
        label: "Guided walkthrough",
        href: "/replay?mode=guided",
        guided: true,
        detail:
          "Seven steps through one worked case. Each step states what it demonstrates, what you do to advance it and who acted.",
      },
      {
        label: "Working mode",
        href: "/replay?mode=working",
        guided: false,
        detail:
          "The same case controls without the steps. Choose any committed source, approve it yourself and use the source-order and duplicate variations.",
      },
    ],
  },
  ko: {
    heading: "소스에서 발견까지, 사례를 따라갑니다.",
    lede: "알림 뒤에 있는 체결을 검토하고 그 해석과 범위를 승인한 뒤, 버전이 고정된 코드가 반환한 결과를 확인하세요.",
    label: "사례 리플레이 모드",
    modes: [
      {
        label: "사례 따라가기",
        href: "/replay?mode=guided",
        guided: true,
        detail:
          "하나의 사례를 일곱 단계로 살펴봅니다. 각 단계에서 무엇을 보여주는지, 다음으로 가기 위해 무엇을 하는지, 누가 처리했는지를 안내합니다.",
      },
      {
        label: "워킹 모드",
        href: "/replay?mode=working",
        guided: false,
        detail:
          "단계 안내 없이 같은 사례 제어 기능을 사용합니다. 커밋된 소스를 고르고 직접 승인한 뒤 소스 순서와 중복 변형을 적용할 수 있습니다.",
      },
    ],
  },
};

export function ReplayHeading({ guided }: { guided: boolean }) {
  const text = useCopy(copy);
  return (
    <div className="page-heading">
      <h1>{text.heading}</h1>
      <p>{text.lede}</p>
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
