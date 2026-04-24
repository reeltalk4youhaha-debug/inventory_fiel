# Inventory Fiel

React + Vite inventory app with a PostgreSQL-backed API. It now supports three deployment paths:

- local development with the existing `Express` server in `server/`
- production deployment on `Netlify` using `netlify/functions/api.js`
- production deployment on `Vercel` using `api/[...path].js`

## Local development

1. Copy `.env.example` to `.env`.
2. Point `DATABASE_URL` to your PostgreSQL database, or use the individual `DB_*` variables instead.
3. Run the frontend:

```bash
npm run dev
```

4. Run the API in a second terminal:

```bash
npm run server
```

The Vite dev server proxies `/api/*` requests to `http://localhost:4000`.

## Supabase setup

1. Create a Supabase project.
2. Open the SQL editor and run [`sql/inventory_hq_schema.sql`](./sql/inventory_hq_schema.sql).
3. Replace the seeded admin email and password in that SQL file before using it in production.
4. Copy the Supabase transaction pooler connection string into `DATABASE_URL`.

Important:

- `pgcrypto` is required because the login flow uses PostgreSQL `crypt(...)`.
- For Netlify Functions, use the Supabase transaction pooler connection string on port `6543`.
- Keep `DB_SCHEMA=inventory_hq` unless you change the schema name in the SQL file too.

## Netlify deployment

This repo is configured for Netlify with [`netlify.toml`](./netlify.toml).

Build settings:

- Build command: `npm run build`
- Publish directory: `dist`

Netlify environment variables:

- `DATABASE_URL`
- `DB_SCHEMA`
- `DB_SSL=true`
- `SESSION_SECRET`
- `VITE_API_URL`

Notes:

- Leave `VITE_API_URL` empty when the frontend and API are both served from the same Netlify site.
- The `/api/*` routes are rewritten to the Netlify function at `netlify/functions/api.js`.
- Auth now requires a signed session token, so `SESSION_SECRET` must be set in production.

## Vercel deployment

This repo is now also configured for Vercel using the serverless route at [`api/[...path].js`](./api/[...path].js).

Suggested Vercel settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

Vercel environment variables:

- `DATABASE_URL`
- `DB_SCHEMA`
- `DB_SSL=true`
- `SESSION_SECRET`
- `VITE_API_URL`

Notes:

- Leave `VITE_API_URL` empty when the frontend and API are both deployed on the same Vercel project.
- The Vercel API route handles `/api/auth/*`, `/api/profile/*`, `/api/products/*`, and `/api/health`.
- The health endpoint now checks the database connection, schema, and table presence instead of returning a static response.
- For Supabase on Vercel, prefer the pooled `DATABASE_URL` connection string.

## Scripts

- `npm run dev` starts the Vite client
- `npm run server` starts the Express API
- `npm run build` creates the production bundle
- `npm run preview` previews the built frontend
