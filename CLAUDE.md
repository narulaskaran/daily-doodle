# Daily Doodle - Claude Code Guide

## Project Overview

This is a T3 Stack app (Next.js + tRPC + Prisma + NextAuth + Tailwind CSS) with shadcn/ui components, deployed on Vercel.

## Tech Stack

- **Framework**: Next.js 15 (App Router, Turbopack)
- **API**: tRPC v11
- **Database**: Prisma v7 (PostgreSQL in prod, SQLite for tests)
- **Auth**: NextAuth v5 (not yet configured)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Language**: TypeScript (strict mode)
- **Testing**: Vitest
- **Deployment**: Vercel (auto-deploys from `main`)
- **CI**: GitHub Actions (typecheck + build + test + migrate)

## Key Paths

- `src/app/` - Next.js App Router pages and layouts
- `src/app/_components/` - React components
- `src/server/api/` - tRPC routers and procedures
- `src/server/db.ts` - Prisma client
- `src/server/auth/` - NextAuth configuration
- `src/styles/globals.css` - Global styles + Tailwind + shadcn theme
- `src/lib/utils.ts` - Utility functions (cn helper)
- `prisma/schema.prisma` - Database schema
- `components.json` - shadcn/ui configuration

## Path Aliases

- `~/` maps to `./src/` (e.g., `import { cn } from "~/lib/utils"`)

## Commands

- `npm run dev` - Start dev server with Turbopack
- `npm run build` - Production build (use `SKIP_ENV_VALIDATION=1` when env vars are missing)
- `npm run typecheck` - TypeScript type checking
- `npm run test` - Run Vitest tests
- `npm run db:push` - Push Prisma schema to database
- `npm run db:seed` - Seed database with sample data
- `npm run db:generate` - Run Prisma migrations (dev)
- `npm run db:migrate` - Deploy Prisma migrations (prod)
- `npm run db:studio` - Open Prisma Studio

## Adding shadcn Components

```bash
npx shadcn@latest add <component-name>
```

Components are installed to `src/components/ui/`.

## Environment Variables

See `.env.example` for required variables. Never commit `.env` files.

Key env vars configured in Vercel: `UPLOADTHING_TOKEN`, `OPEN_ROUTER_KEY`, `REPLICATE_API_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

## Vercel Project

- **Team**: `team_qxizXRyE1AjNBDMY6ejl7suU` (Karan Narula's projects)
- **Project ID**: `prj_EsYjoRlfjveRRG2tTRnI7tvBeVFv`
- **Production URL**: https://daily-doodle-pi.vercel.app

## Database Migrations

Migrations are fully automated via CI. No manual DB steps are needed on deploy.

- **Schema changes**: Edit `prisma/schema.prisma`, then run `npx prisma migrate dev --name <name>` locally to generate a migration file in `prisma/migrations/`
- **Data seeds**: Write seed data as SQL INSERT statements in a new migration file (see `prisma/migrations/20260310000000_seed_prompt_ideas/` for an example). Use `ON CONFLICT DO NOTHING` for idempotency.
- **CI pipeline** (on push to `main`):
  1. `build` job: typecheck + build + test (no DB connection needed)
  2. `migrate` job: runs `prisma migrate deploy` against prod DB via `DATABASE_URL_UNPOOLED` secret
- **Vercel build**: Only runs `prisma generate && next build` (client generation, no migrations)
- **Prompt ideas**: Stored in the `PromptIdea` table. The cron job draws from this table via mix-and-match. Add new prompts via SQL migrations, not by editing hardcoded arrays.
- **Local seeding**: `npm run db:seed` runs `prisma/seed.ts` for local dev (also runs automatically on `prisma migrate dev` and `prisma migrate reset`)

**Never use `prisma db push` in CI or production** — always use migration files so changes are tracked and reproducible.

## Image Generation (Replicate)

- **Shared utility**: `src/lib/replicate.ts` exports `generateImageWithFlux(prompt)` — use this for ALL Replicate image generation. Both the nightly cron (`/api/cron/generate-daily`) and the admin generate button (`/api/generate`) use it.
- **Rate limiting**: `src/lib/replicate-ratelimit.ts` enforces a 10s local delay between calls (for burst-1 rate limit on low-credit accounts) plus a distributed Redis rate limiter via `@upstash/ratelimit` + `@upstash/redis` when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set.
- **Replicate SDK output**: The SDK returns `FileOutput` objects (extends `ReadableStream`, has `.blob()`) — NOT `Blob`. The shared utility handles this. Never call `.arrayBuffer()` directly on Replicate output.
- **Do NOT** duplicate the Replicate client or image generation logic in route files — always import from `~/lib/replicate`.

---

## Agent Guidelines

### Pre-Push Verification (REQUIRED)

Before pushing any code, you MUST pass all three checks locally:

1. **`npm run typecheck`** - Zero type errors
2. **`SKIP_ENV_VALIDATION=1 npm run build`** - Clean production build
3. **`SKIP_ENV_VALIDATION=1 npm run test`** - All tests pass

Do not push code that fails any of these checks.

### Post-Push Verification (REQUIRED)

After pushing to `main`, you MUST monitor both CI and Vercel deployment until they succeed. This is not optional — the branch must be left in a healthy state.

1. **Watch GitHub Actions CI**: `gh run list --limit 1` then `gh run watch <run-id> --exit-status`
2. **Watch Vercel deployment**: Use the Vercel MCP tools (`list_deployments`, `get_deployment`) to confirm the deployment reaches `READY` state
3. **If either fails**: Read the logs (`gh run view <run-id> --log-failed` for CI, `get_deployment_build_logs` for Vercel), fix the issue, and push again. Repeat until both are green.

Never leave `main` in a broken state. If you pushed a breaking change, fix it before finishing your task.

### Testing

- Write tests for new tRPC routers and significant business logic
- Tests use an isolated SQLite file (`prisma/test.sqlite`) created via better-sqlite3 directly (avoids Prisma CLI agent safety checks)
- Mock `next-auth`, `next/headers`, and `server-only` in test files that import tRPC routers
- Tests run in CI with `SKIP_ENV_VALIDATION=1`

### Code Conventions

- Use `~/` path alias for all `src/` imports
- Server components are the default; add `"use client"` only when needed
- Use shadcn/ui components from `~/components/ui/` for UI
- tRPC routers go in `src/server/api/routers/` and are registered in `root.ts`
- Public pages should use `export const dynamic = "force-dynamic"` if they call tRPC at render time (avoids build-time DB access)
