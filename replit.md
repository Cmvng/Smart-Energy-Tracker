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

**Demo credentials:** `demo@ine.app` / `Demo1234!`

### Color Scheme
- Deep navy `#0A1628` — headers/active nav
- Bright green `#00D37F` — income
- Coral red `#FF4757` — expenses
- Light gray `#F5F6FA` — page backgrounds

### Frontend Pages
- `/login` — JWT login form with demo credentials hint
- `/register` — User registration with mode (individual/business) and home currency selection
- `/dashboard` — Timeframe tabs (Today/Week/Month/Year), income/expense/net cards, smart insight banner, grouped transaction list with ⋮ edit/delete menus, FAB "+" button, "View All →" link
- `/history` — Full transaction history: sticky filters (date range, type, sort), real-time search, paginated list (50 at a time), ⋮ edit/delete per row, bulk select+delete mode
- `/analytics` — 7d/30d bar chart (recharts), net P&L line chart, smart insight cards, stats row
- `/import` — Document import: accepts PDF, CSV, JPG, PNG, WebP (up to 20MB). Processing priority: CSV (instant) → PDF text extraction (free, if ≥5 tx) → OpenAI gpt-4o Vision (PDFs + images). SSE streaming for PDFs/images: live page progress bar + "taking longer" message after 30s. Review stage: per-row currency dropdown, confidence badges, select/deselect all. Locked/unreadable → amber card with CSV download tips. Import history with delete.
- `/settings` — User profile, home currency, individual/business mode, notification frequency, CSV export, exchange rate refresh, test reminder, logout

### Bottom Navigation
Persistent across all protected pages: Home | Add | Analytics | Import | Settings
- "Add" tab triggers the Quick Add bottom sheet (no separate route)

### Quick Add Bottom Sheet
- Triggered by FAB button or "Add" tab in bottom nav
- Inline bottom sheet modal (not a separate route)
- Income/expense toggle, amount input, currency selector with live FX preview, notes, date/time
- Shows success toast then auto-closes after 1.5 seconds

### Onboarding (4 screens)
- Screen 1: Welcome/branding
- Screen 2: Individual/Business mode selection
- Screen 3: Home currency selector with search
- Screen 4: Notification preference + completion
- Stored in `localStorage` as `ine_onboarding_done`

## Auth & localStorage Keys

- Token key: `ine_token` (JWT, 7-day expiry)
- User key: `ine_user` (JSON stringified user profile)
- Onboarding key: `ine_onboarding_done`
- API client auth configured via `setAuthTokenGetter(() => localStorage.getItem("ine_token"))` in `main.tsx`

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (port auto-assigned)
│   └── smart-ine-tracker/  # React + Vite frontend (at /)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks + setAuthTokenGetter
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
4. **currencies** — code (PK), name, rate_to_usd, rate_updated_at (seeded with 20 currencies)
5. **analytics_snapshots** — id (uuid), user_id (FK), timeframe, total_income_usd, total_expense_usd, net_usd, period_start, period_end

**FX conversion:** `rate_to_usd` is the value of 1 unit of the currency in USD (e.g., EUR=0.92 means 1 EUR = $0.92 USD).
Formula: `amount_usd = amount_original * rate_to_usd`

## API Routes

### Auth
- `GET /api/healthz` — Health check
- `POST /api/auth/register` — Register user + create default account, returns JWT + user
- `POST /api/auth/login` — Validate credentials, returns JWT + user
- `GET /api/auth/me` — Get current user (requires Bearer token)

### User
- `PATCH /api/user` — Update home_currency, mode, notification_frequency

### Currencies
- `GET /api/currencies` — List all currencies with rates (20 seeded)
- `POST /api/currencies/refresh` — Fetch live rates from openexchangerates.org (requires EXCHANGE_RATES_API_KEY)

### Transactions
- `POST /api/transactions` — Create transaction (auto-detects user's account, FX conversion)
- `GET /api/transactions` — List with ?timeframe=day|week|month|year OR ?from=&to=&type=&sort=&search=&limit=&offset= (history/paginated mode returns {transactions,total})
- `GET /api/transactions/summary` — Income/expense/net/insight_message summary for a timeframe
- `PATCH /api/transactions/:id` — Update transaction (re-calculates amount_usd from current rate; ownership-checked, returns 403 if unauthorized)
- `DELETE /api/transactions/:id` — Soft delete (sets deleted_at; ownership-checked)

### Analytics
- `GET /api/analytics/chart?days=7|30` — Daily P&L chart data
- `GET /api/analytics/insights` — Smart plain-English insights

### Export
- `GET /api/export/csv` — Download all transactions as CSV file

### Notifications
- `POST /api/notifications/test` — Send a test reminder notification

## Seed Data

On startup (`index.ts`), the API server automatically:
1. Seeds 20 currencies (with correct `rate_to_usd` values using `onConflictDoUpdate`)
2. Creates demo user `demo@ine.app` / `Demo1234!` with 10 sample transactions (if not exists)

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

- Never use `import { z } from "zod"` in `artifacts/api-server` — zod is not a direct dependency.
- Auth endpoints return `user` (not `account_id`) in the response; `account_id` is no longer stored in localStorage.
- API auto-detects the user's account from JWT on every transaction create.
- Trust proxy is set to 1 for rate limiting to work correctly behind Replit's proxy.
- Rate limiting: 100 requests per 15 minutes on `/api/*` routes.
