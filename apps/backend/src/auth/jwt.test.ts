import { exportSPKI, generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { issueSession, verifyPrivyToken, verifySession } from './jwt';

const ISSUER = 'api.getsava.app';
const JWT_SECRET = 'test-session-secret-which-is-long-enough';
const STELLAR = 'GABC...';

describe('Sava session JWT', () => {
  it('issues and verifies a session bound to the stellar account', async () => {
    const before = Math.floor(Date.now() / 1000);
    const { token, expiresAt } = await issueSession({
      stellarAddress: STELLAR,
      issuer: ISSUER,
      jwtSecret: JWT_SECRET,
      expSeconds: 3600,
    });
    expect(expiresAt).toBeGreaterThanOrEqual(before + 3600);
    expect(expiresAt).toBeLessThanOrEqual(before + 3603);

    const claims = await verifySession(token, JWT_SECRET, ISSUER);
    expect(claims.stellarAddress).toBe(STELLAR);
    expect(claims.privyUserId).toBeUndefined();
  });

  it('carries the bound Privy user id when present', async () => {
    const { token } = await issueSession({
      stellarAddress: STELLAR,
      privyUserId: 'did:privy:user123',
      issuer: ISSUER,
      jwtSecret: JWT_SECRET,
      expSeconds: 3600,
    });
    const claims = await verifySession(token, JWT_SECRET, ISSUER);
    expect(claims.privyUserId).toBe('did:privy:user123');
  });

  it('rejects a token signed with a different secret', async () => {
    const { token } = await issueSession({
      stellarAddress: STELLAR,
      issuer: ISSUER,
      jwtSecret: JWT_SECRET,
      expSeconds: 3600,
    });
    await expect(verifySession(token, 'wrong-secret', ISSUER)).rejects.toThrow();
  });
});

describe('Privy access-token verification', () => {
  const APP_ID = 'cmptsx19j00ba0cjv8nghcdhr';

  async function privySetup() {
    const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
    const verificationKey = await exportSPKI(publicKey);
    const mint = (claims: { sub: string; aud?: string; iss?: string }) =>
      new SignJWT({})
        .setProtectedHeader({ alg: 'ES256' })
        .setSubject(claims.sub)
        .setIssuer(claims.iss ?? 'privy.io')
        .setAudience(claims.aud ?? APP_ID)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
    return { verificationKey, mint };
  }

  it('verifies a valid Privy token and returns the user id', async () => {
    const { verificationKey, mint } = await privySetup();
    const token = await mint({ sub: 'did:privy:abc' });
    const identity = await verifyPrivyToken(token, { appId: APP_ID, verificationKey });
    expect(identity.userId).toBe('did:privy:abc');
  });

  it('rejects a token minted for a different app (audience)', async () => {
    const { verificationKey, mint } = await privySetup();
    const token = await mint({ sub: 'did:privy:abc', aud: 'someone-else' });
    await expect(verifyPrivyToken(token, { appId: APP_ID, verificationKey })).rejects.toThrow();
  });

  it('rejects a token with the wrong issuer', async () => {
    const { verificationKey, mint } = await privySetup();
    const token = await mint({ sub: 'did:privy:abc', iss: 'evil.example' });
    await expect(verifyPrivyToken(token, { appId: APP_ID, verificationKey })).rejects.toThrow();
  });
});
