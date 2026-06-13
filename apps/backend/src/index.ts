import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { circuitService } from './circuit';
import type { Env } from './config';
import { registerCircuit } from './routes/circuit';
import { registerMercuryo } from './routes/mercuryo';
import { registerSep10 } from './routes/sep10';

/**
 * Sava backend (T1.D6 + T2.D1). Hono on Cloudflare Workers.
 *
 *   GET  /auth/sep10/challenge   — SEP-10 challenge for a Stellar account
 *   POST /auth/sep10/token       — verify signed challenge → Sava session JWT
 *   POST /mercuryo/widget-url    — HMAC-signed Mercuryo widget URL (auth-gated)
 *   POST /webhooks/mercuryo      — callback receiver, idempotent dedup (Postgres)
 *   GET  /circuit/status         — circuit-breaker state the app polls to halt supply
 *   GET  /circuit/metrics        — sample time series (read-only dashboard data)
 *   GET  /circuit/dashboard      — read-only HTML metrics dashboard
 *   POST /circuit/sample         — manual trip trigger (CIRCUIT_ADMIN_TOKEN)
 *   POST /circuit/push-tokens    — register an Expo push token for trip alerts
 *   GET  /openapi.json · /docs   — OpenAPI spec + Swagger UI
 *   GET  /health
 *
 * The circuit monitor samples on a 1-minute cron (scheduled handler below) and
 * fires alerts on a fresh trip. All secrets (signing keys, DB url, alert webhook,
 * admin token) are Worker secrets — never shipped to the client.
 */
const app = new OpenAPIHono<{ Bindings: Env }>();

app.get('/health', (c) =>
  c.json({ status: 'ok', service: 'sava-backend', timestamp: new Date().toISOString() }),
);

registerSep10(app);
registerMercuryo(app);
registerCircuit(app);

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

// Named export for tests (app.request(...)). The default export below is the
// Cloudflare module-worker entry (fetch + scheduled).
export { app };

/**
 * Worker entry: HTTP via Hono + a 1-minute cron that samples the circuit breaker.
 * The cron is the continuous monitor (metrics + real-event trip detection);
 * sampling failures are logged, never thrown, so a transient RPC error never
 * crashes the Worker. A reviewer's `POST /circuit/sample` gives instant (<30s)
 * detection on top of this heartbeat.
 */
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      circuitService(env)
        .sampleAndStore()
        .then((s) => {
          if (s.tripped) {
            console.log(JSON.stringify({ event: 'circuit_cron_tripped', reasons: s.reasons }));
          }
        })
        .catch((e) => {
          console.log(JSON.stringify({ event: 'circuit_sample_error', message: String(e) }));
        }),
    );
  },
};
