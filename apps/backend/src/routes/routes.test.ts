import { createHmac } from 'node:crypto';
import { generateKeypair, signChallengeWithSecret } from '@getsava/sdk-stellar';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../config';
import app from '../index';
import { resetOrderStoreForTests } from '../mercuryo/service';

const SERVER = generateKeypair();
const SIGN_KEY = 'test-callback-sign-key';

const ENV: Env = {
  NETWORK: 'testnet',
  HOME_DOMAIN: 'getsava.app',
  WEB_AUTH_DOMAIN: 'api.getsava.app',
  SEP10_SERVER_SECRET: SERVER.secret,
  SEP10_JWT_SECRET: 'test-jwt-secret-which-is-quite-long-enough',
  MERCURYO_WIDGET_ID: 'sava-test-widget',
  MERCURYO_WIDGET_SECRET: 'test-widget-secret',
  MERCURYO_SIGN_KEY: SIGN_KEY,
  TRY_PER_USD: '40',
};

beforeEach(() => resetOrderStoreForTests());

function getJson(path: string, env: Env = ENV) {
  return app.request(path, {}, env);
}
function postJson(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
  env: Env = ENV,
) {
  return app.request(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    },
    env,
  );
}

/** Full SEP-10 handshake → returns the Sava session token + the client account. */
async function authenticate(): Promise<{ token: string; account: string }> {
  const client = generateKeypair();
  const challengeRes = await getJson(`/auth/sep10/challenge?account=${client.publicKey}`);
  expect(challengeRes.status).toBe(200);
  const { transaction } = (await challengeRes.json()) as { transaction: string };
  const signed = signChallengeWithSecret('testnet', transaction, client.secret);

  const tokenRes = await postJson('/auth/sep10/token', { transaction: signed });
  expect(tokenRes.status).toBe(200);
  const body = (await tokenRes.json()) as { token: string; account: string; expires_at: number };
  expect(body.account).toBe(client.publicKey);
  expect(typeof body.token).toBe('string');
  return { token: body.token, account: client.publicKey };
}

describe('SEP-10 auth', () => {
  it('issues a session for a correctly-signed challenge', async () => {
    const { token } = await authenticate();
    expect(token.split('.')).toHaveLength(3); // JWT
  });

  it('rejects an invalid account on challenge', async () => {
    const res = await getJson('/auth/sep10/challenge?account=not-a-key');
    expect(res.status).toBe(400);
  });

  it('rejects a challenge the client never signed', async () => {
    const client = generateKeypair();
    const res = await getJson(`/auth/sep10/challenge?account=${client.publicKey}`);
    const { transaction } = (await res.json()) as { transaction: string };
    // Post it back without the client's signature.
    const tokenRes = await postJson('/auth/sep10/token', { transaction });
    expect(tokenRes.status).toBe(400);
  });

  it('503s when the server is not configured', async () => {
    const valid = generateKeypair().publicKey;
    const res = await getJson(`/auth/sep10/challenge?account=${valid}`, { NETWORK: 'testnet' });
    expect(res.status).toBe(503);
  });
});

describe('Mercuryo widget-url signing', () => {
  it('issues a signed widget URL for an authenticated session', async () => {
    const { token, account } = await authenticate();
    const res = await postJson(
      '/mercuryo/widget-url',
      { amount_try: '500' },
      {
        authorization: `Bearer ${token}`,
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      order_id: string;
      widget_url: string;
      expected_usdc: string;
    };
    expect(body.order_id).toBeTruthy();
    expect(body.expected_usdc).toBe('12.5000000'); // 500 / 40
    // URL carries the signature + the bound account, but never the secret.
    expect(body.widget_url).toContain('signature=');
    expect(body.widget_url).toContain('merchant_transaction_id=');
    expect(body.widget_url).toContain(account);
    expect(body.widget_url).not.toContain(ENV.MERCURYO_WIDGET_SECRET as string);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await postJson('/mercuryo/widget-url', { amount_try: '500' });
    expect(res.status).toBe(401);
  });

  it('rejects a bogus session token', async () => {
    const res = await postJson(
      '/mercuryo/widget-url',
      { amount_try: '500' },
      {
        authorization: 'Bearer not.a.jwt',
      },
    );
    expect(res.status).toBe(401);
  });
});

describe('Mercuryo webhook receiver', () => {
  async function createOrder(): Promise<string> {
    const { token } = await authenticate();
    const res = await postJson(
      '/mercuryo/widget-url',
      { amount_try: '500' },
      {
        authorization: `Bearer ${token}`,
      },
    );
    return ((await res.json()) as { order_id: string }).order_id;
  }

  function sendCallback(orderId: string, status: string) {
    const raw = JSON.stringify({ status, merchant_transaction_id: orderId });
    const signature = createHmac('sha256', SIGN_KEY).update(raw, 'utf8').digest('hex');
    return app.request(
      '/webhooks/mercuryo',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-signature': signature },
        body: raw,
      },
      ENV,
    );
  }

  it('applies a valid callback and dedups replays', async () => {
    const orderId = await createOrder();

    const first = await sendCallback(orderId, 'paid');
    expect(first.status).toBe(200);
    expect((await first.json()) as { state?: string }).toMatchObject({ state: 'paid' });

    const replay = await sendCallback(orderId, 'paid');
    expect(replay.status).toBe(200);
    expect((await replay.json()) as { idempotent?: boolean }).toMatchObject({ idempotent: true });
  });

  it('rejects a callback with an invalid signature', async () => {
    const orderId = await createOrder();
    const raw = JSON.stringify({ status: 'paid', merchant_transaction_id: orderId });
    const res = await app.request(
      '/webhooks/mercuryo',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-signature': 'deadbeef' },
        body: raw,
      },
      ENV,
    );
    expect(res.status).toBe(401);
  });
});

describe('OpenAPI + health', () => {
  it('serves the OpenAPI spec with all four endpoints', async () => {
    const res = await getJson('/openapi.json');
    expect(res.status).toBe(200);
    const spec = (await res.json()) as { paths: Record<string, unknown>; info: { title: string } };
    expect(spec.info.title).toBe('Sava Backend API');
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining([
        '/auth/sep10/challenge',
        '/auth/sep10/token',
        '/mercuryo/widget-url',
        '/webhooks/mercuryo',
      ]),
    );
  });

  it('serves Swagger UI at /docs', async () => {
    const res = await getJson('/docs');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('health check responds', async () => {
    const res = await getJson('/health');
    expect(res.status).toBe(200);
    expect((await res.json()) as { status: string }).toMatchObject({ status: 'ok' });
  });
});
