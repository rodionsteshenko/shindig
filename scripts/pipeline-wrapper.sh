#!/bin/bash
# Wrapper script for launchd to run the Shindig feature pipeline.
# Ensures PATH includes node, npx, claude, and ralph.

export PATH="/opt/homebrew/bin:/Users/rodion/.local/bin:$PATH"

cd /Users/rodion/shindig || exit 1

npx tsx --env-file=.env.local scripts/pipeline.ts \
  >> /Users/rodion/shindig/logs/pipeline.log 2>&1
