"""Block E — coach tool pipeline entry (LangGraph orchestration)."""

__all__ = ["run_coach_graph", "run_coach_resume", "run_tool_agent_graph"]


def __getattr__(name: str):
    if name == "run_coach_graph":
        from app.agent.coach_graph import run_coach_graph

        return run_coach_graph
    if name == "run_coach_resume":
        from app.agent.coach_graph import run_coach_resume

        return run_coach_resume
    if name == "run_tool_agent_graph":
        from app.agent.graph import run_tool_agent_graph

        return run_tool_agent_graph
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
