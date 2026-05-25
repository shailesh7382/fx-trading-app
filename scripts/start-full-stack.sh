#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

require_commands java mvn node npm lsof

RUN_ID="$(date '+%Y%m%d-%H%M%S')"
CURRENT_RUN_DIR="$(prepare_run_dir "$RUN_ID")"
MASTER_LOG="$CURRENT_RUN_DIR/startup.log"
touch "$MASTER_LOG"
print_environment_summary

log_msg INFO "Starting the full FX trading stack. Logs will be written to $CURRENT_RUN_DIR"

for service in "${SERVICES[@]}"; do
  if is_service_running "$service"; then
    log_msg ERROR "$(service_display_name "$service") is already running with PID $(read_pid "$service"). Stop the stack before starting again."
    exit 1
  fi
done

ensure_ui_dependencies
ensure_backend_dependencies

start_service auth "$PARENT_POM_DIR/fx-auth-rs" "mvn spring-boot:run" 120
start_service publisher "$PARENT_POM_DIR/fx-rate-publisher" "mvn spring-boot:run" 120
start_service pricing "$PARENT_POM_DIR/fx-pricing-rs" "mvn spring-boot:run" 120
start_service ui "$UI_DIR" "npm run dev -- --host 0.0.0.0 --port 5173" 120

log_msg INFO "Full FX trading stack started successfully."
log_msg INFO "Auth service:      http://localhost:8080"
log_msg INFO "Pricing service:   http://localhost:8081/api/fxprices"
log_msg INFO "Trading UI:        http://localhost:5173"
log_msg INFO "ActiveMQ broker:   tcp://localhost:61616"
log_msg INFO "H2 TCP server:     tcp://localhost:9092"
log_msg INFO "Use scripts/status-full-stack.sh to inspect running services."
log_msg INFO "Use scripts/tail-logs.sh to follow the current run logs."

