"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyThemePreferenceToDocument,
  readStoredThemePreference,
  writeStoredThemePreference,
  THEME_PREFERENCE_STORAGE_KEY,
  type ThemePreference,
} from "./theme-preference";

type ThemePreferenceContextValue = {
  /** `false` до гидрации: не опирайтесь на `preference` для SSR-разметки. */
  ready: boolean;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
};

const ThemePreferenceContext =
  createContext<ThemePreferenceContextValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    queueMicrotask(() => {
      const stored = readStoredThemePreference() ?? "system";
      setPreferenceState(stored);
      applyThemePreferenceToDocument(stored);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    applyThemePreferenceToDocument(preference);
  }, [preference, ready]);

  useEffect(() => {
    if (preference !== "system") {
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemePreferenceToDocument("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_PREFERENCE_STORAGE_KEY) {
        return;
      }
      const next = readStoredThemePreference() ?? "system";
      setPreferenceState(next);
      applyThemePreferenceToDocument(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    writeStoredThemePreference(next);
    setPreferenceState(next);
    applyThemePreferenceToDocument(next);
  }, []);

  const value = useMemo(
    () => ({ ready, preference, setPreference }),
    [ready, preference, setPreference],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceContextValue {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) {
    throw new Error(
      "useThemePreference must be used within ThemePreferenceProvider",
    );
  }
  return ctx;
}
