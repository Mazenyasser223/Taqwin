# Taqwin AI Service (FastAPI)

Block **A2** skeleton: health check and `/chat` echo stub for the Node bridge (A3).

## Local run

```bash
cd ai-service
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- `GET http://localhost:8000/health` → `200`
- `POST http://localhost:8000/chat` → echoes last user message (stub)

## Tests

```bash
pytest
```

## Docker

```bash
docker build -t taqwin-ai .
docker run --rm -p 8000:8000 taqwin-ai
```

Production: `deploy/docker-compose.production.yml` profile `ai` (internal port 8000 only).

See [AI-COACH-ARCHITECTURE.md](../AI-COACH-ARCHITECTURE.md) for the full roadmap.
