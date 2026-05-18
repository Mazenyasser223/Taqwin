# Taqwin

Taqwin is an AI-powered fitness platform developed as a graduation project. It connects athletes, trainers, and gym owners in one system with personalized plans, analytics, and management workflows.

## Project Scope

The platform supports three main user roles:

- Athletes: workout guidance, nutrition tracking, progress insights
- Trainers: client management and custom plans
- Gym owners: operations, members, and business visibility

## Repository Structure

```text
Taqwin/
|- backend-node/   # Node.js + Express API
|- frontend/       # React + TypeScript web app
|- docs/           # Setup and technical documentation
`- README.md
```

## Technology Stack

### Frontend

- React 19 with TypeScript
- Vite
- React Router
- Zustand
- Tailwind CSS
- Three.js / React Three Fiber
- Framer Motion
- Recharts

### Backend

- Node.js (>=18)
- Express
- Prisma ORM
- PostgreSQL
- JWT authentication
- Passport Google OAuth
- Nodemailer

## Quick Start

### 1) Prerequisites

- Node.js 18+
- npm
- PostgreSQL database access (recommended: Supabase free tier; see `backend-node/README.md`)

### 2) Backend Setup

```bash
cd backend-node
npm install
```

Create `.env` from `.env.example` and set required variables (database, auth, email, OAuth).

Run migrations and start the server:

```bash
npm run db:migrate
npm run dev
```

Backend default URL: `http://localhost:4000`

### 3) Frontend Setup

```bash
cd frontend
npm install
```

Copy `frontend/.env.example` to `.env` or `.env.local` and adjust if needed:

```env
VITE_API_URL=http://localhost:4000
GEMINI_API_KEY=your_api_key
```

Run the frontend:

```bash
npm run dev
```

Frontend default URL: `http://localhost:5173` (Vite)

## Useful Scripts

### Backend (`backend-node`)

- `npm run dev`: start API with watch mode
- `npm run start`: start API in production mode
- `npm run db:generate`: generate Prisma client
- `npm run db:migrate`: apply Prisma migrations
- `npm run db:migrate:dev`: create/apply dev migrations

### Frontend (`frontend`)

- `npm run dev`: start Vite dev server
- `npm run build`: production build
- `npm run preview`: preview production build locally

## Documentation

Detailed project docs are available in `docs/`:

- `docs/DATABASE-DESIGN.md`
- `docs/AWS-SETUP.md`
- `docs/GOOGLE-OAUTH-SETUP.md`
- `docs/EMAIL-VERIFICATION-SETUP.md`
- `docs/POSTGRES-WINDOWS-SETUP.md`

## Team Workflow

- Keep secrets in local `.env` files only
- Do not commit `node_modules`, build output, or private credentials
- Use feature branches and pull requests for team collaboration

## License

This repository is part of an academic graduation project and is intended for educational use.
