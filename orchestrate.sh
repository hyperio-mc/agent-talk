#!/bin/bash
# Agent-Talk Task Orchestrator Wrapper
# This script is called by OpenClaw cron every 15 minutes

set -e

WORKSPACE="/Users/mastercontrol/.openclaw/workspace"
AGENT_TALK="$WORKSPACE/agent-talk"
LOG_FILE="$AGENT_TALK/orchestrator.log"
ORCHESTRATOR="$AGENT_TALK/orchestrator.py"

# Ensure log directory exists
mkdir -p "$AGENT_TALK"

# Log start
echo "$(date -Iseconds) [orchestrate.sh] Starting orchestrator run" >> "$LOG_FILE"

# Check if orchestrator is already running (prevent overlap)
LOCK_FILE="/tmp/agent-talk-orchestrator.lock"
if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "$(date -Iseconds) [orchestrate.sh] Orchestrator already running (PID $PID), skipping" >> "$LOG_FILE"
        exit 0
    else
        # Stale lock file
        rm -f "$LOCK_FILE"
    fi
fi

# Create lock file
echo $$ > "$LOCK_FILE"

# Run the orchestrator
echo "$(date -Iseconds) [orchestrate.sh] Running orchestrator.py" >> "$LOG_FILE"

# Use sessions_spawn to delegate to sub-agents
# This is the OpenClaw-native way to spawn agents
python3 "$ORCHESTRATOR" 2>&1 | while read -r line; do
    echo "$(date -Iseconds) [orchestrator.py] $line" >> "$LOG_FILE"
done

# Release lock
rm -f "$LOCK_FILE"

echo "$(date -Iseconds) [orchestrate.sh] Orchestrator run complete" >> "$LOG_FILE"