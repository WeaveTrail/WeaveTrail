"use client";

import React from "react";

import { useCopy } from "../i18n/language";
import { caseCopy } from "./case-copy";

export function CaseHeading() {
  const text = useCopy(caseCopy);
  return (
    <div className="page-heading">
      <h1>{text.heading}</h1>
      <p>{text.lede}</p>
      <ul className="guided-meta">
        {text.meta.map((entry) => (
          <li key={entry}>{entry}</li>
        ))}
      </ul>
    </div>
  );
}
