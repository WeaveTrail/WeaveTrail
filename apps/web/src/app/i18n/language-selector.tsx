"use client";

import React from "react";

import { useLanguage, type Language } from "./language";

const OPTIONS: readonly (readonly [Language, string, string])[] = [
  ["en", "English", "Show this site in English"],
  ["ko", "한국어", "이 사이트를 한국어로 봅니다"],
];

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();

  return (
    <div aria-label="Language" className="language-selector" role="group">
      {OPTIONS.map(([value, label, description]) => (
        <button
          aria-current={language === value ? "true" : undefined}
          key={value}
          lang={value}
          onClick={() => setLanguage(value)}
          title={description}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
