# Daily Doodle - Claude Code Guide

## Project Overview

This is a T3 Stack app (Next.js + tRPC + Prisma + NextAuth + Tailwind CSS) with shadcn/ui components, deployed on Vercel.

## Tech Stack

- **Framework**: Next.js 15 (App Router, Turbopack)
- **API**: tRPC v11
- **Database**: Prisma (SQLite for dev, swap for prod later)
- **Auth**: NextAuth v5 (not yet configured)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Language**: TypeScript (strict mode)
- **Deployment**: Vercel
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
- `npm run build` - Production build
- `npm run typecheck` - TypeScript type checking
- `npm run test` - Run tests
- `npm run db:push` - Push Prisma schema to database
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

## Agent Guidelines

See [agents.md](./agents.md) for AI agent-specific rules and conventions.
