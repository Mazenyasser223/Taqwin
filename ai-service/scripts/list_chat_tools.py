"""Print comma-separated chat tool names for verify-tool-registry-sync.js."""
from app.agent.tools.registry import COACH_TOOLS, is_chat_tool

if __name__ == "__main__":
    print(",".join(t["name"] for t in COACH_TOOLS if is_chat_tool(t["name"])))
