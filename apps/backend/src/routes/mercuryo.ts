import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import { verifySession } from '../auth/jwt';
import { ConfigError, type Env, resolveSep10Config } from '../config';
import { ordersService } from '../mercuryo/service';
import { jsonError } from './schemas';

type App = OpenAPIHono<{ Bindings: Env }>;

const WidgetUrlSchema = z
  .object({
    order_id: z.string().openapi({ description: 'Mercuryo merchant_transaction_id (UUID)' }),
    widget_url: z
      .string()
      .openapi({ description: 'Signed Mercuryo widget URL — safe to open client-side' }),
    expected_usdc: z.string().openapi({ description: 'USDC the user should receive at the quote' }),
  })
  .openapi('WidgetUrl');

const WebhookResultSchema = z
  .object({
    status: z.string(),
    state: z.string().optional(),
    idempotent: z.boolean().optional(),
    matched: z.boolean().optional(),
  })
  .openapi('WebhookResult');

const widgetUrlRoute = createRoute({
  method: 'post',
  path: '/mercuryo/widget-url',
  tags: ['Mercuryo'],
  summary: 'Sign a Mercuryo widget URL',
  description:
    'Builds an HMAC-signed Mercuryo on-ramp widget URL for the authenticated session. Requires `Authorization: Bearer <sava session JWT>` from /auth/sep10/token — the USDC settles to the Stellar account bound in that session. The widget Secret never leaves the server.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            amount_try: z.string().openapi({ example: '500', description: 'Fiat amount in TRY' }),
            return_url: z
              .string()
              .optional()
              .openapi({ description: 'Deep link back into the app' }),
            lang: z.string().optional().openapi({ example: 'tr' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: WidgetUrlSchema } },
      description: 'Signed URL issued',
    },
    400: { content: jsonError, description: 'Invalid request' },
    401: { content: jsonError, description: 'Missing or invalid session' },
    503: { content: jsonError, description: 'Server not configured' },
  },
});

const webhookRoute = createRoute({
  method: 'post',
  path: '/webhooks/mercuryo',
  tags: ['Mercuryo'],
  summary: 'Mercuryo callback receiver',
  description:
    'Receives Mercuryo callbacks. Verifies the `X-Signature` HMAC-SHA256 over the raw body, then applies the order state transition. Idempotent: a replayed (merchant_transaction_id, event_type) is a 200 no-op, deduped against Postgres.',
  responses: {
    200: {
      content: { 'application/json': { schema: WebhookResultSchema } },
      description: 'Accepted (or idempotent no-op)',
    },
    401: { content: jsonError, description: 'Invalid signature' },
    503: { content: jsonError, description: 'Server not configured' },
  },
});

function clientIp(headerGet: (name: string) => string | undefined): string {
  return (
    headerGet('cf-connecting-ip') ??
    headerGet('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0'
  );
}

function errMessage(e: unknown): string {
  if (e instanceof ConfigError) {
    return e.message;
  }
  return e instanceof Error ? e.message : 'unexpected error';
}

export function registerMercuryo(app: App): void {
  app.openapi(widgetUrlRoute, async (c) => {
    const { amount_try, return_url, lang } = c.req.valid('json');

    let cfg: ReturnType<typeof resolveSep10Config>;
    try {
      cfg = resolveSep10Config(c.env);
    } catch (e) {
      return c.json({ error: 'not_configured', message: errMessage(e) }, 503);
    }

    const auth = c.req.header('authorization');
    if (!auth?.startsWith('Bearer ')) {
      return c.json({ error: 'unauthorized', message: 'missing bearer session token' }, 401);
    }
    let stellarAddress: string;
    try {
      const claims = await verifySession(
        auth.slice('Bearer '.length),
        cfg.jwtSecret,
        cfg.webAuthDomain,
      );
      stellarAddress = claims.stellarAddress;
    } catch {
      return c.json({ error: 'unauthorized', message: 'invalid or expired session token' }, 401);
    }

    try {
      const result = await ordersService(c.env).createDeposit({
        userAddress: stellarAddress,
        amountTry: amount_try,
        ip: clientIp((name) => c.req.header(name)),
        ...(return_url !== undefined ? { returnUrl: return_url } : {}),
        ...(lang !== undefined ? { lang } : {}),
      });
      return c.json(
        {
          order_id: result.orderId,
          widget_url: result.widgetUrl,
          expected_usdc: result.expectedUsdc,
        },
        200,
      );
    } catch (e) {
      return c.json({ error: 'bad_request', message: errMessage(e) }, 400);
    }
  });

  app.openapi(webhookRoute, async (c) => {
    let service: ReturnType<typeof ordersService>;
    try {
      service = ordersService(c.env);
    } catch (e) {
      return c.json({ error: 'not_configured', message: errMessage(e) }, 503);
    }
    // RAW body is required — re-serializing the parsed JSON would break the HMAC.
    const raw = await c.req.text();
    const signature = c.req.header('x-signature') ?? '';
    const result = await service.applyWebhook(raw, signature);
    if (result.status === 401) {
      return c.json({ error: 'invalid_signature', message: 'X-Signature did not match' }, 401);
    }
    return c.json(
      {
        status: result.matched === false ? 'ignored' : 'ok',
        ...(result.state !== undefined ? { state: result.state } : {}),
        ...(result.idempotent !== undefined ? { idempotent: result.idempotent } : {}),
        ...(result.matched !== undefined ? { matched: result.matched } : {}),
      },
      200,
    );
  });
}
