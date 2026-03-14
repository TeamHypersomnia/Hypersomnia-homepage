#!/bin/bash
set -e

PORT=3000

# Kill any existing instance on the port
existing=$(lsof -ti tcp:$PORT 2>/dev/null || true)
if [ -n "$existing" ]; then
  kill "$existing" 2>/dev/null || true
  sleep 1
  echo "✓ Killed existing process on port $PORT"
fi

exec node app.js $PORT --test
