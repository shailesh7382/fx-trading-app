#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=./lib/runtime.sh
source "$SCRIPT_DIR/lib/runtime.sh"

usage() {
  cat <<'EOF'
Usage: scripts/tail-logs.sh [--lines COUNT] [--service SERVICE]

SERVICE may be simulator, backend, frontend, or all (default).
The TAIL_LINES environment variable sets the default count (150).
EOF
}

main() {
  local lines="${TAIL_LINES:-150}"
  local service='all'
  local current_run_dir
  local log_files=()

  while (( $# > 0 )); do
    case "$1" in
      --lines)
        [[ $# -ge 2 ]] || die '--lines requires a value.'
        lines="$2"
        shift 2
        ;;
      --service)
        [[ $# -ge 2 ]] || die '--service requires a value.'
        service="$2"
        shift 2
        ;;
      -h|--help)
        usage
        return 0
        ;;
      *)
        usage >&2
        die "Unknown argument: $1"
        ;;
    esac
  done

  require_positive_integer lines "$lines"
  case "$service" in
    all|simulator|backend|frontend) ;;
    *) die "Unknown service '$service'." ;;
  esac

  current_run_dir="$(latest_run_dir 2>/dev/null || true)"
  if [[ -z "$current_run_dir" || ! -d "$current_run_dir" ]]; then
    die 'No log directory found. Start the stack first.'
  fi

  shopt -s nullglob
  if [[ "$service" == 'all' ]]; then
    log_files=("$current_run_dir"/*.log)
  else
    log_files=("$current_run_dir/$service.log")
  fi
  shopt -u nullglob

  if (( ${#log_files[@]} == 0 )) || [[ ! -f "${log_files[0]}" ]]; then
    die "No matching log files found under $current_run_dir."
  fi

  printf 'Following logs from: %s\n' "$current_run_dir"
  exec tail -n "$lines" -F "${log_files[@]}"
}

main "$@"
