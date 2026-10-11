"use client";

import React from "react";

import { useCopy, useLanguage } from "../i18n/language";
import { languageOptions, shellCopy } from "./copy";

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const text = useCopy(shellCopy);

  return (
    <div
      aria-label={text.languageLabel}
      className="language-selector"
      role="group"
    >
      {languageOptions.map(({ value, label, short, description }) => (
        <button
          aria-current={language === value ? "true" : undefined}
          aria-label={label}
          key={value}
          lang={value}
          onClick={() => setLanguage(value)}
          title={description}
          type="button"
        >
          <span className="language-full">{label}</span>
          <span aria-hidden="true" className="language-short">
            {short}
          </span>
        </button>
      ))}
    </div>
  );
}
