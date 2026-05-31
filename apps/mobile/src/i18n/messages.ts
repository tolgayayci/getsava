import en from './locales/en.json';
import tr from './locales/tr.json';

export const messages = { en, tr } as const;

export type Locale = keyof typeof messages;
export const LOCALES: readonly Locale[] = ['en', 'tr'];
export const DEFAULT_LOCALE: Locale = 'en';

/** The shape of a complete locale (EN is the source of truth). */
export type Messages = typeof en;

/** Dotted key union derived from the EN message tree — unknown keys fail typecheck. */
type DeepKeys<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${DeepKeys<T[K]>}`;
}[keyof T & string];

export type TranslationKey = DeepKeys<Messages>;
