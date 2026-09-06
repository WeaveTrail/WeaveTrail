"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Language selection for the public surface. English is the server-rendered
 * default, so server output, the behavioural suite and any non-scripting
 * reader all see the same English strings this application has always
 * rendered. A stored Korean preference is applied after hydration.
 */
export type Language = "en" | "ko";

export const LANGUAGES: readonly Language[] = ["en", "ko"];

const STORAGE_KEY = "weavetrail.language";

function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "ko";
}

function readStoredLanguage(): Language | undefined {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

function storeLanguage(language: Language): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // A viewer who blocks site data keeps the language for this page only.
  }
}

interface LanguageState {
  readonly language: Language;
  readonly setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageState | undefined>(undefined);

export function LanguageProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const stored = readStoredLanguage();
    if (stored !== undefined) setLanguageState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    storeLanguage(next);
  }, []);

  const value = useMemo(
    () => ({ language, setLanguage }),
    [language, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * English outside a provider. Server rendering and any component mounted on its
 * own show the English strings this application has always rendered, so no
 * caller is required to supply a provider to stay correct.
 */
const DEFAULT_STATE: LanguageState = {
  language: "en",
  setLanguage: () => undefined,
};

export function useLanguage(): LanguageState {
  return useContext(LanguageContext) ?? DEFAULT_STATE;
}

/** Selects one entry of a translated pair for the active language. */
export function useCopy<T>(entries: Readonly<Record<Language, T>>): T {
  return entries[useLanguage().language];
}
