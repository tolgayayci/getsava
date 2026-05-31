#!/usr/bin/env tsx
/**
 * CI guard: marketing language.
 *
 * Scans user-facing string sources (i18n locale files + disclaimer copy banks)
 * for banned marketing terms. Exits non-zero on any hit. Passes trivially while
 * those files do not yet exist.
 *
 * Namespace allowlist: banned terms that are UNAVOIDABLE in risk disclosures
 * (e.g. "not a deposit", "never guaranteed") are permitted ONLY inside the
 * disclaimer namespaces below. Marketing copy everywhere else stays strict —
 * a "guaranteed yield" claim in a non-disclaimer key still fails. (Aligned with
 * YK-494: "pass the marketing-language guard via allowlist where unavoidable".)
 */
import { readFileSync } from 'node:fs';
import { BANNED_MARKETING_TERMS, scanForBannedTerms } from '../src/guards/banned-terms.js';
import { listFiles } from './lib/walk.js';

const LOCALE_RE = /locales[/\\][^/\\]+\.json$/;
const DISCLAIMER_FILE_RE = /disclaimers?[^/\\]*\.ts$/;

/** Top-level i18n namespaces where negated banned terms are allowed. */
const DISCLAIMER_NAMESPACES = new Set([
  'onboarding',
  'risk',
  'disclaimers',
  'preSupply',
  'tax',
  'circuitBreaker',
]);

const ALL_TERMS = BANNED_MARKETING_TERMS.map((t) => t.term);

interface Hit {
  readonly file: string;
  readonly keyPath: string;
  readonly term: string;
  readonly excerpt: string;
}

/** Walk a parsed locale tree, scanning each string leaf with namespace-aware allowlist. */
function scanLocaleTree(file: string, tree: unknown): Hit[] {
  const hits: Hit[] = [];
  const visit = (node: unknown, path: string[]): void => {
    if (typeof node === 'string') {
      const namespace = path[0] ?? '';
      const allowlist = DISCLAIMER_NAMESPACES.has(namespace) ? ALL_TERMS : [];
      for (const hit of scanForBannedTerms(node, { allowlist })) {
        hits.push({ file, keyPath: path.join('.'), term: hit.term, excerpt: hit.excerpt });
      }
      return;
    }
    if (node !== null && typeof node === 'object') {
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        visit(child, [...path, key]);
      }
    }
  };
  visit(tree, []);
  return hits;
}

function main(): void {
  const files = listFiles(process.cwd());
  const localeFiles = files.filter((f) => LOCALE_RE.test(f));
  const disclaimerFiles = files.filter((f) => DISCLAIMER_FILE_RE.test(f));

  const hits: Hit[] = [];

  for (const file of localeFiles) {
    const tree = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    hits.push(...scanLocaleTree(file, tree));
  }

  // Disclaimer .ts banks: whole-file scan with all terms allowed (they ARE the
  // disclaimers). They still get i18n parity + review; this only skips the term ban.
  for (const file of disclaimerFiles) {
    const remaining = scanForBannedTerms(readFileSync(file, 'utf8'), { allowlist: ALL_TERMS });
    for (const hit of remaining) {
      hits.push({ file, keyPath: '(file)', term: hit.term, excerpt: hit.excerpt });
    }
  }

  if (hits.length > 0) {
    for (const h of hits) {
      console.error(
        `✖ banned term "${h.term}" at ${h.file} → ${h.keyPath}\n    …${h.excerpt.trim()}…`,
      );
    }
    console.error(`\nterms:check failed — ${hits.length} banned marketing term(s) found.`);
    process.exit(1);
  }
  console.log(
    `terms:check ✓ — scanned ${localeFiles.length} locale + ${disclaimerFiles.length} disclaimer file(s), none banned (disclaimer namespaces excepted).`,
  );
}

main();
