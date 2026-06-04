#!/usr/bin/env tsx
/**
 * SEP-10 signing helper. Runs the full handshake against a running backend —
 * fetch challenge → sign with a Stellar key → exchange for a Sava session JWT —
 * and prints the token. With `--write-env` it emits a ready-to-import Postman
 * environment so the reviewer can run the whole collection (signing a Stellar
 * challenge is not possible inside Postman without the SDK).
 *
 *   pnpm --filter @getsava/backend sep10:sign
 *   pnpm --filter @getsava/backend sep10:sign --base http://localhost:8787 --write-env
 *   pnpm --filter @getsava/backend sep10:sign --secret S... --network testnet
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  accountIdFromSecret,
  generateKeypair,
  signChallengeWithSecret,
} from '@getsava/sdk-stellar';

type Network = 'testnet' | 'mainnet';

const BACKEND_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token?.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

/** Best-effort parse of apps/backend/.dev.vars (KEY=VALUE lines). */
function loadDevVars(): Record<string, string> {
  try {
    const out: Record<string, string> = {};
    for (const line of readFileSync(join(BACKEND_DIR, '.dev.vars'), 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const devVars = loadDevVars();
  const base = String(args.base ?? process.env.BASE_URL ?? 'http://localhost:8787').replace(
    /\/$/,
    '',
  );
  const network = (args.network ?? devVars.NETWORK ?? 'testnet') as Network;
  const client = args.secret
    ? { secret: String(args.secret), publicKey: accountIdFromSecret(String(args.secret)) }
    : generateKeypair();

  // 1. Fetch the server-signed challenge.
  const challengeRes = await fetch(`${base}/auth/sep10/challenge?account=${client.publicKey}`);
  if (!challengeRes.ok) {
    throw new Error(`challenge failed: ${challengeRes.status} ${await challengeRes.text()}`);
  }
  const { transaction } = (await challengeRes.json()) as { transaction: string };

  // 2. Sign it with the client key (what Privy's signRawHash does on-device).
  const signed = signChallengeWithSecret(network, transaction, client.secret);

  // 3. Exchange the signed challenge for a Sava session JWT.
  const tokenRes = await fetch(`${base}/auth/sep10/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transaction: signed }),
  });
  if (!tokenRes.ok) {
    throw new Error(`token failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const token = (await tokenRes.json()) as { token: string; account: string; expires_at: number };

  console.log('\nSEP-10 sign OK');
  console.log('  base       :', base);
  console.log('  account    :', token.account);
  console.log('  expires_at :', new Date(token.expires_at * 1000).toISOString());
  console.log('  session JWT:', token.token);

  if (args['write-env']) {
    const out =
      typeof args['write-env'] === 'string'
        ? String(args['write-env'])
        : join(BACKEND_DIR, 'postman/sava-local.postman_environment.json');
    const environment = {
      id: 'sava-local',
      name: 'Sava Local',
      values: [
        { key: 'baseUrl', value: base, type: 'default', enabled: true },
        { key: 'account', value: token.account, type: 'default', enabled: true },
        { key: 'signedChallenge', value: signed, type: 'default', enabled: true },
        { key: 'savaToken', value: token.token, type: 'secret', enabled: true },
        {
          key: 'mercuryoSignKey',
          value: devVars.MERCURYO_SIGN_KEY ?? '',
          type: 'secret',
          enabled: true,
        },
      ],
      _postman_variable_scope: 'environment',
    };
    writeFileSync(out, `${JSON.stringify(environment, null, 2)}\n`);
    console.log('\nWrote Postman environment →', out);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
