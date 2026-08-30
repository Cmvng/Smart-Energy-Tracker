# Railway deployment

Railway is the recommended target for this project because the application uses a persistent Express server, PostgreSQL, Python and Poppler document processing, Telegram polling, and scheduled jobs.

## Services

1. Create a Railway project from this GitHub repository.
2. Add a PostgreSQL service.
3. Deploy the repository as one web service. Railway automatically uses the included `Dockerfile`.
4. Generate a public domain for the web service.

## Required variables

- `DATABASE_URL`: use Railway's PostgreSQL reference variable.
- `JWT_SECRET`: a random value containing at least 32 characters.
- `APP_URL`: the final public `https://` domain. Use comma-separated origins only when more than one frontend must call the API.
- `PORT`: Railway supplies this automatically.

Optional features use `OPENAI_API_KEY`, `EXCHANGE_RATES_API_KEY`, and `TELEGRAM_BOT_TOKEN`. Keep `SEED_DEMO_USER=false` in production.

## First database setup

Run this once against the Railway PostgreSQL database before opening registration:

```bash
pnpm db:push
```

Do not run schema push automatically on every web process restart. Future production schema changes should be converted to versioned migrations.

## Health check

Configure Railway's health-check path as `/api/healthz`.

## Deployment verification

After deploy, verify `/api/healthz`, registration and login, transaction creation, CSV import/export, direct navigation to `/dashboard`, and Telegram/OpenAI features when their variables are configured.
