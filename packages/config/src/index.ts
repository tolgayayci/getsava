export type { CommitValidation } from './commit-message.js';
export { validateCommitMessage } from './commit-message.js';
export type { BannedTerm, BannedTermHit } from './guards/banned-terms.js';
export {
  BANNED_MARKETING_TERMS,
  scanForBannedTerms,
} from './guards/banned-terms.js';
export type { LocaleParityResult } from './guards/i18n-parity.js';
export { checkLocaleParity } from './guards/i18n-parity.js';
