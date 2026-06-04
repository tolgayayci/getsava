import {
  accountIdFromSecret,
  buildChallengeTransaction,
  isValidStellarAddress,
  verifyChallengeTransaction,
} from '@getsava/sdk-stellar';
import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import { issueSession, verifyPrivyToken } from '../auth/jwt';
import { ConfigError, type Env, resolveSep10Config } from '../config';
import { jsonError } from './schemas';

type App = OpenAPIHono<{ Bindings: Env }>;

const ChallengeSchema = z
  .object({
    transaction: z
      .string()
      .openapi({ description: 'Base64 challenge transaction, signed by the server' }),
    network_passphrase: z.string().openapi({ example: 'Test SDF Network ; September 2015' }),
  })
  .openapi('Sep10Challenge');

const TokenSchema = z
  .object({
    token: z.string().openapi({ description: 'Sava session JWT (HS256)' }),
    expires_at: z.number().openapi({ description: 'Expiry, unix seconds' }),
    account: z.string().openapi({ description: 'The authenticated Stellar account' }),
    privy_user_id: z.string().optional(),
  })
  .openapi('Sep10Token');

const challengeRoute = createRoute({
  method: 'get',
  path: '/auth/sep10/challenge',
  tags: ['Auth'],
  summary: 'SEP-10 challenge',
  description:
    'Returns a server-signed SEP-10 challenge transaction for the given Stellar account. The client signs it with the (Privy-issued) account key and posts it to /auth/sep10/token.',
  request: {
    query: z.object({
      account: z.string().openapi({
        example: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
        description: 'The client Stellar account id (G…) to authenticate',
      }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ChallengeSchema } },
      description: 'Challenge issued',
    },
    400: { content: jsonError, description: 'Invalid account' },
    503: { content: jsonError, description: 'Server not configured' },
  },
});

const tokenRoute = createRoute({
  method: 'post',
  path: '/auth/sep10/token',
  tags: ['Auth'],
  summary: 'SEP-10 verify → session token',
  description:
    'Verifies a signed SEP-10 challenge (proving control of the Stellar account) and returns a Sava session JWT. If an `Authorization: Bearer <privy access token>` header is present and Privy is configured, the Privy session is verified and bound into the token.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            transaction: z
              .string()
              .openapi({ description: 'The challenge transaction, now signed by the client' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: TokenSchema } },
      description: 'Session issued',
    },
    400: { content: jsonError, description: 'Invalid challenge' },
    401: { content: jsonError, description: 'Invalid Privy token' },
    503: { content: jsonError, description: 'Server not configured' },
  },
});

export function registerSep10(app: App): void {
  app.openapi(challengeRoute, (c) => {
    const { account } = c.req.valid('query');
    if (!isValidStellarAddress(account)) {
      return c.json(
        { error: 'invalid_account', message: 'account must be a valid Stellar address (G…)' },
        400,
      );
    }
    let cfg: ReturnType<typeof resolveSep10Config>;
    try {
      cfg = resolveSep10Config(c.env);
    } catch (e) {
      return c.json({ error: 'not_configured', message: errMessage(e) }, 503);
    }
    const built = buildChallengeTransaction({
      network: cfg.network,
      serverSecret: cfg.serverSecret,
      clientAccountId: account,
      homeDomain: cfg.homeDomain,
      webAuthDomain: cfg.webAuthDomain,
    });
    return c.json(
      { transaction: built.transaction, network_passphrase: built.networkPassphrase },
      200,
    );
  });

  app.openapi(tokenRoute, async (c) => {
    const { transaction } = c.req.valid('json');
    let cfg: ReturnType<typeof resolveSep10Config>;
    try {
      cfg = resolveSep10Config(c.env);
    } catch (e) {
      return c.json({ error: 'not_configured', message: errMessage(e) }, 503);
    }

    let clientAccountId: string;
    try {
      ({ clientAccountId } = verifyChallengeTransaction({
        network: cfg.network,
        serverAccountId: accountIdFromSecret(cfg.serverSecret),
        challengeXdr: transaction,
        homeDomain: cfg.homeDomain,
        webAuthDomain: cfg.webAuthDomain,
      }));
    } catch (e) {
      return c.json({ error: 'invalid_challenge', message: errMessage(e) }, 400);
    }

    // Optional: bind the authenticated Privy session into the token.
    let privyUserId: string | undefined;
    const auth = c.req.header('authorization');
    if (auth?.startsWith('Bearer ') && cfg.privy) {
      try {
        const identity = await verifyPrivyToken(auth.slice('Bearer '.length), cfg.privy);
        privyUserId = identity.userId;
      } catch (e) {
        return c.json({ error: 'invalid_privy_token', message: errMessage(e) }, 401);
      }
    }

    const session = await issueSession({
      stellarAddress: clientAccountId,
      ...(privyUserId ? { privyUserId } : {}),
      issuer: cfg.webAuthDomain,
      jwtSecret: cfg.jwtSecret,
      expSeconds: cfg.jwtExpSeconds,
    });
    return c.json(
      {
        token: session.token,
        expires_at: session.expiresAt,
        account: clientAccountId,
        ...(privyUserId ? { privy_user_id: privyUserId } : {}),
      },
      200,
    );
  });
}

function errMessage(e: unknown): string {
  if (e instanceof ConfigError) {
    return e.message;
  }
  return e instanceof Error ? e.message : 'unexpected error';
}
