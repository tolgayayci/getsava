import { describe, expect, it } from 'vitest';
import {
  buildChallengeTransaction,
  ChallengeError,
  generateKeypair,
  isValidStellarAddress,
  signChallengeWithSecret,
  verifyChallengeTransaction,
} from './sep10';

const NETWORK = 'testnet' as const;
const HOME_DOMAIN = 'getsava.app';
const WEB_AUTH_DOMAIN = 'api.getsava.app';

function setup() {
  const server = generateKeypair();
  const client = generateKeypair();
  return { server, client };
}

describe('SEP-10 challenge', () => {
  it('round-trips: build → client signs → verify returns the client account', () => {
    const { server, client } = setup();
    const built = buildChallengeTransaction({
      network: NETWORK,
      serverSecret: server.secret,
      clientAccountId: client.publicKey,
      homeDomain: HOME_DOMAIN,
      webAuthDomain: WEB_AUTH_DOMAIN,
      now: 1_000_000,
    });
    expect(built.serverAccountId).toBe(server.publicKey);

    const signed = signChallengeWithSecret(NETWORK, built.transaction, client.secret);
    const { clientAccountId } = verifyChallengeTransaction({
      network: NETWORK,
      serverAccountId: server.publicKey,
      challengeXdr: signed,
      homeDomain: HOME_DOMAIN,
      webAuthDomain: WEB_AUTH_DOMAIN,
      now: 1_000_010,
    });
    expect(clientAccountId).toBe(client.publicKey);
  });

  it('rejects a challenge the client never signed', () => {
    const { server, client } = setup();
    const built = buildChallengeTransaction({
      network: NETWORK,
      serverSecret: server.secret,
      clientAccountId: client.publicKey,
      homeDomain: HOME_DOMAIN,
      webAuthDomain: WEB_AUTH_DOMAIN,
      now: 1_000_000,
    });
    // Only the server has signed it.
    expect(() =>
      verifyChallengeTransaction({
        network: NETWORK,
        serverAccountId: server.publicKey,
        challengeXdr: built.transaction,
        homeDomain: HOME_DOMAIN,
        webAuthDomain: WEB_AUTH_DOMAIN,
        now: 1_000_010,
      }),
    ).toThrow(ChallengeError);
  });

  it('rejects a challenge signed by the wrong client key', () => {
    const { server, client } = setup();
    const impostor = generateKeypair();
    const built = buildChallengeTransaction({
      network: NETWORK,
      serverSecret: server.secret,
      clientAccountId: client.publicKey,
      homeDomain: HOME_DOMAIN,
      webAuthDomain: WEB_AUTH_DOMAIN,
      now: 1_000_000,
    });
    const signed = signChallengeWithSecret(NETWORK, built.transaction, impostor.secret);
    expect(() =>
      verifyChallengeTransaction({
        network: NETWORK,
        serverAccountId: server.publicKey,
        challengeXdr: signed,
        homeDomain: HOME_DOMAIN,
        webAuthDomain: WEB_AUTH_DOMAIN,
        now: 1_000_010,
      }),
    ).toThrow(/client signature/);
  });

  it('rejects an expired challenge', () => {
    const { server, client } = setup();
    const built = buildChallengeTransaction({
      network: NETWORK,
      serverSecret: server.secret,
      clientAccountId: client.publicKey,
      homeDomain: HOME_DOMAIN,
      webAuthDomain: WEB_AUTH_DOMAIN,
      timeoutSeconds: 300,
      now: 1_000_000,
    });
    const signed = signChallengeWithSecret(NETWORK, built.transaction, client.secret);
    expect(() =>
      verifyChallengeTransaction({
        network: NETWORK,
        serverAccountId: server.publicKey,
        challengeXdr: signed,
        homeDomain: HOME_DOMAIN,
        webAuthDomain: WEB_AUTH_DOMAIN,
        now: 1_000_000 + 301,
      }),
    ).toThrow(/expired/);
  });

  it('rejects a home-domain mismatch', () => {
    const { server, client } = setup();
    const built = buildChallengeTransaction({
      network: NETWORK,
      serverSecret: server.secret,
      clientAccountId: client.publicKey,
      homeDomain: HOME_DOMAIN,
      webAuthDomain: WEB_AUTH_DOMAIN,
      now: 1_000_000,
    });
    const signed = signChallengeWithSecret(NETWORK, built.transaction, client.secret);
    expect(() =>
      verifyChallengeTransaction({
        network: NETWORK,
        serverAccountId: server.publicKey,
        challengeXdr: signed,
        homeDomain: 'evil.example',
        webAuthDomain: WEB_AUTH_DOMAIN,
        now: 1_000_010,
      }),
    ).toThrow(/home domain/);
  });

  it('rejects a challenge presented to the wrong server account', () => {
    const { server, client } = setup();
    const otherServer = generateKeypair();
    const built = buildChallengeTransaction({
      network: NETWORK,
      serverSecret: server.secret,
      clientAccountId: client.publicKey,
      homeDomain: HOME_DOMAIN,
      webAuthDomain: WEB_AUTH_DOMAIN,
      now: 1_000_000,
    });
    const signed = signChallengeWithSecret(NETWORK, built.transaction, client.secret);
    expect(() =>
      verifyChallengeTransaction({
        network: NETWORK,
        serverAccountId: otherServer.publicKey,
        challengeXdr: signed,
        homeDomain: HOME_DOMAIN,
        webAuthDomain: WEB_AUTH_DOMAIN,
        now: 1_000_010,
      }),
    ).toThrow(/server account/);
  });
});

describe('isValidStellarAddress', () => {
  it('accepts a real public key and rejects junk', () => {
    const { publicKey } = generateKeypair();
    expect(isValidStellarAddress(publicKey)).toBe(true);
    expect(isValidStellarAddress('not-an-address')).toBe(false);
    expect(isValidStellarAddress('')).toBe(false);
  });
});
