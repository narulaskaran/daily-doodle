# Daily Doodle - Claude Code Guide

## Project Overview

This is a T3 Stack app (Next.js + tRPC + Prisma + NextAuth + Tailwind CSS) with shadcn/ui components, deployed on Vercel.

## Tech Stack

- **Framework**: Next.js 15 (App Router, Turbopack)
- **API**: tRPC v11
- **Database**: Prisma v7 (SQLite for dev, swap for prod later)
- **Auth**: NextAuth v5 (not yet configured)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Language**: TypeScript (strict mode)
- **Testing**: Vitest
- **Deployment**: Vercel (auto-deploys from `main`)
- **CI**: GitHub Actions (typecheck + build + test)

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

Key env vars configured in Vercel: `UPLOADTHING_TOKEN`, `OPEN_ROUTER_KEY`.

## Vercel Project

- **Team**: `team_qxizXRyE1AjNBDMY6ejl7suU` (Karan Narula's projects)
- **Project ID**: `prj_EsYjoRlfjveRRG2tTRnI7tvBeVFv`
- **Production URL**: https://daily-doodle-pi.vercel.app

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
