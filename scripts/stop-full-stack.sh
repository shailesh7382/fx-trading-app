#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

CURRENT_RUN_DIR="$(latest_run_dir || true)"
MASTER_LOG="${CURRENT_RUN_DIR:+$CURRENT_RUN_DIR/stop.log}"
[[ -n "${MASTER_LOG:-}" ]] && touch "$MASTER_LOG"

log_msg INFO "Stopping the FX trading stack..."

for service in ui pricing publisher auth; do
  stop_service "$service"
done

log_msg INFO "FX trading stack stop flow completed."

rm -f "$CURRENT_RUN_ID_FILE"
if [[ -L "$CURRENT_LOG_DIR_LINK" ]]; then
  rm -f "$CURRENT_LOG_DIR_LINK"
fi


