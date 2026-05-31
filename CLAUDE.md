# CLAUDE.md

Guidance for agents working in this repo (**getsava**).

## Commit messages

- Use **Conventional Commits**: `type(scope): subject`
  (types: `feat fix docs style refactor perf test build ci chore revert`).
- **Do NOT include Linear/issue IDs (e.g. `YK-486`) in commit messages.**
  The `commit-msg` hook rejects any message containing one.
- **Keep messages simple — a single subject line only.** No multi-line bodies or
  detailed descriptions.
- One logical change per commit. Commit or push **only when asked**.

## Project

- `getsava` is a Turborepo + pnpm monorepo for the **Sava** app — a non-custodial
  Turkish savings app (TRY → USDC on Stellar, Blend v2 yield, supply-only).
- Backlog lives in **Linear** (team Yk-Labs, project "Sava"); read issues there.
- Workspace packages use the **`@getsava/*`** scope.

## Layout

```
apps/mobile (Expo)      apps/backend (Hono on Cloudflare Workers)
packages/config (shared tsconfig + biome + CI-guard logic)
packages/types  packages/ui  packages/sdk-blend  packages/sdk-stellar
```

`reference-mvp/` (gitignored) is the previous MVP, read-only — copy proven
integration details only; do not inherit its architecture/UI/security.

## Commands (from repo root)

- `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`
- `pnpm i18n:check` · `pnpm terms:check` — CI guards (EN/TR locale parity +
  banned marketing terms)
- `pnpm check` runs the full set CI runs.

## Conventions

- TypeScript strict everywhere; Biome for lint + format.
- Every user-facing string comes from i18n files (EN default + full TR parity).
- All Blend access goes through `@getsava/sdk-blend` (supply-only). Secrets are
  server-side only; never in the client or logs.
