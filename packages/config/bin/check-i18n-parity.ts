#!/usr/bin/env tsx
/**
 * CI guard: i18n parity.
 *
 * Finds locale directories (`**​/locales/<lang>.json`), groups them, and checks
 * that every locale in a group shares the same key set. Passes trivially while
 * no locale files exist yet (scaffold state).
 */
import { readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { checkLocaleParity } from '../src/guards/i18n-parity.js';
import { listFiles } from './lib/walk.js';

function main(): void {
  const localeFiles = listFiles(process.cwd()).filter((file) =>
    /locales[/\\][^/\\]+\.json$/.test(file),
  );

  const groups = new Map<string, Record<string, unknown>>();
  for (const file of localeFiles) {
    const group = dirname(file);
    const lang = basename(file, '.json');
    const existing = groups.get(group) ?? {};
    existing[lang] = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    groups.set(group, existing);
  }

  if (groups.size === 0) {
    console.log('i18n:check ✓ — no locale files yet, nothing to compare.');
    return;
  }

  let failed = false;
  for (const [group, locales] of groups) {
    const result = checkLocaleParity(locales);
    if (!result.ok) {
      failed = true;
      for (const [lang, missing] of Object.entries(result.missing)) {
        console.error(
          `✖ ${group}/${lang}.json is missing ${missing.length} key(s): ${missing.join(', ')}`,
        );
      }
    }
  }

  if (failed) {
    console.error('\ni18n:check failed — locale key sets are not at parity.');
    process.exit(1);
  }
  console.log(`i18n:check ✓ — ${groups.size} locale group(s) at parity.`);
}

main();
