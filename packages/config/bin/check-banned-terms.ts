#!/usr/bin/env tsx
/**
 * CI guard: marketing language.
 *
 * Scans user-facing string sources (i18n locale files + disclaimer copy banks)
 * for banned marketing terms. Exits non-zero on any hit. Passes trivially while
 * those files do not yet exist (the scaffold state) — the locale + disclaimer
 * stories (YK-494, T1.D4) populate them.
 */
import { readFileSync } from 'node:fs';
import { scanForBannedTerms } from '../src/guards/banned-terms.js';
import { listFiles } from './lib/walk.js';

const USER_FACING = [/locales[/\\][^/\\]+\.json$/, /disclaimers?[^/\\]*\.ts$/];

function main(): void {
  const files = listFiles(process.cwd()).filter((file) =>
    USER_FACING.some((pattern) => pattern.test(file)),
  );

  let hitCount = 0;
  for (const file of files) {
    const hits = scanForBannedTerms(readFileSync(file, 'utf8'));
    for (const hit of hits) {
      hitCount += 1;
      console.error(`✖ banned term "${hit.term}" in ${file}\n    …${hit.excerpt.trim()}…`);
    }
  }

  if (hitCount > 0) {
    console.error(`\nterms:check failed — ${hitCount} banned marketing term(s) found.`);
    process.exit(1);
  }
  console.log(`terms:check ✓ — scanned ${files.length} user-facing string file(s), none banned.`);
}

main();
