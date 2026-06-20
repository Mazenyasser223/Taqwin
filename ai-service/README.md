# Taqwin AI Service (FastAPI)

Python microservice for coach chat, intent routing, greeting fast-path, RAG retrieval, plan generation/adaptation, meal vision, memory summarization, and the LangGraph tool agent. Node.js proxies authenticated user traffic here; internal routes call back into Node for tool execution and CAG context.

## Architecture

```text
Frontend → Node WebSocket/REST → FastAPI /chat[/stream]
                ↓                         ↓
         chatMemory (Mongo)        intent → greeting | RAG → LLM + tools
                ↓                         ↓
         aiToolExecutor            Node /internal/ai/tools/execute
         AiMemory / traces
```

Greeting messages (`hi`, `مرحبا`, …) bypass the LLM via a dedicated graph node and matching Node fast-path in `coachGreeting.js`.

## Project structure

```text
ai-service/
├── README.md
├── requirements.txt               # Runtime dependencies (FastAPI, LangGraph, httpx, …)
├── requirements-eval.txt          # RAGAS evaluation extras
├── pytest.ini
├── .env.example
│
├── app/
│   ├── main.py                    # FastAPI app — mounts all routers
│   ├── config.py                  # pydantic-settings (env vars)
│   │
│   ├── routers/
│   │   ├── health.py              # GET /health
│   │   ├── chat.py                # POST /chat, /chat/resume, streaming
│   │   ├── intent.py              # Intent classification debug
│   │   ├── rag.py                 # POST /rag/retrieve
│   │   ├── plan.py                # POST /plan/generate, /plan/adapt
│   │   ├── meal_vision.py         # Meal photo analysis endpoints
│   │   ├── memory.py              # POST /internal/memory/summarize
│   │   └── tools.py               # GET /tools (chat-shipped registry)
│   │
│   ├── agent/
│   │   ├── coach_graph.py         # Coach LangGraph: safety → intent → greeting/RAG → tool loop
│   │   ├── coach_stream.py        # Token streaming for WebSocket bridge
│   │   ├── graph.py               # Execution subgraph: extract → execute → retry
│   │   ├── runner.py              # Confirmed-action resume runner
│   │   ├── state.py               # Typed agent state
│   │   └── tools/
│   │       ├── registry.py        # ~47 chat-shipped tools
│   │       ├── shipped.py         # Tool definitions synced with Node
│   │       ├── step_up_config.py  # Step-up auth tool config
│   │       └── validate.py        # JSON-schema input validation
│   │
│   ├── intent/
│   │   ├── intents.py             # Intent enum + routing metadata
│   │   ├── router.py              # Rule + LLM intent router
│   │   ├── greetings.py           # Greeting detection + localized reply builder
│   │   ├── rules.py               # Rule-based intent patterns
│   │   ├── llm.py                 # LLM intent classifier
│   │   └── semantic.py            # Semantic intent helpers
│   │
│   ├── rag/
│   │   ├── levels.py              # L1–L5 level definitions
│   │   ├── query_rewrite.py       # Arabic slang + CAG query enrichment
│   │   ├── metadata_filters.py    # Intent + CAG → SQL metadata filters
│   │   ├── rerank.py              # Cohere/Voyage/local cross-encoder rerank
│   │   ├── scores.py              # Per-level min scores + L5 injection policy
│   │   ├── citations.py           # Citation formatting
│   │   └── retriever.py           # Hybrid → rerank → dedupe → prompt
│   │
│   ├── prompts/
│   │   ├── coach_system.py        # Coach system prompt
│   │   └── plan_prompts.py        # Plan generation/adaptation prompts (template-fill)
│   │
│   ├── services/
│   │   ├── llm_chat.py            # LLM provider abstraction
│   │   ├── tool_loop.py           # Bounded tool loop (max 5 turns)
│   │   ├── tool_extract.py        # Structured arg extraction
│   │   ├── compound_planner.py    # Multi-step compound request decomposition
│   │   ├── turn_classify.py       # Turn-level classification
│   │   ├── action_detect.py       # Action intent detection
│   │   ├── cag_sanitize.py        # Context bundle sanitization (parity with Node)
│   │   ├── chat_observability.py  # Trace/logging helpers
│   │   ├── memory_summarize.py    # Chat → AiMemory facts
│   │   ├── plan_generate.py       # Plan JSON generation
│   │   ├── plan_adapt.py          # Plan adaptation hints
│   │   ├── plan_candidates.py     # Candidate plan scaffolding
│   │   ├── plan_json.py           # Plan JSON parsing/validation
│   │   └── plan_scaffold.py       # Plan structure scaffolding
│   │
│   ├── clients/
│   │   └── node_internal.py       # HTTP client for Node internal API
│   │
│   └── eval/
│       └── baseline.py            # RAG eval baseline gates
│
├── eval/
│   ├── baseline.json              # Checked-in RAGAS floor thresholds
│   ├── golden_dataset.json        # Golden RAG test cases
│   └── results/                   # Run artifacts (gitignored)
│
├── scripts/
│   ├── eval_rag_ragas.py          # Full RAGAS evaluation
│   ├── list_chat_tools.py         # Print chat-shipped tool list
│   ├── verify_b6.py / verify_b7.py / verify_c1.py
│   ├── verify_cag_parity.py       # CAG sanitize parity with Node
│   ├── smoke_tier1_rag.py / smoke_tier2_rag.py
│   ├── diagnose_plan_claude.py    # Plan generation diagnostics
│   └── generate_golden_dataset.py # Golden dataset maintenance
│
└── tests/
    ├── conftest.py
    ├── test_coach_graph.py
    ├── test_greetings.py
    ├── test_router.py / test_intent.py / test_intent_api.py
    ├── test_agent_graph.py / test_tool_loop.py / test_tool_registry.py
    ├── test_retriever.py / test_rag_router.py / test_tier2_rag.py
    ├── test_plan_prompts.py / test_plan_prompt_contract.py
    ├── test_plan_template_ai.py / test_plan_catalog_stable.py
    ├── test_memory_summarize.py / test_cag_sanitize.py
    └── …                            # See ai-service/tests/ for full list
```

## Local run

```bash
cd ai-service
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

From repo root: `npm run dev:ai`

### Environment (`ai-service/.env`)

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude provider (or use Gemini/Ollama vars) |
| `AI_INTERNAL_KEY` | Shared secret with Node internal routes |
| `NODE_INTERNAL_API_URL` | Node base URL (default `http://localhost:4000`) |
| `LOG_LEVEL` | Logging verbosity |
| `RAG_MIN_SCORE_L1` … `L5` | Per-level cosine score floors (weak chunks dropped) |
| `RAG_MIN_SCORE_L5_LIGHT` | Stricter L5 floor for nutrition/workout intents |
| `RAG_L5_LIGHT_LIMIT` | Max L5 chunks for nutrition/workout (default `2`) |
| `RAG_L5_SKIP_WHEN_CATALOG_SCORE` | Drop L5 when L2/L3 top score ≥ this (default `0.42`) |

### Node bridge (`backend-node/.env`)

```env
FEATURE_AI_VIA_FASTAPI=true
AI_SERVICE_URL=http://localhost:8000
AI_INTERNAL_KEY=<same as ai-service>
```

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| POST | `/chat` | Coach chat + tool confirmation |
| POST | `/chat/resume` | Execute confirmed action after user approval |
| POST | `/chat/stream` | Streaming coach tokens (WebSocket bridge) |
| POST | `/rag/retrieve` | Debug RAG retrieval |
| POST | `/plan/generate` | Generate plan JSON |
| POST | `/plan/adapt` | Plan adaptation hint |
| GET | `/tools` | Chat-shipped tool registry |
| POST | `/internal/memory/summarize` | Chat → AiMemory facts (Node worker persists) |

## Coach tool pipeline

1. User asks to log food, swap exercise, set life mode, adapt plan, etc.
2. Intent router classifies → confirmation prompt with `actionId`
3. User confirms → `agent/runner.py` extracts structured args → Node executes tools (max 5)
4. Dashboard cache + CAG invalidated in Node

**Greetings** are detected by `intent/greetings.py` and answered locally (no LLM call) in both FastAPI and Node WebSocket paths.

**Compound requests** (e.g. “lose 5kg and travel next week”): `compound_planner.py` decomposes into ordered steps → one confirmation → sequential execution on resume.

**LangGraph graphs:**

- `coach_graph.py` — safety → intent → greeting | clarify | RAG → bounded tool loop → confirm
- `graph.py` — extract → execute → retry (max 3); writes always require user confirmation

Tool registry: `app/agent/tools/registry.py` (~47 chat-shipped tools). Stubs like `generate_weekly_*` are excluded from chat.

## Tests

```bash
cd ai-service
pip install -r requirements.txt
pytest
```

## RAG retriever (Tier 1)

Coach chat retrieval in `app/rag/retriever.py`:

1. **Intent router** — skips RAG for `personal_status`, `execute_action`, `greeting`, `unclear`.
2. **Query rewrite** — Arabic fitness slang + intent suffix + CAG profile hints → English embedding query.
3. **Parallel search** — L1/L2/L3/L5 levels searched concurrently via `ThreadPoolExecutor`.
4. **Locale** — `locale` passed to Node; Arabic users prefer `ar` chunks with `en` fallback.
5. **Score floors** — level-specific `minScore` filters weak matches before prompt injection.
6. **Smart L5** — full philosophy for `scientific` / `life_mode` / `general`; light or dropped for `nutrition` / `workout` when catalog chunks score high.

Debug: `POST /rag/retrieve` accepts optional `contextBundle` (same shape as chat) for CAG-aware query rewrite.

**Verify (no Python required):** from `backend-node`: `npm run verify:b6`. Python path: `python scripts/verify_b6.py` in ai-service.

## RAG retriever (Tier 2)

Professional-grade retrieval stack on top of Tier 1:

```
Query → query rewrite (CAG) → hybrid retrieve top-K → rerank → minScore + dedupe → format_rag_context
```

| Feature | Implementation |
|---------|----------------|
| **Hybrid search** | Node `hybridSearch.js`: pgvector cosine + Postgres `tsvector` + `pg_trgm`; fused with **RRF** |
| **Cross-encoder rerank** | `app/rag/rerank.py` — Cohere, Voyage, or local cross-encoder |
| **Metadata filters** | `metadata_filters.py` → Node SQL filters: muscles, difficulty, diet, allergens |
| **CAG-informed rewrite** | `query_rewrite.py` — injuries, today's workout/food, goal, lifeMode, memories |
| **Parent-child chunks** | Small **child** chunks embedded; **parent** holds full section for LLM context |

**Deploy steps after pull:**

1. Run migration: `npx prisma migrate deploy` (search_vector, parent_id, chunk_role, trigram index).
2. Re-ingest or backfill: `npm run rag:backfill:search-vector` then re-run `rag:ingest:l2/l3/l1/l5`.
3. Set `COHERE_API_KEY` (or `VOYAGE_API_KEY`) on ai-service for reranking, or `RAG_RERANK_PROVIDER=none`.

## RAG evaluation (RAGAS)

Golden set: `eval/golden_dataset.json`. Schema checked in CI via `tests/test_eval_golden_dataset.py`.

Full RAGAS run is **manual** — needs live backend-node (pgvector + ingest), `OPENAI_API_KEY`, and `AI_INTERNAL_KEY`:

```bash
pip install -r requirements-eval.txt
python scripts/eval_rag_ragas.py
python scripts/eval_rag_ragas.py --retrieval-only --check-baseline
```

Checked-in floors: `eval/baseline.json`. Run artifacts go to `eval/results/` (gitignored).

## Verify full stack

From `backend-node`:

```bash
npm run verify:pre-e -- --live
npm run verify:e2e-ai -- --live
npm run verify:ws-streaming -- --live
```

## Related documentation

- [../README.md](../README.md) — Monorepo quick start
- [../AI-COACH-ARCHITECTURE.md](../AI-COACH-ARCHITECTURE.md) — AI Coach blueprint (blocks A–E)
- [../backend-node/docs/AI_ARCHITECTURE.md](../backend-node/docs/AI_ARCHITECTURE.md) — Node-side AI integration
- [../shared/](../shared/) — Plan prompt contracts and staple catalogs
