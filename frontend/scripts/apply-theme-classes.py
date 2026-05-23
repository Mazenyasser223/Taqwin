#!/usr/bin/env python3
"""Replace hardcoded dark-theme Tailwind classes with semantic theme tokens."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIRS = [ROOT / "features", ROOT / "components"]

REPLACEMENTS = [
    ("text-slate-400", "text-muted"),
    ("text-slate-500", "text-faint"),
    ("text-slate-300", "text-muted"),
    ("text-white/90", "text-foreground/90"),
    ("border-white/10", "border-subtle"),
    ("border-white/5", "border-subtle"),
    ("hover:bg-white/10", "hover:bg-elevated-hover"),
    ("bg-white/10", "bg-elevated-hover"),
    ("bg-white/5", "bg-elevated"),
    ("hover:text-white", "hover:text-foreground"),
    ("hover:border-white/20", "hover:border-primary/30"),
    ("hover:border-white/10", "hover:border-subtle"),
]

KEEP_WHITE_PATTERNS = (
    "bg-primary",
    "bg-accent",
    "bg-emerald",
    "bg-red-5",
    "bg-brand-5",
    "bg-error",
    "bg-success",
    "from-primary",
    "to-primary",
)


def should_keep_white(line: str) -> bool:
    return any(p in line for p in KEEP_WHITE_PATTERNS)


def process_text_white(content: str) -> str:
    lines = []
    for line in content.split("\n"):
        if "text-white" in line and should_keep_white(line):
            lines.append(line)
        else:
            lines.append(line.replace("text-white", "text-foreground"))
    return "\n".join(lines)


def process_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    original = text
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    text = process_text_white(text)
    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = 0
    for base in DIRS:
        if not base.exists():
            continue
        for path in base.rglob("*.tsx"):
            if process_file(path):
                changed += 1
                print(f"updated: {path.relative_to(ROOT)}")
    print(f"done — {changed} files")


if __name__ == "__main__":
    main()
