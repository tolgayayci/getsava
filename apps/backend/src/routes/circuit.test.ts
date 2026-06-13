import { beforeEach, describe, expect, it } from 'vitest';
import { resetCircuitStoreForTests } from '../circuit';
import type { Env } from '../config';
import { app } from '../index';

const BASE: Env = { NETWORK: 'testnet' };

beforeEach(() => {
  resetCircuitStoreForTests();
});

describe('GET /circuit/status', () => {
  it('is healthy / fail-open before any sample exists', async () => {
    const res = await app.request('/circuit/status', {}, BASE);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tripped: boolean;
      sampledAt: number | null;
      forced: boolean;
    };
    expect(body.tripped).toBe(false);
    expect(body.sampledAt).toBeNull();
    expect(body.forced).toBe(false);
  });

  it('reflects the CIRCUIT_FORCE_TRIP env override LIVE (no sampling needed)', async () => {
    const res = await app.request(
      '/circuit/status',
      {},
      { ...BASE, CIRCUIT_FORCE_TRIP: 'oracle_divergence' },
    );
    const body = (await res.json()) as { tripped: boolean; forced: boolean; reasons: string[] };
    expect(body.tripped).toBe(true);
    expect(body.forced).toBe(true);
    expect(body.reasons).toContain('oracle_divergence');
  });
});

describe('GET /circuit/metrics', () => {
  it('returns an empty window with no samples', async () => {
    const res = await app.request('/circuit/metrics?days=7', {}, BASE);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { windowDays: number; count: number; trips: number };
    expect(body.windowDays).toBe(7);
    expect(body.count).toBe(0);
    expect(body.trips).toBe(0);
  });
});

describe('POST /circuit/sample (manual trigger, admin-gated)', () => {
  it('503 when no admin token is configured', async () => {
    const res = await app.request('/circuit/sample', { method: 'POST' }, BASE);
    expect(res.status).toBe(503);
  });

  it('401 with a wrong bearer token', async () => {
    const res = await app.request(
      '/circuit/sample',
      { method: 'POST', headers: { authorization: 'Bearer nope' } },
      { ...BASE, CIRCUIT_ADMIN_TOKEN: 'secret' },
    );
    expect(res.status).toBe(401);
  });
});

describe('POST /circuit/push-tokens', () => {
  it('accepts a valid Expo push token', async () => {
    const res = await app.request(
      '/circuit/push-tokens',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'ExponentPushToken[abc123]' }),
      },
      BASE,
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as { ok: boolean }).toEqual({ ok: true });
  });

  it('rejects a non-Expo token', async () => {
    const res = await app.request(
      '/circuit/push-tokens',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'not-a-token' }),
      },
      BASE,
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /circuit/dashboard', () => {
  it('serves read-only HTML', async () => {
    const res = await app.request('/circuit/dashboard', {}, BASE);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('Circuit Breaker');
    expect(html).toContain('withdrawals are always allowed');
  });
});

describe('OpenAPI spec includes the circuit endpoints', () => {
  it('lists /circuit/status and /circuit/metrics', async () => {
    const res = await app.request('/openapi.json', {}, BASE);
    const spec = (await res.json()) as { paths: Record<string, unknown> };
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining(['/circuit/status', '/circuit/metrics', '/circuit/sample']),
    );
  });
});
