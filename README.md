# Sava

Non-custodial Turkish savings app — turn lira into USDC on Stellar, earn a variable yield on Blend (supply-only), and withdraw anytime. No seed phrase.

Turborepo + pnpm monorepo.

## Layout

- `apps/mobile` — Expo / React Native app
- `apps/backend` — Hono API on Cloudflare Workers (SEP-10 auth + Mercuryo URL signing)
- `packages/sdk-stellar` — Stellar helpers: config, Horizon, signing, SEP-10
- `packages/sdk-blend` — supply-only Blend v2 wrapper
- `packages/sdk-mercuryo` — Mercuryo widget URL signing + webhooks
- `packages/ui` · `packages/types` · `packages/config` — shared UI tokens, types, tooling

## Develop

```bash
pnpm install
pnpm check                            # lint · typecheck · test · i18n + marketing guards · build
pnpm --filter @getsava/mobile dev     # Expo dev server
pnpm --filter @getsava/backend dev    # backend (wrangler)
```

## Stack

Expo · React Native · TypeScript (strict) · Biome · Stellar · Blend v2 · Privy · Hono / Cloudflare Workers.
