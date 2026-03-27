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

A full-stack mobile-first (max 430px) Income & Expense Tracker with JWT auth, multi-currency FX conversion, analytics, and settings.

**Demo credentials:** `demo@smartine.app` / `demo1234`

### Color Scheme
- Deep navy `#0A1628` — headers/active nav
- Bright green `#00D37F` — income
- Coral red `#FF4757` — expenses
- Light gray `#F7F8FA` — page backgrounds

### Frontend Pages
- `/login` — JWT login form
- `/register` — User registration
- `/dashboard` — Timeframe tabs (Today/Week/Month/Year), income/expense/net cards, insight banner, transaction list, FAB "+" button
- `/add` — Add income/expense transaction with currency selector (30 currencies), FX conversion
- `/analytics` — 30-day bar chart (recharts), 7d/30d/3mo timeframe tabs, smart insight cards, quick stats
- `/settings` — User profile, home currency, individual/business mode, notification frequency, CSV export, exchange rate refresh, logout

### Bottom Navigation
Persistent across all protected pages: Home | Add | Analytics | Settings

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

1. **users** — id (uuid), email, password_hash, name, mode (individual/business), home_currency, notification_frequency, created_at
2. **accounts** — id (uuid), user_id (FK), type, label, created_at
3. **transactions** — id (uuid), account_id (FK), type (income/expense), amount_original, currency_code, amount_usd, fx_rate_used, notes, transacted_at, deleted_at, synced, created_at
4. **currencies** — code (PK), name, rate_to_usd, rate_updated_at (seeded with 30 currencies)
5. **analytics_snapshots** — id (uuid), user_id (FK), timeframe, total_income_usd, total_expense_usd, net_usd, period_start, period_end

**FX conversion:** `rate_to_usd` stores units of foreign currency per 1 USD. To convert to USD: `amount_usd = amount_original / rate_to_usd`.

## API Routes

### Auth
- `GET /api/healthz` — Health check
- `POST /api/auth/register` — Register user + create default account, returns JWT + account_id
- `POST /api/auth/login` — Validate credentials, returns JWT + account_id
- `GET /api/auth/me` — Get current user (requires Bearer token)

### User
- `PATCH /api/user` — Update home_currency, mode, notification_frequency

### Currencies
- `GET /api/currencies` — List all 30 currencies with rates
- `POST /api/currencies/refresh` — Fetch live rates (requires EXCHANGE_RATES_API_KEY env var)

### Transactions
- `POST /api/transactions` — Create transaction with FX conversion
- `GET /api/transactions` — Paginated list with ?timeframe=day|week|month|year&type=income|expense
- `GET /api/transactions/summary` — Income/expense/net summary for a timeframe
- `DELETE /api/transactions/:id` — Soft delete

### Analytics
- `GET /api/analytics/chart?days=30` — Daily P&L chart data for the last N days
- `GET /api/analytics/insights` — 3+ plain-English insights (spending rate, best day, week trend, loss streak)

### Export
- `GET /api/export/csv` — Download all transactions as CSV file

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client + Zod types from OpenAPI spec
- `pnpm --filter @workspace/db run push-force` — push schema changes to DB

## Important Notes

- Never use `import { z } from "zod"` in `artifacts/api-server` — zod is not a direct dependency. Validate manually or use the workspace catalog.
- Auth endpoints return `account_id` in the user object so the frontend can store it in `localStorage` for transaction creation.
- `account_id` is stored in `localStorage` as `"account_id"` after login/register.
- JWT token stored in `localStorage` as `"token"`, 7-day expiry.
