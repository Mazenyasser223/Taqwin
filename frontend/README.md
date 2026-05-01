# Taqwin Frontend

Frontend application for the Taqwin fitness platform, built with React and TypeScript.

## Overview

This app provides the user-facing experience for athletes, trainers, and gym owners, including:

- Authentication and onboarding flows
- Dashboards and progress visualization
- Workout and nutrition experiences
- Marketplace and community interfaces
- AI-assisted interactions

## Stack

- React 19
- TypeScript
- Vite
- React Router
- Zustand
- Tailwind CSS
- Three.js / React Three Fiber
- Framer Motion
- Recharts

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Environment Variables

Create a `.env` file in `frontend/`:

```env
VITE_API_URL=http://localhost:4000
GEMINI_API_KEY=your_api_key
```

### Run Development Server

```bash
npm run dev
```

Default URL: `http://localhost:3000`

## Scripts

- `npm run dev`: start local development server
- `npm run build`: create production build
- `npm run preview`: preview production build locally

## Directory Notes

```text
frontend/
|- 3d/         # 3D scene and visual components
|- components/ # shared and layout UI components
|- features/   # feature modules (auth, dashboard, workouts, etc.)
|- services/   # API integrations
|- store/      # state stores
`- lib/        # utility helpers
```

## Team Notes

- Keep API keys and tokens in `.env` only
- Do not commit generated files or dependencies
- Coordinate major UI changes through pull requests

## Related Documentation

- Main project guide: `../README.md`
- Additional docs: `../docs/`
