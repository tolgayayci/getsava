# @getsava/backend

Hono API on Cloudflare Workers — **SEP-10 web auth** + **Mercuryo URL signing** (T1.D6).

All signing keys (SEP-10 server key, Mercuryo widget secret + callback sign key,
Privy verification key, session JWT secret) stay **server-side**. Webhook dedup
is **idempotent against Postgres**.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`  | `/auth/sep10/challenge?account=G…` | SEP-10 challenge for a Stellar account |
| `POST` | `/auth/sep10/token` | Verify the signed challenge → Sava session JWT (binds the Privy session when an `Authorization: Bearer <privy token>` is sent) |
| `POST` | `/mercuryo/widget-url` | HMAC-signed Mercuryo widget URL — auth-gated, settles to the session's bound account |
| `POST` | `/webhooks/mercuryo` | Mercuryo callback receiver — verifies `X-Signature`, idempotent dedup |
| `GET`  | `/openapi.json` · `/docs` | OpenAPI 3.0 spec + Swagger UI |
| `GET`  | `/health` | Liveness |

The deposit lifecycle (quote, order state machine, settlement sweep, testnet
treasury bridge) lives in `src/orders` and `@getsava/sdk-mercuryo`; the two
Mercuryo routes wrap that service.

## Auth flow (SEP-10)

1. Client `GET /auth/sep10/challenge?account=G…` → a server-signed challenge tx.
2. Client signs it with the account key (on device, via Privy `signRawHash`).
3. Client `POST /auth/sep10/token { transaction }` → a session JWT bound to the
   account. The exchange is **stateless** — the server's own signature on the
   challenge is the integrity anchor, so nothing is stored between steps.

## Run locally

```bash
cp apps/backend/.dev.vars.example apps/backend/.dev.vars   # then fill it in
pnpm --filter @getsava/backend dev                          # wrangler dev → :8787
```

Generate a SEP-10 server key for `.dev.vars`:

```bash
pnpm --filter @getsava/backend exec tsx -e \
  "import {generateKeypair} from '@getsava/sdk-stellar';console.log(generateKeypair())"
```

## Test the four endpoints (Postman)

Signing a SEP-10 challenge needs the Stellar SDK, so the signed challenge is
produced by a helper; everything else (incl. the webhook HMAC) runs in Postman.

```bash
# 1. server running (above), .dev.vars filled
# 2. sign a challenge + emit a Postman environment:
pnpm --filter @getsava/backend sep10:sign --write-env
```

Import **`postman/sava-backend.postman_collection.json`** and the generated
**`postman/sava-local.postman_environment.json`**, select the environment, and
**Run** the collection. All four requests return 200; re-run request 4 to see the
idempotent webhook no-op (`idempotent: true`).

`sep10:sign` flags: `--base <url>` (default `http://localhost:8787`),
`--secret S…` (reuse a key), `--network testnet|mainnet`, `--write-env [path]`.

## Database

Postgres (Neon) is used only for durable, idempotent webhook dedup. Apply the
schema and set `DATABASE_URL`; without it the API uses an in-memory store
(local dev only).

```bash
psql "$DATABASE_URL" -f src/orders/schema.sql   # or: pnpm --filter @getsava/backend db:migrate
```

## Deploy

```bash
# secrets (never committed):
wrangler secret put SEP10_SERVER_SECRET
wrangler secret put SEP10_JWT_SECRET
wrangler secret put MERCURYO_WIDGET_SECRET
wrangler secret put MERCURYO_SIGN_KEY
wrangler secret put PRIVY_VERIFICATION_KEY   # optional (Privy binding)
wrangler secret put DATABASE_URL
pnpm --filter @getsava/backend deploy         # → api.getsava.app
```

## Test

```bash
pnpm --filter @getsava/backend test       # SEP-10 + JWT + routes + pg-store
```
