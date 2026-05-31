// Compile-time locale parity guard. Each `satisfies` only typechecks if EN and
// TR have the exact same key shape — a missing key in either file fails `tsc`.
// (The `pnpm i18n:check` CI guard enforces the same thing at the value level.)
import en from './locales/en.json';
import tr from './locales/tr.json';

en satisfies typeof tr;
tr satisfies typeof en;
