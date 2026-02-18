#!/bin/bash
# Wrapper script for launchd to run the Shindig feature pipeline.
# Ensures PATH includes node, npx, claude, and ralph.

export PATH="/opt/homebrew/bin:/Users/rodion/.local/bin:$PATH"

# Source shell profile for GITHUB_TOKEN (needed by gh CLI)
# launchd doesn't source .zshrc, so we need this explicitly
source /Users/rodion/.zshrc 2>/dev/null || true

cd /Users/rodion/shindig || exit 1

npx tsx --env-file=.env.local scripts/pipeline.ts \
  >> /Users/rodion/shindig/logs/pipeline.log 2>&1
