import { describe, expect, it } from 'vitest';
import { validateCommitMessage } from './commit-message.js';

describe('validateCommitMessage', () => {
  it('accepts a conventional commit with a scope', () => {
    expect(validateCommitMessage('feat(config): add CI guards').valid).toBe(true);
  });

  it('accepts a scope-less commit', () => {
    expect(validateCommitMessage('chore: bootstrap monorepo').valid).toBe(true);
  });

  it('rejects a non-conventional message', () => {
    expect(validateCommitMessage('updated some stuff').valid).toBe(false);
  });

  it('rejects an unknown type', () => {
    expect(validateCommitMessage('wip(config): things').valid).toBe(false);
  });

  it('rejects a message that references an issue id', () => {
    const result = validateCommitMessage('feat(config): add CI guards (YK-486)');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/issue id/i);
  });

  it('ignores leading comment lines', () => {
    expect(validateCommitMessage('# please enter the commit message\nfix: bug').valid).toBe(true);
  });

  it('lets merge commits through', () => {
    expect(validateCommitMessage('Merge branch main into feature').valid).toBe(true);
  });
});
