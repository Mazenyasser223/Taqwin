# Taqwin AI Service (FastAPI)

Python service for AI Coach reasoning. **Phase 0–1:** health check + echo chat.

## Setup

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env
```

Set `AI_INTERNAL_KEY` to the same value as `backend-node/.env`.

## Run

```bash
uvicorn main:app --reload --port 8000
```

## Test

```bash
curl http://127.0.0.1:8000/health
curl -X POST http://127.0.0.1:8000/chat \
  -H "Content-Type: application/json" \
  -H "X-Internal-Key: your-key" \
  -d "{\"userId\":\"test\",\"locale\":\"ar\",\"messages\":[{\"role\":\"user\",\"content\":\"مرحباً\"}]}"
```

## Enable from Node

In `backend-node/.env`:

```env
AI_SERVICE_URL=http://127.0.0.1:8000
AI_INTERNAL_KEY=your-key
```

Restart the API. `POST /api/ai/chat` will proxy to this service.

See [CONTRACT.md](./CONTRACT.md) and [../docs/AI_COACH_ROADMAP.md](../docs/AI_COACH_ROADMAP.md).
