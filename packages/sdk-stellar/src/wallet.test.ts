import { describe, expect, it } from 'vitest';
import { findStellarAddress } from './wallet';

describe('findStellarAddress', () => {
  it('finds a snake_case stellar linked account', () => {
    const user = {
      linked_accounts: [
        { chain_type: 'ethereum', address: '0xabc' },
        { chain_type: 'stellar', address: 'GTEST' },
      ],
    };
    expect(findStellarAddress(user)).toBe('GTEST');
  });

  it('finds a camelCase stellar linked account', () => {
    const user = { linkedAccounts: [{ chainType: 'stellar', address: 'GCAMEL' }] };
    expect(findStellarAddress(user)).toBe('GCAMEL');
  });

  it('returns null when there is no stellar account', () => {
    expect(
      findStellarAddress({ linked_accounts: [{ chain_type: 'solana', address: 'S' }] }),
    ).toBeNull();
  });

  it('returns null for null/empty users', () => {
    expect(findStellarAddress(null)).toBeNull();
    expect(findStellarAddress(undefined)).toBeNull();
    expect(findStellarAddress({})).toBeNull();
  });
});
