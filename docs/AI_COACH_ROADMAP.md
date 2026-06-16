# AI Coach roadmap (FastAPI target)

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | `ai-service/` FastAPI + env + contract | Done |
| 1 | Node proxies `POST /api/ai/chat` → FastAPI echo | Done |
| 2 | `contextBundle` + Claude in FastAPI | Next |
| 3 | RAG (Chroma / vectors) in FastAPI | Planned |
| 4 | Tools via `/api/internal/ai/*` in Node | Planned |
| 5 | LangGraph agent | Planned |

## Legacy (Node-only AI)

Until `AI_SERVICE_URL` is set, `/api/ai/chat` uses the existing Node stack:

- `aiChatProvider.js`, `coachContext.js`, Mongo plans, book RAG

See [backend-node/docs/AI_ARCHITECTURE.md](../backend-node/docs/AI_ARCHITECTURE.md).

## Run both services locally

```bash
# Terminal 1
cd ai-service && uvicorn main:app --reload --port 8000

# Terminal 2 — set AI_SERVICE_URL in backend-node/.env
npm run dev
```

Or from repo root: `npm run dev:ai` + `npm run dev`.
