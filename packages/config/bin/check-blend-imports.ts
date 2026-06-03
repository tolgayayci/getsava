#!/usr/bin/env tsx
/**
 * CI guard: supply-only Blend boundary (Deliverable 1, Layer 2).
 *
 * `@blend-capital/blend-sdk` exposes Borrow / Repay / Liquidate / auction fills.
 * Sava is SUPPLY-ONLY, so the raw SDK may be imported in EXACTLY ONE place —
 * `@getsava/sdk-blend`, which narrows RequestType to SupplyCollateral +
 * WithdrawCollateral via `assertSafeRequestType`. Any other file importing the
 * SDK directly could bypass that guardrail, so this fails the build.
 */
import { readFileSync } from 'node:fs';
import { listFiles } from './lib/walk.js';

const SOURCE_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
/** The only package allowed to import the raw Blend SDK. */
const ALLOWED_DIR_RE = /packages[/\\]sdk-blend[/\\]/;
// Match real module specifiers only (`from '…'`, `import '…'`, `require('…')`,
// `import('…')`) — not prose mentions of the package name in comments/strings.
const BLEND_IMPORT_RE = /\b(?:from|import|require)\b[^\n]*['"]@blend-capital\/blend-sdk['"]/;

interface Hit {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

function main(): void {
  const files = listFiles(process.cwd()).filter(
    (f) => SOURCE_RE.test(f) && !ALLOWED_DIR_RE.test(f),
  );

  const hits: Hit[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    if (!BLEND_IMPORT_RE.test(src)) {
      continue;
    }
    src.split('\n').forEach((text, i) => {
      if (BLEND_IMPORT_RE.test(text)) {
        hits.push({ file, line: i + 1, text: text.trim() });
      }
    });
  }

  if (hits.length > 0) {
    for (const h of hits) {
      console.error(
        `✖ forbidden @blend-capital/blend-sdk import at ${h.file}:${h.line}\n    ${h.text}`,
      );
    }
    console.error(
      `\nblend:check failed — ${hits.length} direct Blend SDK import(s) outside @getsava/sdk-blend.\n` +
        'All Blend access MUST go through @getsava/sdk-blend (supply-only; SupplyCollateral + WithdrawCollateral only).',
    );
    process.exit(1);
  }

  console.log(
    'blend:check ✓ — @blend-capital/blend-sdk imported only inside @getsava/sdk-blend (supply-only boundary holds).',
  );
}

main();
