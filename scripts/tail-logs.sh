#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

CURRENT_RUN_DIR="$(latest_run_dir || true)"
LINES="${LINES:-150}"

if [[ -z "$CURRENT_RUN_DIR" || ! -d "$CURRENT_RUN_DIR" ]]; then
  echo "No log directory found. Start the stack first with scripts/start-full-stack.sh" >&2
  exit 1
fi

echo "Following logs from: $CURRENT_RUN_DIR"
exec tail -n "$LINES" -F "$CURRENT_RUN_DIR"/*.log

