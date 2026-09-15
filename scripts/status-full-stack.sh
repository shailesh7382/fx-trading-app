#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=./lib/runtime.sh
source "$SCRIPT_DIR/lib/runtime.sh"

usage() {
  printf '%s\n' 'Usage: scripts/status-full-stack.sh'
}

main() {
  local current_run_dir
  local service
  local pid
  local primary_port
  local status
  local details
  local exit_status=0

  case "${1:-}" in
    '') ;;
    -h|--help) usage; return 0 ;;
    *) usage >&2; die "Unknown argument: $1" ;;
  esac

  current_run_dir="$(latest_run_dir 2>/dev/null || true)"

  printf '%s\n' 'FX Trading Stack Status'
  printf 'Repository : %s\n' "$REPO_ROOT"
  printf 'Logs       : %s\n\n' "${current_run_dir:-none}"
  printf '%-12s %-11s %-10s %-12s %s\n' 'SERVICE' 'STATUS' 'PID' 'PORT' 'DETAILS'
  printf '%-12s %-11s %-10s %-12s %s\n' '-----------' '-----------' '----------' '------------' '------------------------------'

  for service in "${SERVICES[@]}"; do
    pid="$(read_pid "$service" 2>/dev/null || true)"
    primary_port="$(service_primary_port "$service")"
    details="$(service_port_states "$service")"

    if [[ -n "$pid" ]] && are_service_ports_open "$service"; then
      status='RUNNING'
    elif [[ -n "$pid" ]] && are_any_service_ports_open "$service"; then
      status='DEGRADED'
      exit_status=1
    elif [[ -n "$pid" ]]; then
      status='STALE'
      details+='; managed PID state without open ports'
      exit_status=1
    elif are_any_service_ports_open "$service"; then
      status='UNMANAGED'
      pid='-'
      details+='; no managed PID'
      exit_status=1
    else
      status='STOPPED'
      pid='-'
      exit_status=1
    fi

    printf '%-12s %-11s %-10s %-12s %s\n' "$service" "$status" "$pid" "$primary_port" "$details"
  done

  return "$exit_status"
}

main "$@"
