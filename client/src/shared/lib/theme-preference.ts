export const THEME_PREFERENCE_STORAGE_KEY = "app-theme-preference";

export type ThemePreference = "light" | "dark" | "system";

const VALID: ThemePreference[] = ["light", "dark", "system"];

export function isThemePreference(v: string): v is ThemePreference {
  return (VALID as string[]).includes(v);
}

export function readStoredThemePreference(): ThemePreference | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
    if (raw != null && isThemePreference(raw)) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
  } catch {
    /* ignore */
  }
}

/** Синхронизирует `data-theme`, класс `.dark` (Tailwind) и токены из `design-tokens.css`. */
export function applyThemePreferenceToDocument(
  preference: ThemePreference,
): void {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  if (preference === "light") {
    root.setAttribute("data-theme", "light");
    root.classList.remove("dark");
    return;
  }
  if (preference === "dark") {
    root.setAttribute("data-theme", "dark");
    root.classList.add("dark");
    return;
  }
  root.removeAttribute("data-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (prefersDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

/** Минифицированный IIFE для вставки в `<head>` до отрисовки (убирает FOUC). */
export function themePreferenceInlineScript(): string {
  const k = JSON.stringify(THEME_PREFERENCE_STORAGE_KEY);
  return `(function(){try{var k=${k};var t=localStorage.getItem(k);var d=document.documentElement;if(t==='light'){d.setAttribute('data-theme','light');d.classList.remove('dark');}else if(t==='dark'){d.setAttribute('data-theme','dark');d.classList.add('dark');}else{d.removeAttribute('data-theme');if(window.matchMedia('(prefers-color-scheme: dark)').matches){d.classList.add('dark');}else{d.classList.remove('dark');}}}catch(e){}})();`;
}
