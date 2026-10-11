import { createContext, useContext, useState, type ReactNode } from 'react';

export type Locale = 'zh-CN' | 'en';
export type Messages = Record<Locale, Record<string, string>>;

type Preferences = { locale: Locale; setLocale: (value: Locale) => void };
const Context = createContext<Preferences | null>(null);

function saved(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function persist(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Preferences still apply when browser storage is disabled. */ }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>(() => saved('music.locale.v1') === 'en' ? 'en' : 'zh-CN');
  function setLocale(value: Locale) {
    updateLocale(value); persist('music.locale.v1', value); document.documentElement.lang = value;
  }
  return <Context value={{ locale, setLocale }}>{children}</Context>;
}

export function usePreferences() {
  const value = useContext(Context);
  if (!value) throw new Error('PreferencesProvider is required');
  return value;
}

// Every feature owns its dictionary; missing translations fail at the authoring boundary.
export function defineMessages<const T extends Record<string, string>>(zh: T, en: { [K in keyof T]: string }) {
  return { 'zh-CN': zh, en };
}
export function useMessages<T extends Messages>(messages: T): T[Locale] {
  return messages[usePreferences().locale];
}
