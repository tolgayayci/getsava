import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { type TVars, translate } from './core';
import { DEFAULT_LOCALE, LOCALES, type Locale, type TranslationKey } from './messages';

const STORAGE_KEY = 'sava.locale';

function isLocale(value: string | null | undefined): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}

/** Device locale on first launch — TR device → TR, everything else → EN default. */
function detectDeviceLocale(): Locale {
  const code = Localization.getLocales()[0]?.languageCode;
  return isLocale(code) ? code : DEFAULT_LOCALE;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: TVars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectDeviceLocale);

  // Apply the persisted preference (overrides device default) once on mount.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (isLocale(saved)) {
          setLocaleState(saved);
        }
      })
      .catch(() => {
        // ignore — fall back to the device-detected locale
      });
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (next) => {
        setLocaleState(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      },
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx === null) {
    throw new Error('useTranslation must be used within <I18nProvider>');
  }
  return ctx;
}
