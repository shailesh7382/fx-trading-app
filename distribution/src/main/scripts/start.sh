#!/usr/bin/env bash
# Starts every service in dependency order and waits for each to accept connections.
set -Eeuo pipefail

# shellcheck source=./lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

require_java
mkdir -p "$LOG_DIR" "$RUN_DIR"

wait_for_service() {
  local service="$1" port="$2" waited=0
  while ((waited < STARTUP_TIMEOUT)); do
    if ! service_pid "$service" >/dev/null; then
      die "$(service_name "$service") exited during startup. See $(log_file "$service")."
    fi
    if port_open "$port"; then
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  die "$(service_name "$service") did not open port $port within ${STARTUP_TIMEOUT}s. See $(log_file "$service")."
}

start_service() {
  local service="$1" port jar pid
  port="$(service_port "$service")"
  jar="$LIB_DIR/$service.jar"

  [[ -f "$jar" ]] || die "Missing $jar. This distribution is incomplete."
  if service_pid "$service" >/dev/null; then
    die "$(service_name "$service") is already running with PID $(service_pid "$service")."
  fi
  if port_open "$port"; then
    die "Port $port is already in use; $(service_name "$service") cannot start."
  fi

  log INFO "Starting $(service_name "$service") on port $port..."
  # Both locations are optional so an operator can override nothing, everything, or one service.
  # shellcheck disable=SC2086
  nohup java ${FX_JAVA_OPTS:-} -jar "$jar" \
      --spring.config.additional-location="optional:file:$CONF_DIR/,optional:file:$CONF_DIR/$service/" \
      >>"$(log_file "$service")" 2>&1 &
  pid=$!
  printf '%s\n' "$pid" > "$(pid_file "$service")"
  wait_for_service "$service" "$port"
  log INFO "$(service_name "$service") is up with PID $pid. Log: $(log_file "$service")"
}

for service in "${SERVICES[@]}"; do
  start_service "$service"
done

log INFO "FX trading stack started."
log INFO "  Trading UI:      http://localhost:$(service_port frontend)"
log INFO "  Backend service: http://localhost:$(service_port backend)/api/fxprices"
log INFO "  Simulator API:   http://localhost:$(service_port simulator)/swagger-ui.html"
log INFO "  H2 TCP server:   tcp://localhost:9092"
log INFO "Use bin/status.sh to inspect the stack and bin/stop.sh to shut it down."
