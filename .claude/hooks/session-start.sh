#!/bin/bash
set -euo pipefail

# Only run in Claude Code web (remote) sessions. Local dev is unaffected.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

APP_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}/app"

if [ ! -d "$APP_DIR" ]; then
  echo "session-start: $APP_DIR not found, skipping" >&2
  exit 0
fi

if [ ! -d "$APP_DIR/node_modules" ]; then
  echo "session-start: installing npm deps in $APP_DIR" >&2
  (cd "$APP_DIR" && npm install --no-audit --no-fund)
else
  echo "session-start: $APP_DIR/node_modules already present, skipping install" >&2
fi
