"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
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

/**
 * The selection lives outside React so reading it needs no effect and no
 * cascading render. The server snapshot is always English, so server output
 * and the first hydrated render agree; a stored Korean preference is picked up
 * when the store is first subscribed to, which happens after hydration.
 */
let current: Language = "en";
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function adoptStoredLanguage(): void {
  const stored = readStoredLanguage();
  if (stored !== undefined && stored !== current) {
    current = stored;
    emit();
  }
}

function handleStorage(event: StorageEvent): void {
  if (event.key === STORAGE_KEY || event.key === null) adoptStoredLanguage();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener("storage", handleStorage);
    const stored = readStoredLanguage();
    if (stored !== undefined && stored !== current) {
      current = stored;
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
const getServerSnapshot = (): Language => "en";

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
