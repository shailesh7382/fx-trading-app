#!/usr/bin/env bash
# Reports each service's process and port, and exits non-zero when any service is down.
set -Eeuo pipefail

# shellcheck source=./lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

printf '%-14s %-10s %-8s %-8s %s\n' SERVICE STATE PID PORT LOG
down=0
for service in "${SERVICES[@]}"; do
  port="$(service_port "$service")"
  if pid="$(service_pid "$service")"; then
    state=$(port_open "$port" && echo RUNNING || echo STARTING)
  else
    pid="-"
    state="STOPPED"
    down=1
  fi
  printf '%-14s %-10s %-8s %-8s %s\n' "$service" "$state" "$pid" "$port" "$(log_file "$service")"
done
exit "$down"
