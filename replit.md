# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: JWT (jsonwebtoken) + bcryptjs

## Application: Smart i-n-E Tracker

A full-stack Income & Expense Tracker app with:
- **Frontend**: React + Vite, mobile-first (max 430px), fintech color scheme
  - Deep navy (#0A1628) headers
  - Bright green (#00D37F) for income
  - Coral red (#FF4757) for expenses
  - Light gray (#F5F6FA) page background
- **Auth pages**: /login and /register
- **Dashboard**: Placeholder at /dashboard (Phase 2)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (port auto-assigned)
│   └── smart-ine-tracker/  # React + Vite frontend (at /)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Database Schema

1. **users** — id (uuid), email, password_hash, name, mode (individual/business), home_currency, created_at
2. **accounts** — id (uuid), user_id (FK), type, label, created_at
3. **transactions** — id (uuid), account_id (FK), type (income/expense), amount_original, currency_code, amount_usd, fx_rate_used, notes, transacted_at, synced, created_at
4. **currencies** — code (PK), name, rate_to_usd, rate_updated_at (seeded with 30 currencies)
5. **analytics_snapshots** — id (uuid), user_id (FK), timeframe, total_income_usd, total_expense_usd, net_usd, period_start, period_end

## API Routes

- `GET /api/healthz` — Health check
- `POST /api/auth/register` — Register user + create default account, returns JWT
- `POST /api/auth/login` — Validate credentials, returns JWT
- `GET /api/auth/me` — Get current user (requires Bearer token)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/auth.ts` handles auth
- Auth: `src/middlewares/auth.ts` — JWT creation and `requireAuth` middleware
- Depends on: `@workspace/db`, `@workspace/api-zod`, `jsonwebtoken`, `bcryptjs`

### `artifacts/smart-ine-tracker` (`@workspace/smart-ine-tracker`)

React + Vite frontend. Mobile-first (max-width 430px). Uses React Router for routing.

- Pages: `/login`, `/register`, `/dashboard`
- Auth context in `src/lib/auth.tsx`
- Depends on: `@workspace/api-client-react`, `react-hook-form`, `@hookform/resolvers`, `framer-motion`

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

- `pnpm --filter @workspace/db run push` — push schema changes to DB

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec. Run codegen: `pnpm --filter @workspace/api-spec run codegen`
