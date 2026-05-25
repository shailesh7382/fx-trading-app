#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

CURRENT_RUN_DIR="$(latest_run_dir || true)"

echo "FX Trading Stack Status"
echo "Repository : $REPO_ROOT"
echo "Logs       : ${CURRENT_RUN_DIR:-none}"
echo
printf '%-12s %-10s %-10s %-12s %s\n' "SERVICE" "STATUS" "PID" "PORT" "DETAILS"
printf '%-12s %-10s %-10s %-12s %s\n' "-----------" "----------" "----------" "------------" "------------------------------"

for service in "${SERVICES[@]}"; do
  pid="$(read_pid "$service" 2>/dev/null || true)"
  port="$(service_port "$service")"
  details=""

  if [[ -n "$pid" ]] && is_pid_alive "$pid"; then
    status="RUNNING"
    details="$(port_listener_line "$port")"
  else
    status="STOPPED"
    pid="-"
    if is_port_listening "$port"; then
      details="port in use by $(port_listener_line "$port")"
    else
      details="port free"
    fi
  fi

  printf '%-12s %-10s %-10s %-12s %s\n' "$service" "$status" "$pid" "$port" "${details:-n/a}"
done

