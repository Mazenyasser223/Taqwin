# Taqwin Backend API

Backend service for the Taqwin fitness platform, built with Node.js, Express, and Prisma.

## Overview

This API provides the server-side foundation for:

- Authentication and authorization
- User and profile management
- Gym/trainer related domain operations
- Email-based verification flows
- Database-backed business logic

## Stack

- Node.js 18+
- Express
- Prisma ORM
- PostgreSQL
- JWT
- Passport Google OAuth
- Nodemailer

## Project Structure

```text
backend-node/
|- src/             # API source code (routes, middleware, services)
|- prisma/          # Prisma schema and migrations
|- .env.example     # Environment template
|- package.json
`- README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- PostgreSQL database (recommended: Supabase)

### PostgreSQL via Supabase (recommended)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **Project Settings → Database → Connection string** and choose **URI**.
3. Set `DATABASE_URL` in `.env` to that URI after replacing the password placeholder.  
   **Always append `?sslmode=require`** if it is not already in the URL.
4. If you use Supabase **pooling** (port `6543` / `pooler.supabase.com`) for `DATABASE_URL`, also set **`DIRECT_URL`** to the **direct** Postgres URL (port `5432`, `db.<project>.supabase.co`) so Prisma migrations can run.
5. From `backend-node`, run **`npm run db:migrate`** to apply Prisma migrations to the new database.

Keep using **one** `DATABASE_URL` per environment (do not split data across RDS and Supabase unless you are intentionally migrating).

### Install Dependencies

```bash
npm install
```

### Configure Environment

Create a local `.env` file from `.env.example`:

```bash
cp .env.example .env
```

If `cp` is not available on your shell, create `.env` manually and copy values from `.env.example`.

Minimum required variables for local development:

```env
PORT=4000
NODE_ENV=development
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=your-secret-min-32-chars-change-in-production
FRONTEND_URL=http://localhost:5173
```

Optional integrations:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` for Google OAuth
- `GMAIL_USER`, `GMAIL_APP_PASSWORD` for verification emails
- `MONGODB_URI` — optional; omit it to run with PostgreSQL only (default Phase 0 baseline)
- AWS and Redis fields when those services are enabled

### Database Setup

Apply migrations (required after pulling — includes profile fields for trainers/gyms):

```bash
npm run db:migrate
```

Generate Prisma client (if needed):

```bash
npm run db:generate
```

### Run API

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm run start
```

Default API URL: `http://localhost:4000`

## Scripts

- `npm run dev`: start with file watching
- `npm run start`: start without watcher
- `npm run db:generate`: generate Prisma client
- `npm run db:migrate`: deploy migrations
- `npm run db:migrate:dev`: create/apply dev migrations

## Security Notes

- Never commit `.env` or credentials
- Use a strong `JWT_SECRET` in all environments
- Restrict CORS to trusted frontend origins
- Auth routes are rate-limited (see `AUTH_RATE_LIMIT_MAX` in `.env.example`)
- Emergency admin migration routes require `EMERGENCY_MIGRATE_TOKEN` and header `x-emergency-migrate-token`
- `requireRole(...roles)` in `src/middleware/auth.js` for API RBAC (use after `authMiddleware`)
- Use production-grade secrets management for deployment

## Related Documentation

- Root project guide: `../README.md`
- Additional docs: `../docs/`

