#!/usr/bin/env tsx
/**
 * commit-msg hook entrypoint. Invoked by lefthook with the path to the commit
 * message file. Exits non-zero (blocking the commit) on an invalid message.
 */
import { readFileSync } from 'node:fs';
import { validateCommitMessage } from '../src/commit-message.js';

function main(): void {
  const file = process.argv[2];
  if (!file) {
    console.error('check-commit-msg: no commit message file path provided');
    process.exit(2);
  }

  const result = validateCommitMessage(readFileSync(file, 'utf8'));
  if (!result.valid) {
    console.error(`\n✖ Invalid commit message: ${result.reason}`);
    console.error('  Format: <type>(<scope>)?: <subject> (YK-<id>)');
    console.error('  e.g.    feat(sdk-blend): narrow RequestType to supply/withdraw (YK-468)\n');
    process.exit(1);
  }
}

main();
