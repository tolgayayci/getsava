import type { Network } from '@getsava/types';
import type { OrdersConfig } from './orders';

/**
 * Cloudflare Worker bindings (vars + secrets). All values are strings — secrets
 * are set with `wrangler secret put` and NEVER committed or shipped to clients.
 * Tests inject a complete `Env` as the third arg to `app.request(path, init, env)`.
 */
export interface Env {
  /** 'testnet' | 'mainnet'. Defaults to testnet. */
  NETWORK?: string;
  /** Home domain the SEP-10 challenge authenticates for (e.g. getsava.app). */
  HOME_DOMAIN?: string;
  /** Domain hosting this web-auth API (e.g. api.getsava.app). */
  WEB_AUTH_DOMAIN?: string;
  /** SEP-10 server signing secret (S…). */
  SEP10_SERVER_SECRET?: string;
  /** HS256 secret used to sign Sava session JWTs. */
  SEP10_JWT_SECRET?: string;
  /** Session lifetime in seconds (default 86400). */
  SEP10_JWT_EXP_SECONDS?: string;
  /** Privy app id — the audience of Privy access tokens. */
  PRIVY_APP_ID?: string;
  /** Privy verification key (PEM SPKI, ES256) — verifies Privy access tokens. */
  PRIVY_VERIFICATION_KEY?: string;
  MERCURYO_WIDGET_ID?: string;
  /** Signs widget URLs (SHA512). Server-side only. */
  MERCURYO_WIDGET_SECRET?: string;
  /** Verifies callback HMAC-SHA256. Server-side only. */
  MERCURYO_SIGN_KEY?: string;
  /** TRY per 1 USD for the static MVP quote (default 40). */
  TRY_PER_USD?: string;
  /** TESTNET-only treasury bridge toggle ('true' to enable). */
  BRIDGE_ENABLED?: string;
  /** Treasury source secret (S…) — testnet bridge only. */
  TREASURY_SECRET?: string;
  /** Neon Postgres connection string (idempotent webhook dedup + circuit metrics). */
  DATABASE_URL?: string;
  /** Cloudflare D1 (SQLite) binding — durable circuit metrics store (preferred over DATABASE_URL). */
  DB?: D1Database;
  /** D1 circuit breaker — staging trip override: a TripReason, a comma-list, or 'none'. */
  CIRCUIT_FORCE_TRIP?: string;
  /** On-call incoming webhook (Slack/Discord/generic) for circuit-trip alerts. */
  CIRCUIT_ALERT_WEBHOOK?: string;
  /** Optional external secondary USDC price feed (oracle-divergence reference). */
  CIRCUIT_REFERENCE_URL?: string;
  /** Bearer token gating the manual POST /circuit/sample trigger. */
  CIRCUIT_ADMIN_TOKEN?: string;
}

/** Misconfiguration surfaced as a 503 by the routes (fail loud, never silent). */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const DEFAULT_HOME_DOMAIN = 'getsava.app';
const DEFAULT_WEB_AUTH_DOMAIN = 'api.getsava.app';
const DEFAULT_JWT_EXP_SECONDS = 86_400;
const DEFAULT_TRY_PER_USD = 40;

export function resolveNetwork(env: Env): Network {
  return env.NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
}

function required(env: Env, key: keyof Env): string {
  const value = env[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new ConfigError(`Missing required configuration: ${key}`);
  }
  return value;
}

export interface PrivyConfig {
  readonly appId: string;
  readonly verificationKey: string;
}

export interface Sep10Config {
  readonly network: Network;
  readonly serverSecret: string;
  readonly homeDomain: string;
  readonly webAuthDomain: string;
  readonly jwtSecret: string;
  readonly jwtExpSeconds: number;
  /** Present only when Privy binding is configured. */
  readonly privy?: PrivyConfig;
}

export function resolveSep10Config(env: Env): Sep10Config {
  const privy =
    env.PRIVY_VERIFICATION_KEY && env.PRIVY_APP_ID
      ? { appId: env.PRIVY_APP_ID, verificationKey: env.PRIVY_VERIFICATION_KEY }
      : undefined;
  return {
    network: resolveNetwork(env),
    serverSecret: required(env, 'SEP10_SERVER_SECRET'),
    homeDomain: env.HOME_DOMAIN ?? DEFAULT_HOME_DOMAIN,
    webAuthDomain: env.WEB_AUTH_DOMAIN ?? DEFAULT_WEB_AUTH_DOMAIN,
    jwtSecret: required(env, 'SEP10_JWT_SECRET'),
    jwtExpSeconds: env.SEP10_JWT_EXP_SECONDS
      ? Number(env.SEP10_JWT_EXP_SECONDS)
      : DEFAULT_JWT_EXP_SECONDS,
    ...(privy ? { privy } : {}),
  };
}

export function resolveMercuryoConfig(env: Env): OrdersConfig {
  const network = resolveNetwork(env);
  const bridgeEnabled = env.BRIDGE_ENABLED === 'true';
  return {
    network,
    mercuryo: {
      widgetId: required(env, 'MERCURYO_WIDGET_ID'),
      secret: required(env, 'MERCURYO_WIDGET_SECRET'),
      signKey: required(env, 'MERCURYO_SIGN_KEY'),
    },
    tryPerUsd: env.TRY_PER_USD ? Number(env.TRY_PER_USD) : DEFAULT_TRY_PER_USD,
    ...(bridgeEnabled
      ? { bridge: { enabled: true, treasurySecret: required(env, 'TREASURY_SECRET') } }
      : {}),
  };
}
