# Deploying Smart i-n-E Tracker

The application uses two services: the Express API on Railway and the Vite
frontend on Vercel. Both providers can deploy directly from this repository.

## 1. Railway API

1. Add a PostgreSQL database to the Railway project.
2. Create a service from this GitHub repository. `railway.json` selects the
   root `Dockerfile`; Railway provides `PORT` automatically.
3. Set `DATABASE_URL` (use the Railway PostgreSQL reference), `JWT_SECRET`, and
   `CORS_ORIGINS`. Set `CORS_ORIGINS` to the Vercel production URL and any
   comma-separated preview/custom domains that should be allowed.
4. Optionally configure `OPENAI_API_KEY`, `EXCHANGE_RATES_API_KEY`,
   `TELEGRAM_BOT_TOKEN`, and `APP_URL` for their corresponding features.
5. Generate a Railway public domain and verify `GET /api/healthz` returns
   `{ "status": "ok" }`.

## 2. Vercel frontend

1. Import this repository as a Vercel project and leave the root directory at
   the repository root. `vercel.json` supplies the monorepo build settings and
   SPA fallback.
2. Add `VITE_API_URL` with the Railway public origin, without a trailing slash
   (for example, `https://smart-energy-api.up.railway.app`).
3. Deploy, then copy the production URL back into Railway's `CORS_ORIGINS` and
   redeploy the API.

Use the values and names in `.env.example` as a checklist. Never commit actual
credentials. A new Vercel deployment is required after changing a `VITE_*`
variable because Vite embeds it during the build.
