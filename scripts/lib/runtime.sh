#!/usr/bin/env bash
# shellcheck shell=bash

set -Eeuo pipefail

ensure_runtime_dirs() {
  mkdir -p "$PID_DIR" "$META_DIR" "$STATE_DIR" "$RUNS_DIR"
}

prepare_run_dir() {
  local run_id="$1"
  local run_dir="$RUNS_DIR/$run_id"

  ensure_runtime_dirs
  mkdir -p "$run_dir"
  printf '%s\n' "$run_id" > "$CURRENT_RUN_ID_FILE"
  printf '%s\n' "$run_dir"
}

latest_run_dir() {
  local candidate
  local latest=""
  local run_id=""

  if [[ -f "$CURRENT_RUN_ID_FILE" ]]; then
    run_id="$(tr -d '[:space:]' < "$CURRENT_RUN_ID_FILE")"
    if [[ "$run_id" =~ ^[0-9]{8}-[0-9]{6}(-[0-9]+)?$ && -d "$RUNS_DIR/$run_id" ]]; then
      printf '%s\n' "$RUNS_DIR/$run_id"
      return 0
    fi
  fi

  [[ -d "$RUNS_DIR" ]] || return 1

  while IFS= read -r candidate; do
    latest="$candidate"
  done < <(find "$RUNS_DIR" -mindepth 1 -maxdepth 1 -type d | sort)

  [[ -n "$latest" ]] || return 1
  printf '%s\n' "$latest"
}

initialize_run() {
  local run_id
  run_id="$(new_run_id)"
  CURRENT_RUN_DIR="$(prepare_run_dir "$run_id")"
  MASTER_LOG="$CURRENT_RUN_DIR/startup.log"
  touch "$MASTER_LOG"
}

read_pid() {
  local pid_file
  local pid

  pid_file="$(service_pid_file "$1")"
  [[ -f "$pid_file" ]] || return 1

  pid="$(tr -d '[:space:]' < "$pid_file")"
  [[ "$pid" =~ ^[1-9][0-9]*$ ]] || return 1
  printf '%s\n' "$pid"
}

assert_stack_can_start() {
  local service
  local failed=0

  for service in "${SERVICES[@]}"; do
    if [[ -f "$(service_pid_file "$service")" ]]; then
      log_msg ERROR "Managed state already exists for $(service_display_name "$service"). Run scripts/stop-full-stack.sh before starting."
      failed=1
    fi
  done

  (( failed == 0 ))
}

write_meta_file() {
  local service="$1"
  local log_file="$2"
  local command_line="$3"
  local work_dir="$4"
  local pid="$5"
  local process_match="$6"
  local meta_file

  meta_file="$(service_meta_file "$service")"
  {
    printf 'SERVICE=%s\n' "$service"
    printf 'DISPLAY_NAME=%s\n' "$(service_display_name "$service")"
    printf 'PID=%s\n' "$pid"
    printf 'PORT=%s\n' "$(service_primary_port "$service")"
    printf 'LOG_FILE=%s\n' "$log_file"
    printf 'WORK_DIR=%s\n' "$work_dir"
    printf 'COMMAND=%s\n' "$command_line"
    printf 'PROCESS_MATCH=%s\n' "$process_match"
    printf 'STARTED_AT=%s\n' "$(timestamp)"
  } > "$meta_file"
  chmod 600 "$meta_file"
}

create_launcher() {
  local service="$1"
  local work_dir="$2"
  shift 2

  local launcher_file="$CURRENT_RUN_DIR/$service.launch.sh"
  local command_line
  command_line="$(shell_join "$@")"

  {
    printf '%s\n' '#!/usr/bin/env bash'
    printf '%s\n' 'set -Eeuo pipefail'
    printf 'cd %q\n' "$work_dir"
    printf '%s\n' "printf '%s\\n' '================================================================'"
    printf 'printf '\''SERVICE: %%s\\n'\'' %q\n' "$(service_display_name "$service")"
    printf '%s\n' "printf 'STARTED_AT: %s\\n' \"\$(date '+%Y-%m-%d %H:%M:%S')\""
    printf 'printf '\''WORK_DIR: %%s\\n'\'' %q\n' "$work_dir"
    printf 'printf '\''COMMAND: %%s\\n'\'' %q\n' "$command_line"
    printf '%s\n' "printf '%s\\n' '================================================================'"
    printf 'exec'
    printf ' %q' "$@"
    printf '\n'
  } > "$launcher_file"

  chmod 700 "$launcher_file"
  printf '%s\n' "$launcher_file"
}

start_service() {
  local service="$1"
  local work_dir="$2"
  local process_match="$3"
  shift 3

  local launcher_file
  local log_file="$CURRENT_RUN_DIR/$service.log"
  local command_line
  local pid

  if [[ -f "$(service_pid_file "$service")" ]]; then
    log_msg ERROR "Managed state already exists for $(service_display_name "$service"). Run scripts/stop-full-stack.sh before starting."
    return 1
  fi

  launcher_file="$(create_launcher "$service" "$work_dir" "$@")"
  command_line="$(shell_join "$@")"

  log_msg INFO "Starting $(service_display_name "$service")..."
  nohup "$launcher_file" >> "$log_file" 2>&1 &
  pid=$!
  printf '%s\n' "$pid" > "$(service_pid_file "$service")"
  write_meta_file "$service" "$log_file" "$command_line" "$work_dir" "$pid" "$process_match"
  STARTED_SERVICES+=("$service")
  log_msg INFO "Launched $(service_display_name "$service") (PID $pid). Log: $log_file"
}

rollback_started_services() {
  local exit_status="$1"

  trap - ERR INT TERM
  set +e

  if (( ${#STARTED_SERVICES[@]} > 0 )); then
    log_msg WARN 'Startup failed; stopping services started by this run.'
    "$SCRIPTS_DIR/stop-full-stack.sh"
  fi

  exit "$exit_status"
}

enable_startup_rollback() {
  trap 'rollback_started_services $?' ERR
  trap 'rollback_started_services 130' INT TERM
}

disable_startup_rollback() {
  trap - ERR INT TERM
}

print_environment_summary() {
  {
    printf '%s\n' '================================================================'
    printf 'STARTED_AT: %s\n' "$(timestamp)"
    printf 'REPO_ROOT: %s\n' "$REPO_ROOT"
    printf 'UI_DIR: %s\n' "$UI_DIR"
    printf 'JAVA: %s\n' "$(command -v java 2>/dev/null || true)"
    printf 'JAVA_VERSION: %s\n' "$(java -version 2>&1 | head -n 1 || true)"
    printf 'NODE: %s\n' "$(command -v node 2>/dev/null || true)"
    printf 'NODE_VERSION: %s\n' "$(node --version 2>/dev/null || true)"
    printf 'NPM: %s\n' "$(command -v npm 2>/dev/null || true)"
    printf 'NPM_VERSION: %s\n' "$(npm --version 2>/dev/null || true)"
    printf '%s\n' '================================================================'
  } >> "$MASTER_LOG"
}
