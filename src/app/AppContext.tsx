import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { t, type Locale, type MessageKey } from "../i18n";

interface AppState {
  locale: Locale;
  setLocale: (l: Locale) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  tr: (key: MessageKey, params?: Record<string, string | number>) => string;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }): ReactNode {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem("rr-lang");
    if (saved === "en" || saved === "zh-CN") return saved;
    return navigator.language?.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
  });
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("rr-theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.lang = locale === "zh-CN" ? "zh-CN" : "en";
    localStorage.setItem("rr-lang", locale);
  }, [locale]);

  useEffect(() => {
    if (theme === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    localStorage.setItem("rr-theme", theme);
  }, [theme]);

  const tr = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => t(locale, key, params),
    [locale]
  );

  const value = useMemo<AppState>(
    () => ({
      locale,
      setLocale: setLocaleState,
      theme,
      toggleTheme: () => setTheme((x) => (x === "dark" ? "light" : "dark")),
      tr,
    }),
    [locale, theme, tr]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}
