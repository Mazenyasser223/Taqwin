# Taqwin AI Service (FastAPI)

Python microservice for coach chat, intent routing, RAG retrieval, plan generation/adaptation, memory summarization, and the LangGraph tool agent. Node.js proxies authenticated user traffic here; internal routes call back into Node for tool execution and CAG context.

## Architecture

```text
Frontend → Node /api/ai/chat → FastAPI /chat
                ↓                      ↓
         chatMemory (Mongo)     intent → RAG → LLM + tools
                ↓                      ↓
         aiToolExecutor         Node /internal/ai/tools/execute
         AiMemory / traces
```

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
│   │   ├── memory.py              # POST /internal/memory/summarize
│   │   └── tools.py               # GET /tools (chat-shipped registry)
│   │
│   ├── agent/
│   │   ├── coach_graph.py         # Coach LangGraph: safety → intent → RAG → tool loop
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
│   │   ├── intents.py             # Intent enum + metadata
│   │   └── router.py              # Rule + LLM intent router
│   │
│   ├── rag/
│   │   ├── levels.py              # L1–L5 level definitions
│   │   └── retriever.py           # Calls Node internal RAG search
│   │
│   ├── prompts/
│   │   ├── coach_system.py        # Coach system prompt
│   │   └── plan_prompts.py        # Plan generation/adaptation prompts
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
│   ├── golden_dataset.json        # Golden RAG test cases (12)
│   └── results/                   # Run artifacts (gitignored)
│
├── scripts/
│   ├── eval_rag_ragas.py          # Full RAGAS evaluation
│   ├── list_chat_tools.py         # Print chat-shipped tool list
│   ├── verify_b6.py               # Block B6 smoke test
│   ├── verify_b7.py               # Block B7 smoke test
│   └── verify_cag_parity.py       # CAG sanitize parity with Node
│
└── tests/
    ├── conftest.py
    ├── test_agent_graph.py
    ├── test_coach_graph.py
    ├── test_coach_stream.py
    ├── test_coach_planner.py
    ├── test_compound_planner.py
    ├── test_tool_loop.py
    ├── test_tool_registry.py
    ├── test_tool_input_validate.py
    ├── test_turn_classify.py
    ├── test_memory_summarize.py
    ├── test_chat_observability.py
    ├── test_cag_sanitize.py
    ├── test_cag_fetch.py
    ├── test_eval_baseline.py
    ├── test_eval_golden_dataset.py
    ├── test_plan_c1.py
    ├── test_plan_prompt_contract.py
    ├── test_router.py
    ├── test_llm_context.py
    ├── test_chat_b6.py
    ├── test_health.py
    └── test_step_up_config.py
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

### Environment (`ai-service/.env`)

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude provider (or use Gemini/Ollama vars) |
| `AI_INTERNAL_KEY` | Shared secret with Node internal routes |
| `NODE_INTERNAL_API_URL` | Node base URL (default `http://localhost:4000`) |
| `LOG_LEVEL` | Logging verbosity |

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

**Compound requests** (e.g. “lose 5kg and travel next week”): `compound_planner.py` decomposes into ordered steps → one confirmation → sequential execution on resume.

**LangGraph graphs:**

- `coach_graph.py` — safety → intent → RAG → bounded tool loop → confirm
- `graph.py` — extract → execute → retry (max 3); writes always require user confirmation

Tool registry: `app/agent/tools/registry.py` (~47 chat-shipped tools). Stubs like `generate_weekly_*` are excluded from chat.

## Tests

```bash
cd ai-service
pip install -r requirements.txt
pytest
```

## RAG evaluation (RAGAS)

Golden set: `eval/golden_dataset.json` (12 cases). Schema checked in CI via `tests/test_eval_golden_dataset.py`.

Full RAGAS run is **manual** — needs live backend-node (pgvector + ingest), `OPENAI_API_KEY`, and `AI_INTERNAL_KEY`:

```bash
pip install -r requirements-eval.txt
python scripts/eval_rag_ragas.py                          # end-to-end
python scripts/eval_rag_ragas.py --retrieval-only
python scripts/eval_rag_ragas.py --retrieval-only --check-baseline
python scripts/eval_rag_ragas.py --retrieval-only --write-baseline
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
