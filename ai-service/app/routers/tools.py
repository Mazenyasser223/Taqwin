"""Public tool registry endpoint."""

from fastapi import APIRouter

from app.agent.tools.registry import COACH_TOOLS, all_tool_names

router = APIRouter(prefix="/tools", tags=["tools"])


@router.get("")
async def list_tools() -> dict:
    return {
        "count": len(COACH_TOOLS),
        "names": all_tool_names(),
        "tools": [
            {
                "name": t["name"],
                "description": t["description"],
                "category": t.get("category"),
                "requiresConfirm": t.get("requires_confirm"),
                "requiresStepUp": t.get("requires_step_up"),
                "isRead": t.get("is_read"),
            }
            for t in COACH_TOOLS
        ],
    }
