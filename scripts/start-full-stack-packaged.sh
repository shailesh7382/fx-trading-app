#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

require_commands java lsof

RUN_ID="$(date '+%Y%m%d-%H%M%S')"
CURRENT_RUN_DIR="$(prepare_run_dir "$RUN_ID")"
MASTER_LOG="$CURRENT_RUN_DIR/startup.log"
touch "$MASTER_LOG"
print_environment_summary

log_msg INFO "Starting the packaged FX trading stack. Logs will be written to $CURRENT_RUN_DIR"

for service in "${SERVICES[@]}"; do
  if is_service_running "$service"; then
    log_msg ERROR "$(service_display_name "$service") is already running with PID $(read_pid "$service"). Stop the stack before starting again."
    exit 1
  fi
done

auth_jar="$(require_packaged_service_jar auth)"
publisher_jar="$(require_packaged_service_jar publisher)"
pricing_jar="$(require_packaged_service_jar pricing)"
ui_jar="$(require_packaged_service_jar ui)"

start_service auth "$PARENT_POM_DIR/fx-auth-rs" "java -jar $(printf '%q' "$auth_jar")" 120
start_service publisher "$PARENT_POM_DIR/fx-rate-publisher" "java -jar $(printf '%q' "$publisher_jar")" 120
start_service pricing "$PARENT_POM_DIR/fx-pricing-rs" "java -jar $(printf '%q' "$pricing_jar")" 120
start_service ui "$PARENT_POM_DIR/fx-trading-ui" "java -jar $(printf '%q' "$ui_jar")" 120

log_msg INFO "Packaged FX trading stack started successfully."
log_msg INFO "Auth service:      http://localhost:8080"
log_msg INFO "Pricing service:   http://localhost:8081/api/fxprices"
log_msg INFO "Trading UI:        http://localhost:5173"
log_msg INFO "ActiveMQ broker:   tcp://localhost:61616"
log_msg INFO "H2 TCP server:     tcp://localhost:9092"
log_msg INFO "Use scripts/status-full-stack.sh to inspect running services."
log_msg INFO "Use scripts/tail-logs.sh to follow the current run logs."

