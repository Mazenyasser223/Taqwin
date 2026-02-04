# Taqwin

AI-powered fitness management platform — personalized workouts, nutrition, coaching, and gym management.

## Repository structure

| Folder           | Stack    | Purpose                                      |
|------------------|----------|----------------------------------------------|
| `frontend/`      | React    | Web app (trainee, trainer, gym dashboards)    |
| `backend-node/`  | Node.js  | Main API (auth, users, gyms, bookings, etc.) |
| `ai-service/`    | FastAPI  | AI engine (body analysis, nutrition, Gemini coach) |

## Getting started

- **Frontend:** `cd frontend && npm install && npm run dev`
- **Backend:** `cd backend-node && npm install && npm run dev`
- **AI service:** `cd ai-service && pip install -r requirements.txt && uvicorn main:app --reload`

## Documentation

- Project spec: see `TAQWIN.pdf` (local reference only; not in repo).
- Methodology and sprint plan: `docs/` (to be added).

## Team

Graduation project — Faculty.
