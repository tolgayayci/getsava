/**
 * Conventional-commit validation.
 *
 * getsava commits are Conventional Commits and must NOT reference Linear/issue
 * IDs (e.g. "YK-486") in the message — see CLAUDE.md.
 */

const TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
] as const;

export interface CommitValidation {
  readonly valid: boolean;
  readonly reason?: string;
}

const HEADER_RE = /^([a-z]+)(?:\(([a-z0-9._/-]+)\))?(!)?: (.+)$/;
const ISSUE_REF_RE = /\bYK-\d+\b/;
const PASSTHROUGH_RE = /^(Merge |Revert |fixup! |squash! )/;

export function validateCommitMessage(message: string): CommitValidation {
  const firstLine = message
    .split('\n')
    .map((line) => line.trimEnd())
    .find((line) => line.length > 0 && !line.startsWith('#'));

  if (!firstLine) {
    return { valid: false, reason: 'commit message is empty' };
  }

  if (PASSTHROUGH_RE.test(firstLine)) {
    return { valid: true };
  }

  const match = HEADER_RE.exec(firstLine);
  if (!match) {
    return {
      valid: false,
      reason: `"${firstLine}" is not a conventional commit (expected "type(scope): subject")`,
    };
  }

  const type = match[1];
  const subject = match[4];
  if (!type || !(TYPES as readonly string[]).includes(type)) {
    return {
      valid: false,
      reason: `unknown type "${type ?? ''}"; use one of: ${TYPES.join(', ')}`,
    };
  }
  if (!subject || subject.trim().length === 0) {
    return { valid: false, reason: 'subject is empty' };
  }
  if (ISSUE_REF_RE.test(message)) {
    return {
      valid: false,
      reason: 'do not reference issue IDs (e.g. "YK-486") in commit messages',
    };
  }

  return { valid: true };
}
