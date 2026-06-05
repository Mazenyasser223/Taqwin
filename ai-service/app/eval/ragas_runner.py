"""
Production RAG evaluation — RAGAS + Taqwin custom metrics.

Runs the full coach pipeline:
  intent routing → pgvector retrieval (Node B5) → Claude answer → RAGAS scores
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.eval.bootstrap import _stub_vertexai, load_eval_env

_stub_vertexai()
load_eval_env()

from datasets import Dataset  # noqa: E402
from langchain_openai import ChatOpenAI, OpenAIEmbeddings  # noqa: E402
from ragas import evaluate  # noqa: E402
from ragas.metrics import (  # noqa: E402
    AnswerRelevancy,
    ContextPrecision,
    ContextRecall,
    Faithfulness,
)

from app.clients.node_internal import NodeInternalError  # noqa: E402
from app.intent.router import route_intent  # noqa: E402
from app.prompts.coach_system import build_coach_system_prompt  # noqa: E402
from app.rag.retriever import format_rag_context, retrieve_rag  # noqa: E402
from app.services.llm_chat import complete_coach_chat, is_llm_configured  # noqa: E402

logger = logging.getLogger(__name__)

DEFAULT_DATASET = Path(__file__).resolve().parents[2] / "eval" / "golden_dataset.json"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parents[2] / "eval" / "results"


@dataclass
class CaseResult:
    id: str
    locale: str
    question: str
    expected_intent: str
    resolved_intent: str
    intent_match: bool
    levels_used: list[str]
    expected_levels: list[str]
    level_recall: float
    hit_count: int
    avg_score: float
    retrieval_ms: float
    generation_ms: float
    top_titles: list[str]
    reference_overlap: float
    error: str | None = None
    answer_preview: str = ""


@dataclass
class EvalReport:
    run_at: str
    dataset_version: str
    case_count: int
    end_to_end: bool
    node_url: str
    ragas_scores: dict[str, float] = field(default_factory=dict)
    custom_scores: dict[str, float] = field(default_factory=dict)
    cases: list[dict[str, Any]] = field(default_factory=list)
    failures: list[str] = field(default_factory=list)
    report_json_path: str = ""
    report_md_path: str = ""


def load_golden_dataset(path: Path | None = None) -> tuple[str, list[dict[str, Any]]]:
    p = path or DEFAULT_DATASET
    data = json.loads(p.read_text(encoding="utf-8"))
    return str(data.get("version", "?")), list(data.get("cases") or [])


def _reference_overlap(hits_content: list[str], reference_contexts: list[str]) -> float:
    if not reference_contexts:
        return 1.0
    blob = " ".join(hits_content).lower()
    hits = sum(1 for ref in reference_contexts if ref.lower() in blob)
    return hits / len(reference_contexts)


def _level_recall(levels_used: list[str], hits_levels: list[str], expected: list[str]) -> float:
    if not expected:
        return 1.0
    found = set(levels_used) | set(hits_levels)
    return sum(1 for lv in expected if lv in found) / len(expected)


async def _generate_answer(
    *,
    question: str,
    locale: str,
    rag_context: str,
    skip_llm: bool,
) -> tuple[str, float]:
    if skip_llm or not is_llm_configured():
        preview = rag_context[:400] + ("…" if len(rag_context) > 400 else "")
        return f"[retrieval-only] {preview or 'no context'}", 0.0

    system = build_coach_system_prompt(
        user_context="(eval — no user CAG bundle)",
        rag_context=rag_context,
        locale=locale,
    )
    t0 = time.perf_counter()
    answer = await complete_coach_chat(
        system=system,
        messages=[{"role": "user", "content": question}],
        temperature=0.3,
        max_tokens=700,
    )
    return answer.strip(), (time.perf_counter() - t0) * 1000


async def run_pipeline_case(
    case: dict[str, Any],
    *,
    skip_llm: bool = False,
) -> tuple[CaseResult, dict[str, Any] | None]:
    """Run one golden case; return custom metrics row + RAGAS row (or None on hard fail)."""
    cid = str(case["id"])
    locale = case.get("locale", "en")
    question = case["question"]
    expected_intent = case.get("expected_intent", "general")
    expected_levels = list(case.get("expected_levels") or [])
    reference_contexts = list(case.get("reference_contexts") or [])
    reference_answer = case.get("reference_answer") or ""

    routing = route_intent(question, locale=locale)
    resolved_intent = routing.intent

    t0 = time.perf_counter()
    try:
        _intent, levels_used, hits = retrieve_rag(
            query=question,
            locale=locale,
            routing=routing,
        )
    except NodeInternalError as exc:
        ms = (time.perf_counter() - t0) * 1000
        cr = CaseResult(
            id=cid,
            locale=locale,
            question=question,
            expected_intent=expected_intent,
            resolved_intent=resolved_intent,
            intent_match=resolved_intent == expected_intent,
            levels_used=[],
            expected_levels=expected_levels,
            level_recall=0.0,
            hit_count=0,
            avg_score=0.0,
            retrieval_ms=ms,
            generation_ms=0.0,
            top_titles=[],
            reference_overlap=0.0,
            error=str(exc),
        )
        return cr, None

    retrieval_ms = (time.perf_counter() - t0) * 1000
    contexts = [h.content for h in hits if h.content.strip()]
    hit_levels = [h.level for h in hits]
    avg_score = sum(h.score for h in hits) / len(hits) if hits else 0.0
    rag_context = format_rag_context(hits, locale=locale)

    answer, generation_ms = await _generate_answer(
        question=question,
        locale=locale,
        rag_context=rag_context,
        skip_llm=skip_llm,
    )

    cr = CaseResult(
        id=cid,
        locale=locale,
        question=question,
        expected_intent=expected_intent,
        resolved_intent=resolved_intent,
        intent_match=resolved_intent == expected_intent,
        levels_used=list(levels_used),
        expected_levels=expected_levels,
        level_recall=_level_recall(levels_used, hit_levels, expected_levels),
        hit_count=len(hits),
        avg_score=round(avg_score, 4),
        retrieval_ms=round(retrieval_ms, 1),
        generation_ms=round(generation_ms, 1),
        top_titles=[h.title for h in hits[:5]],
        reference_overlap=round(_reference_overlap(contexts, reference_contexts), 4),
        answer_preview=answer[:280] + ("…" if len(answer) > 280 else ""),
    )

    ragas_row = {
        "question": question,
        "contexts": contexts if contexts else ["(empty retrieval)"],
        "answer": answer,
        "ground_truth": reference_answer,
        "reference": reference_answer,
        "reference_contexts": reference_contexts or [reference_answer],
    }
    return cr, ragas_row


async def run_evaluation(
    *,
    dataset_path: Path | None = None,
    output_dir: Path | None = None,
    skip_llm: bool = False,
    case_ids: list[str] | None = None,
    ragas_judge_model: str = "gpt-4o-mini",
    embed_model: str = "text-embedding-3-small",
) -> EvalReport:
    from app.config import get_settings

    settings = get_settings()
    version, cases = load_golden_dataset(dataset_path)
    if case_ids:
        wanted = set(case_ids)
        cases = [c for c in cases if c["id"] in wanted]

    case_results: list[CaseResult] = []
    ragas_rows: list[dict[str, Any]] = []
    failures: list[str] = []

    for case in cases:
        logger.info("Eval case %s", case["id"])
        cr, row = await run_pipeline_case(case, skip_llm=skip_llm)
        case_results.append(cr)
        if cr.error:
            failures.append(f"{cr.id}: {cr.error}")
        if row and not cr.error:
            ragas_rows.append(row)

    ragas_scores: dict[str, float] = {}
    case_dicts = [asdict(c) for c in case_results]
    if ragas_rows:
        llm = ChatOpenAI(model=ragas_judge_model, temperature=0)
        embeddings = OpenAIEmbeddings(model=embed_model)
        ds = Dataset.from_list(ragas_rows)
        metrics = [
            Faithfulness(),
            AnswerRelevancy(),
            ContextPrecision(),
            ContextRecall(),
        ]
        try:
            result = evaluate(
                ds,
                metrics=metrics,
                llm=llm,
                embeddings=embeddings,
                raise_exceptions=False,
            )
            repr_dict = getattr(result, "_repr_dict", None) or {}
            ragas_scores = {
                k: round(float(v), 4)
                for k, v in repr_dict.items()
                if v is not None and v == v  # skip NaN
            }
            score_idx = 0
            for i, cr in enumerate(case_results):
                if cr.error:
                    continue
                if score_idx < len(result.scores):
                    case_dicts[i]["ragas"] = {
                        k: round(float(v), 4)
                        for k, v in result.scores[score_idx].items()
                        if v is not None and v == v
                    }
                    score_idx += 1
        except Exception as exc:
            failures.append(f"RAGAS evaluate failed: {exc}")
            logger.exception("RAGAS evaluation error")

    out_dir = output_dir or DEFAULT_OUTPUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    if ragas_rows:
        cache_path = out_dir / "last_ragas_cache.json"
        cache_path.write_text(
            json.dumps({"rows": ragas_rows, "cases": case_dicts}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    n = len(case_results) or 1
    custom_scores = {
        "intent_accuracy": round(sum(c.intent_match for c in case_results) / n, 4),
        "level_recall_avg": round(sum(c.level_recall for c in case_results) / n, 4),
        "reference_overlap_avg": round(sum(c.reference_overlap for c in case_results) / n, 4),
        "retrieval_hit_rate": round(sum(1 for c in case_results if c.hit_count > 0) / n, 4),
        "avg_chunks_retrieved": round(sum(c.hit_count for c in case_results) / n, 2),
        "avg_retrieval_score": round(
            sum(c.avg_score for c in case_results if c.hit_count > 0)
            / max(1, sum(1 for c in case_results if c.hit_count > 0)),
            4,
        ),
        "avg_retrieval_ms": round(sum(c.retrieval_ms for c in case_results) / n, 1),
        "avg_generation_ms": round(
            sum(c.generation_ms for c in case_results if c.generation_ms > 0)
            / max(1, sum(1 for c in case_results if c.generation_ms > 0)),
            1,
        ),
    }

    out_dir = output_dir or DEFAULT_OUTPUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    json_path = out_dir / f"rag_eval_{stamp}.json"
    md_path = out_dir / f"rag_eval_{stamp}.md"

    report = EvalReport(
        run_at=datetime.now(timezone.utc).isoformat(),
        dataset_version=version,
        case_count=len(case_results),
        end_to_end=not skip_llm,
        node_url=settings.node_internal_api_url,
        ragas_scores=ragas_scores,
        custom_scores=custom_scores,
        cases=case_dicts,
        failures=failures,
        report_json_path=str(json_path),
        report_md_path=str(md_path),
    )

    json_path.write_text(json.dumps(asdict(report), ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(_format_markdown(report), encoding="utf-8")
    return report


def _format_markdown(report: EvalReport) -> str:
    lines = [
        "# Taqwin RAG Evaluation (RAGAS)",
        "",
        f"- **Run at:** {report.run_at}",
        f"- **Dataset version:** {report.dataset_version}",
        f"- **Cases:** {report.case_count}",
        f"- **Mode:** {'end-to-end (retrieval + Claude)' if report.end_to_end else 'retrieval-only'}",
        f"- **Node URL:** {report.node_url}",
        "",
        "## RAGAS scores (0–1, higher is better)",
        "",
    ]
    if report.ragas_scores:
        lines.append("| Metric | Score | Bar |")
        lines.append("|--------|-------|-----|")
        for k, v in sorted(report.ragas_scores.items()):
            bar = "█" * int(v * 20) + "░" * (20 - int(v * 20))
            lines.append(f"| {k} | **{v:.4f}** | {bar} |")
    else:
        lines.append("_No RAGAS scores (all cases failed or skip)._")

    lines.extend(["", "## Taqwin custom metrics", ""])
    for k, v in sorted(report.custom_scores.items()):
        lines.append(f"- **{k}:** {v}")

    if report.failures:
        lines.extend(["", "## Failures", ""])
        for f in report.failures:
            lines.append(f"- {f}")

    lines.extend(["", "## Per-case summary", ""])
    for c in report.cases:
        status = "OK" if not c.get("error") and c.get("hit_count", 0) > 0 else "WARN"
        lines.append(
            f"- [{status}] `{c['id']}` intent={c['resolved_intent']} "
            f"(exp {c['expected_intent']}) hits={c['hit_count']} "
            f"level_recall={c['level_recall']:.2f} overlap={c['reference_overlap']:.2f}"
        )
        if c.get("error"):
            lines.append(f"  - error: {c['error']}")
    return "\n".join(lines)


def rescore_from_cache(
    *,
    cache_path: Path | None = None,
    output_dir: Path | None = None,
    ragas_judge_model: str = "gpt-4o-mini",
    embed_model: str = "text-embedding-3-small",
) -> EvalReport:
    """Re-run RAGAS judge only on cached pipeline output (fast)."""
    from app.config import get_settings

    out_dir = output_dir or DEFAULT_OUTPUT_DIR
    cache_file = cache_path or (out_dir / "last_ragas_cache.json")
    if not cache_file.is_file():
        raise FileNotFoundError(f"No RAGAS cache at {cache_file}. Run full eval first.")

    payload = json.loads(cache_file.read_text(encoding="utf-8"))
    ragas_rows = payload["rows"]
    case_dicts = payload["cases"]

    llm = ChatOpenAI(model=ragas_judge_model, temperature=0)
    embeddings = OpenAIEmbeddings(model=embed_model)
    ds = Dataset.from_list(ragas_rows)
    metrics = [Faithfulness(), AnswerRelevancy(), ContextPrecision(), ContextRecall()]
    result = evaluate(ds, metrics=metrics, llm=llm, embeddings=embeddings, raise_exceptions=False)

    repr_dict = getattr(result, "_repr_dict", None) or {}
    ragas_scores = {
        k: round(float(v), 4) for k, v in repr_dict.items() if v is not None and v == v
    }

    score_idx = 0
    for i, case in enumerate(case_dicts):
        if case.get("error"):
            continue
        if score_idx < len(result.scores):
            case_dicts[i]["ragas"] = {
                k: round(float(v), 4)
                for k, v in result.scores[score_idx].items()
                if v is not None and v == v
            }
            score_idx += 1

    n = len(case_dicts) or 1
    custom_scores = {
        "intent_accuracy": round(
            sum(1 for c in case_dicts if c.get("intent_match")) / n, 4
        ),
        "level_recall_avg": round(
            sum(float(c.get("level_recall", 0)) for c in case_dicts) / n, 4
        ),
        "reference_overlap_avg": round(
            sum(float(c.get("reference_overlap", 0)) for c in case_dicts) / n, 4
        ),
        "retrieval_hit_rate": round(
            sum(1 for c in case_dicts if c.get("hit_count", 0) > 0) / n, 4
        ),
        "avg_chunks_retrieved": round(
            sum(int(c.get("hit_count", 0)) for c in case_dicts) / n, 2
        ),
        "avg_retrieval_score": round(
            sum(float(c.get("avg_score", 0)) for c in case_dicts if c.get("hit_count", 0) > 0)
            / max(1, sum(1 for c in case_dicts if c.get("hit_count", 0) > 0)),
            4,
        ),
        "avg_retrieval_ms": round(
            sum(float(c.get("retrieval_ms", 0)) for c in case_dicts) / n, 1
        ),
        "avg_generation_ms": round(
            sum(float(c.get("generation_ms", 0)) for c in case_dicts if c.get("generation_ms", 0) > 0)
            / max(1, sum(1 for c in case_dicts if c.get("generation_ms", 0) > 0)),
            1,
        ),
    }

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    json_path = out_dir / f"rag_eval_{stamp}.json"
    md_path = out_dir / f"rag_eval_{stamp}.md"
    settings = get_settings()

    report = EvalReport(
        run_at=datetime.now(timezone.utc).isoformat(),
        dataset_version="cache-rescore",
        case_count=len(case_dicts),
        end_to_end=True,
        node_url=settings.node_internal_api_url,
        ragas_scores=ragas_scores,
        custom_scores=custom_scores,
        cases=case_dicts,
        failures=[],
        report_json_path=str(json_path),
        report_md_path=str(md_path),
    )
    json_path.write_text(json.dumps(asdict(report), ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(_format_markdown(report), encoding="utf-8")
    return report


def run_evaluation_sync(**kwargs: Any) -> EvalReport:
    return asyncio.run(run_evaluation(**kwargs))
