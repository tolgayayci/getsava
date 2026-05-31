import { describe, expect, it } from 'vitest';
import app from './index.js';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('sava-backend');
  });

  it('404s an unknown route', async () => {
    const res = await app.request('/nope');
    expect(res.status).toBe(404);
  });
});
