#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=./lib/runtime.sh
source "$SCRIPT_DIR/lib/runtime.sh"

STOP_TIMEOUT_SECONDS="${STOP_TIMEOUT_SECONDS:-30}"
STOP_PORT_CHECK_TIMEOUT_SECONDS="${STOP_PORT_CHECK_TIMEOUT_SECONDS:-1}"
STOP_PORT_CHECK_HOST="${STOP_PORT_CHECK_HOST:-127.0.0.1}"

# External process and socket inspection is intentionally isolated in this
# stop entry point.
is_port_listening() {
  local port="$1"
  nc -z -w "$STOP_PORT_CHECK_TIMEOUT_SECONDS" "$STOP_PORT_CHECK_HOST" "$port" </dev/null >/dev/null 2>&1
}

port_state() {
  local port="$1"

  if is_port_listening "$port"; then
    printf '%s=open' "$port"
  else
    printf '%s=closed' "$port"
  fi
}

service_port_states() {
  local service="$1"
  local port
  local states=()
  local joined

  while IFS= read -r port; do
    states+=("$(port_state "$port")")
  done < <(service_ports "$service")

  joined="$(IFS=,; printf '%s' "${states[*]}")"
  printf '%s\n' "$joined"
}

are_any_service_ports_open() {
  local service="$1"
  local port

  while IFS= read -r port; do
    is_port_listening "$port" && return 0
  done < <(service_ports "$service")

  return 1
}

is_pid_alive() {
  local pid="$1"
  [[ "$pid" =~ ^[1-9][0-9]*$ ]] && kill -0 "$pid" >/dev/null 2>&1
}

read_meta_value() {
  local service="$1"
  local wanted_key="$2"
  local meta_file
  local line

  meta_file="$(service_meta_file "$service")"
  [[ -f "$meta_file" ]] || return 1

  while IFS= read -r line; do
    if [[ "${line%%=*}" == "$wanted_key" ]]; then
      printf '%s\n' "${line#*=}"
      return 0
    fi
  done < "$meta_file"

  return 1
}

clear_service_state() {
  rm -f "$(service_pid_file "$1")" "$(service_meta_file "$1")"
}

process_command() {
  ps -p "$1" -o command= 2>/dev/null | head -n 1
}

is_managed_service_process() {
  local service="$1"
  local pid="$2"
  local marker
  local command_line

  is_pid_alive "$pid" || return 1
  marker="$(read_meta_value "$service" PROCESS_MATCH 2>/dev/null || true)"
  [[ -n "$marker" ]] || return 1
  command_line="$(process_command "$pid")"
  [[ "$command_line" == *"$marker"* ]]
}

wait_for_pid_exit() {
  local pid="$1"
  local timeout_seconds="$2"
  local waited=0

  while is_pid_alive "$pid" && (( waited < timeout_seconds )); do
    sleep 1
    waited=$(( waited + 1 ))
  done

  ! is_pid_alive "$pid"
}

are_service_ports_closed() {
  local service="$1"
  local port

  while IFS= read -r port; do
    is_port_listening "$port" && return 1
  done < <(service_ports "$service")
}

wait_for_service_ports_closed() {
  local service="$1"
  local timeout_seconds="$2"
  local waited=0

  while (( waited < timeout_seconds )); do
    are_service_ports_closed "$service" && return 0
    sleep 1
    waited=$(( waited + 1 ))
  done

  are_service_ports_closed "$service"
}

stop_service() {
  local service="$1"
  local pid_file
  local pid

  pid_file="$(service_pid_file "$service")"
  pid="$(read_pid "$service" 2>/dev/null || true)"

  if [[ -z "$pid" ]]; then
    if [[ -f "$pid_file" ]]; then
      log_msg WARN "Removing malformed PID state for $(service_display_name "$service")."
      clear_service_state "$service"
    fi

    if are_any_service_ports_open "$service"; then
      log_msg WARN "$(service_display_name "$service") has no managed PID, but $(service_port_states "$service"). The untracked process was left untouched."
    else
      log_msg INFO "$(service_display_name "$service") is already stopped."
    fi
    return 0
  fi

  if ! is_pid_alive "$pid"; then
    log_msg INFO "$(service_display_name "$service") PID $pid is no longer running; removing stale state."
    clear_service_state "$service"
    return 0
  fi

  if ! is_managed_service_process "$service" "$pid"; then
    log_msg WARN "Refusing to stop PID $pid because it no longer matches $(service_display_name "$service"). Removing only the stale state files."
    clear_service_state "$service"
    return 0
  fi

  log_msg INFO "Stopping $(service_display_name "$service") (PID $pid)..."
  kill "$pid" >/dev/null 2>&1 || true

  if ! wait_for_pid_exit "$pid" "$STOP_TIMEOUT_SECONDS"; then
    if is_managed_service_process "$service" "$pid"; then
      log_msg WARN "$(service_display_name "$service") did not exit after ${STOP_TIMEOUT_SECONDS}s; sending SIGKILL to PID $pid."
      kill -9 "$pid" >/dev/null 2>&1 || true
      wait_for_pid_exit "$pid" 5 || true
    else
      log_msg WARN "PID $pid changed identity while stopping; it was left untouched."
    fi
  fi

  clear_service_state "$service"

  if wait_for_service_ports_closed "$service" 5; then
    log_msg INFO "$(service_display_name "$service") stopped successfully."
  else
    log_msg WARN "$(service_display_name "$service") stopped, but $(service_port_states "$service"). Any untracked listener was left untouched."
  fi
}

usage() {
  printf '%s\n' 'Usage: scripts/stop-full-stack.sh'
}

main() {
  local current_run_dir
  local service

  case "${1:-}" in
    '') ;;
    -h|--help) usage; return 0 ;;
    *) usage >&2; die "Unknown argument: $1" ;;
  esac

  require_commands nc ps
  require_positive_integer STOP_TIMEOUT_SECONDS "$STOP_TIMEOUT_SECONDS"
  require_positive_integer STOP_PORT_CHECK_TIMEOUT_SECONDS "$STOP_PORT_CHECK_TIMEOUT_SECONDS"

  current_run_dir="$(latest_run_dir 2>/dev/null || true)"
  MASTER_LOG="${current_run_dir:+$current_run_dir/stop.log}"
  [[ -n "$MASTER_LOG" ]] && touch "$MASTER_LOG"

  log_msg INFO 'Stopping the FX trading stack...'
  for service in frontend backend simulator; do
    stop_service "$service"
  done

  rm -f "$CURRENT_RUN_ID_FILE"

  log_msg INFO 'FX trading stack stop flow completed.'
}

main "$@"
