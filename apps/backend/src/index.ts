import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from './config';
import { registerMercuryo } from './routes/mercuryo';
import { registerSep10 } from './routes/sep10';

/**
 * Sava backend (T1.D6). Hono on Cloudflare Workers.
 *
 *   GET  /auth/sep10/challenge   — SEP-10 challenge for a Stellar account
 *   POST /auth/sep10/token       — verify signed challenge → Sava session JWT
 *   POST /mercuryo/widget-url    — HMAC-signed Mercuryo widget URL (auth-gated)
 *   POST /webhooks/mercuryo      — callback receiver, idempotent dedup (Postgres)
 *   GET  /openapi.json · /docs   — OpenAPI spec + Swagger UI
 *   GET  /health
 *
 * All secrets (server signing key, Mercuryo secret/sign key, Privy key, JWT
 * secret, DB url) are Worker secrets — never shipped to the client.
 */
const app = new OpenAPIHono<{ Bindings: Env }>();

app.get('/health', (c) =>
  c.json({ status: 'ok', service: 'sava-backend', timestamp: new Date().toISOString() }),
);

registerSep10(app);
registerMercuryo(app);

app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'Sava Backend API',
    version: '1.0.0',
    description:
      'SEP-10 Stellar web authentication and Mercuryo on-ramp URL signing for Sava. Signing keys stay server-side; webhook dedup is idempotent against Postgres.',
  },
  servers: [
    { url: 'https://api.getsava.app', description: 'production' },
    { url: 'http://localhost:8787', description: 'local (wrangler dev)' },
  ],
});

app.get('/docs', swaggerUI({ url: '/openapi.json' }));

export default app;
