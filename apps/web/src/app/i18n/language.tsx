"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

/**
 * A saved choice wins. Otherwise use the browser's language setting, falling
 * back to Korean when it is unavailable.
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

/**
 * The selection lives outside React so reading it needs no effect and no
 * cascading render. The server snapshot is always English, so server output
 * and the first hydrated render agree; a stored Korean preference is picked up
 * when the store is first subscribed to, which happens after hydration.
 */
let current: Language = "ko";
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function systemLanguage(): Language {
  const languages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  return languages.some((language) => language.toLowerCase().startsWith("ko"))
    ? "ko"
    : "en";
}

function adoptLanguagePreference(): void {
  const preferred = readStoredLanguage() ?? systemLanguage();
  if (preferred !== current) {
    current = preferred;
    emit();
  }
}

function handleStorage(event: StorageEvent): void {
  if (event.key === STORAGE_KEY || event.key === null)
    adoptLanguagePreference();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener("storage", handleStorage);
    const preferred = readStoredLanguage() ?? systemLanguage();
    if (preferred !== current) {
      current = preferred;
      queueMicrotask(emit);
    }
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

const getSnapshot = (): Language => current;
const getServerSnapshot = (): Language => "ko";

function setLanguage(next: Language): void {
  // Persist before the equality check. Another tab may have written a different
  // value that this tab has not adopted, and choosing the language already
  // shown here must still mean "this one" on the next load.
  storeLanguage(next);
  if (next === current) return;
  current = next;
  emit();
}

const LanguageContext = createContext<LanguageState | undefined>(undefined);

export function LanguageProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const language = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Standalone components keep the historical English surface; the application
 * always mounts a provider, whose fallback is Korean.
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
