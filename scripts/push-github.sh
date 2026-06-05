#!/usr/bin/env bash
# Push current branch to Mazenyasser223/Taqwin (requires GitHub login cached or PAT).
set -e
cd "$(dirname "$0")/.."
BRANCH="${1:-$(git branch --show-current)}"
echo "Pushing branch: $BRANCH"
git push -u origin "$BRANCH"
echo "Done. Remote: https://github.com/Mazenyasser223/Taqwin/tree/$BRANCH"
