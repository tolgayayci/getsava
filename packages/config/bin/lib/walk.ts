import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.turbo',
  '.expo',
  '.wrangler',
  'dist',
  'coverage',
  'reference-mvp',
]);

/** Recursively lists files under `root`, skipping build/vendor directories. */
export function listFiles(root: string): string[] {
  const files: string[] = [];
  const stack: string[] = [root];

  while (stack.length > 0) {
    const dir = stack.pop();
    if (dir === undefined) {
      break;
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          stack.push(join(dir, entry.name));
        }
      } else if (entry.isFile()) {
        files.push(join(dir, entry.name));
      }
    }
  }

  return files;
}
