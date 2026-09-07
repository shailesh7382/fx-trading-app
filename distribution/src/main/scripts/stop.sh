#!/usr/bin/env bash
# Stops every service in reverse dependency order, escalating to SIGKILL only if asked politely first.
set -Eeuo pipefail

# shellcheck source=./lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

stop_service() {
  local service="$1" pid waited=0
  if ! pid="$(service_pid "$service")"; then
    log INFO "$(service_name "$service") is not running."
    rm -f "$(pid_file "$service")"
    return 0
  fi

  log INFO "Stopping $(service_name "$service") (PID $pid)..."
  kill "$pid" 2>/dev/null || true
  while ((waited < SHUTDOWN_TIMEOUT)); do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$(pid_file "$service")"
      log INFO "$(service_name "$service") stopped."
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done

  log WARN "$(service_name "$service") ignored SIGTERM for ${SHUTDOWN_TIMEOUT}s; sending SIGKILL."
  kill -9 "$pid" 2>/dev/null || true
  rm -f "$(pid_file "$service")"
}

for ((index = ${#SERVICES[@]} - 1; index >= 0; index--)); do
  stop_service "${SERVICES[index]}"
done

log INFO "FX trading stack stopped."
