#!/bin/bash
# Ralph execution loop with commit+push after each story
# Usage: ./scripts/ralph-loop.sh

set -e
unset CLAUDECODE

cd "$(dirname "$0")/.."

while true; do
  # Check if there are stories left
  NEXT=$(ralph --json next-story 2>/dev/null)
  if [ $? -ne 0 ] || [ -z "$NEXT" ]; then
    echo "✅ All stories complete!"
    break
  fi

  STORY_ID=$(echo "$NEXT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id','unknown'))" 2>/dev/null || echo "unknown")
  STORY_TITLE=$(echo "$NEXT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('title','unknown'))" 2>/dev/null || echo "unknown")
  echo "🚀 Executing: $STORY_ID - $STORY_TITLE"

  # Execute one story
  if ! ralph execute-one; then
    echo "❌ Story $STORY_ID failed"
    continue
  fi

  echo "✅ Story $STORY_ID completed"

  # Build to verify
  if ! npm run build > /dev/null 2>&1; then
    echo "⚠️  Build failed after $STORY_ID — skipping commit"
    continue
  fi

  # Commit and push
  git add -A
  if git diff --cached --quiet; then
    echo "ℹ️  No changes to commit for $STORY_ID"
  else
    git commit -m "feat: $STORY_ID - $STORY_TITLE

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
    git push origin main
    echo "📤 Pushed $STORY_ID to main"
  fi
done
