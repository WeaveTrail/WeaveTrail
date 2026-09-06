"use client";

import { createContext, useContext } from "react";

import { type Language } from "../i18n/language";

/**
 * The language the replay surface renders in. `CaseReplay` takes it as a prop
 * so a caller can render one language deliberately, and every component below
 * it — including the machine-value readings — reads that one context rather
 * than the app provider, so the narration and the thing it narrates can never
 * disagree inside a single surface.
 */
export const ReplayLanguageContext = createContext<Language>("en");

export const useReplayLanguage = () => useContext(ReplayLanguageContext);

/** Selects one of a translated pair for the active replay language. */
export const replayText = (language: Language, en: string, ko: string) =>
  language === "ko" ? ko : en;
