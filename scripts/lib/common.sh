#!/usr/bin/env bash
set -Eeuo pipefail

COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(cd "$COMMON_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SCRIPTS_DIR/.." && pwd)"
PARENT_POM_DIR="$REPO_ROOT/fx-parent-pom"
UI_DIR="$PARENT_POM_DIR/fx-trading-ui/fx-trading-app"
RUNTIME_DIR="$REPO_ROOT/.runtime"
PID_DIR="$RUNTIME_DIR/pids"
META_DIR="$RUNTIME_DIR/meta"
STATE_DIR="$RUNTIME_DIR/state"
LOG_ROOT="$REPO_ROOT/logs"
RUNS_DIR="$LOG_ROOT/runs"
CURRENT_RUN_ID_FILE="$STATE_DIR/current_run_id"
CURRENT_LOG_DIR_LINK="$LOG_ROOT/current"

mkdir -p "$PID_DIR" "$META_DIR" "$STATE_DIR" "$RUNS_DIR"

SERVICES=(auth publisher pricing ui)

service_display_name() {
  case "$1" in
    auth) echo "FX Auth RS" ;;
    publisher) echo "FX Rate Publisher" ;;
    pricing) echo "FX Pricing RS" ;;
    ui) echo "FX Trading UI" ;;
    *) echo "$1" ;;
  esac
}

service_port() {
  case "$1" in
    auth) echo "8080" ;;
    publisher) echo "61616" ;;
    pricing) echo "8081" ;;
    ui) echo "5173" ;;
    *) return 1 ;;
  esac
}

service_additional_ports() {
  case "$1" in
    auth) echo "9092" ;;
    *) echo "" ;;
  esac
}

service_pid_file() {
  echo "$PID_DIR/$1.pid"
}

service_meta_file() {
  echo "$META_DIR/$1.meta"
}

timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

log_msg() {
  local level="$1"
  shift
  local message="$*"
  local line
  line="[$(timestamp)] [$level] $message"
  echo "$line"
  if [[ -n "${MASTER_LOG:-}" ]]; then
    echo "$line" >> "$MASTER_LOG"
  fi
}

require_commands() {
  local missing=()
  local command_name
  for command_name in "$@"; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
      missing+=("$command_name")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    printf 'Missing required commands: %s\n' "${missing[*]}" >&2
    exit 1
  fi
}

is_pid_alive() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1
}

read_pid() {
  local pid_file
  pid_file="$(service_pid_file "$1")"
  [[ -f "$pid_file" ]] || return 1
  tr -d '[:space:]' < "$pid_file"
}

is_service_running() {
  local service="$1"
  local pid
  pid="$(read_pid "$service" 2>/dev/null || true)"
  [[ -n "$pid" ]] && is_pid_alive "$pid"
}

clear_service_state() {
  rm -f "$(service_pid_file "$1")" "$(service_meta_file "$1")"
}

port_listener_line() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {print $1 " pid=" $2 " user=" $3 " endpoint=" $9}'
}

is_port_listening() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

ensure_port_available() {
  local service="$1"
  local port
  port="$(service_port "$service")"

  if is_port_listening "$port"; then
    local listener
    listener="$(port_listener_line "$port")"
    log_msg ERROR "Port $port is already in use before starting $(service_display_name "$service"): ${listener:-unknown listener}."
    return 1
  fi

  local extra_port
  for extra_port in $(service_additional_ports "$service"); do
    if is_port_listening "$extra_port"; then
      local extra_listener
      extra_listener="$(port_listener_line "$extra_port")"
      log_msg ERROR "Port $extra_port is already in use before starting $(service_display_name "$service"): ${extra_listener:-unknown listener}."
      return 1
    fi
  done
}

prepare_run_dir() {
  local run_id="$1"
  local run_dir="$RUNS_DIR/$run_id"
  mkdir -p "$run_dir"
  rm -f "$CURRENT_LOG_DIR_LINK"
  ln -s "$run_dir" "$CURRENT_LOG_DIR_LINK"
  echo "$run_id" > "$CURRENT_RUN_ID_FILE"
  echo "$run_dir"
}

latest_run_dir() {
  if [[ -L "$CURRENT_LOG_DIR_LINK" || -d "$CURRENT_LOG_DIR_LINK" ]]; then
    cd "$CURRENT_LOG_DIR_LINK" >/dev/null 2>&1 && pwd -P
    return 0
  fi

  local latest
  latest="$(find "$RUNS_DIR" -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"
  [[ -n "$latest" ]] && echo "$latest"
}

listening_pids() {
  lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null | tr '\n' ' '
}

service_all_ports() {
  local service="$1"
  echo "$(service_port "$service") $(service_additional_ports "$service")"
}

write_meta_file() {
  local service="$1"
  local log_file="$2"
  local command_line="$3"
  local work_dir="$4"
  local pid="$5"

  cat > "$(service_meta_file "$service")" <<EOF
SERVICE=$service
DISPLAY_NAME=$(service_display_name "$service")
PID=$pid
PORT=$(service_port "$service")
LOG_FILE=$log_file
WORK_DIR=$work_dir
COMMAND=$command_line
STARTED_AT=$(timestamp)
EOF
}

wait_for_port() {
  local service="$1"
  local timeout_seconds="$2"
  local port
  local log_file
  local pid
  local waited=0

  port="$(service_port "$service")"
  log_file="$CURRENT_RUN_DIR/$service.log"

  while (( waited < timeout_seconds )); do
    if is_port_listening "$port"; then
      log_msg INFO "$(service_display_name "$service") is listening on port $port."
      return 0
    fi

    pid="$(read_pid "$service" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && ! is_pid_alive "$pid"; then
      log_msg ERROR "$(service_display_name "$service") exited before opening port $port. Recent log output:"
      tail -n 40 "$log_file" | while IFS= read -r line; do
        log_msg ERROR "$line"
      done
      return 1
    fi

    sleep 2
    waited=$(( waited + 2 ))
  done

  log_msg ERROR "Timed out waiting for $(service_display_name "$service") to open port $port after ${timeout_seconds}s. Recent log output:"
  tail -n 40 "$log_file" | while IFS= read -r line; do
    log_msg ERROR "$line"
  done
  return 1
}

wait_for_additional_ports() {
  local service="$1"
  local timeout_seconds="$2"
  local extra_port
  local waited
  local log_file="$CURRENT_RUN_DIR/$service.log"
  local pid

  for extra_port in $(service_additional_ports "$service"); do
    waited=0
    while (( waited < timeout_seconds )); do
      if is_port_listening "$extra_port"; then
        log_msg INFO "$(service_display_name "$service") opened additional required port $extra_port."
        break
      fi

      pid="$(read_pid "$service" 2>/dev/null || true)"
      if [[ -n "$pid" ]] && ! is_pid_alive "$pid"; then
        log_msg ERROR "$(service_display_name "$service") exited before opening additional required port $extra_port. Recent log output:"
        tail -n 40 "$log_file" | while IFS= read -r line; do
          log_msg ERROR "$line"
        done
        return 1
      fi

      sleep 2
      waited=$(( waited + 2 ))
    done

    if ! is_port_listening "$extra_port"; then
      log_msg ERROR "Timed out waiting for $(service_display_name "$service") to open additional required port $extra_port after ${timeout_seconds}s. Recent log output:"
      tail -n 40 "$log_file" | while IFS= read -r line; do
        log_msg ERROR "$line"
      done
      return 1
    fi
  done
}

create_launcher() {
  local service="$1"
  local work_dir="$2"
  local command_line="$3"
  local launcher_file="$CURRENT_RUN_DIR/$service.launch.sh"

  cat > "$launcher_file" <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail
cd $(printf '%q' "$work_dir")
echo "================================================================"
echo "SERVICE: $(service_display_name "$service")"
echo "STARTED_AT: \$(date '+%Y-%m-%d %H:%M:%S')"
echo "WORK_DIR: $work_dir"
echo "COMMAND: $command_line"
echo "JAVA: \$(command -v java || true)"
echo "MAVEN: \$(command -v mvn || true)"
echo "NODE: \$(command -v node || true)"
echo "NPM: \$(command -v npm || true)"
echo "================================================================"
exec $command_line
EOF

  chmod +x "$launcher_file"
  echo "$launcher_file"
}

start_service() {
  local service="$1"
  local work_dir="$2"
  local command_line="$3"
  local timeout_seconds="$4"
  local log_file="$CURRENT_RUN_DIR/$service.log"
  local launcher_file
  local pid

  if is_service_running "$service"; then
    log_msg ERROR "$(service_display_name "$service") already appears to be running with PID $(read_pid "$service"). Use scripts/stop-full-stack.sh first."
    return 1
  fi

  ensure_port_available "$service"
  launcher_file="$(create_launcher "$service" "$work_dir" "$command_line")"

  log_msg INFO "Starting $(service_display_name "$service")..."
  nohup "$launcher_file" >> "$log_file" 2>&1 &
  pid=$!
  echo "$pid" > "$(service_pid_file "$service")"
  write_meta_file "$service" "$log_file" "$command_line" "$work_dir" "$pid"

  wait_for_port "$service" "$timeout_seconds"
  wait_for_additional_ports "$service" "$timeout_seconds"
}

stop_service() {
  local service="$1"
  local pid
  local port
  local listener_pid
  local listener_name
  local waited=0
  local had_pid_file=false

  pid="$(read_pid "$service" 2>/dev/null || true)"
  port="$(service_port "$service")"
  [[ -n "$pid" ]] && had_pid_file=true

  if [[ -z "$pid" ]]; then
    log_msg INFO "$(service_display_name "$service") has no PID file; checking for orphaned listeners on managed ports."
  fi

  if [[ -n "$pid" ]] && ! is_pid_alive "$pid"; then
    log_msg INFO "$(service_display_name "$service") PID $pid is no longer running; cleaning up stale state."
    clear_service_state "$service"
    pid=""
  fi

  if [[ -n "$pid" ]]; then
    log_msg INFO "Stopping $(service_display_name "$service") (PID $pid)..."
    kill "$pid" >/dev/null 2>&1 || true

    while is_pid_alive "$pid" && (( waited < 30 )); do
      sleep 1
      waited=$(( waited + 1 ))
    done

    if is_pid_alive "$pid"; then
      log_msg INFO "$(service_display_name "$service") did not exit after 30s; sending SIGKILL to PID $pid."
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
  fi

  $had_pid_file && clear_service_state "$service"

  for port in $(service_all_ports "$service"); do
    if is_port_listening "$port"; then
      log_msg INFO "Port $port is still active after stopping $(service_display_name "$service"). Attempting to stop listener(s): $(port_listener_line "$port")"
      for listener_pid in $(listening_pids "$port"); do
        listener_name="$(ps -p "$listener_pid" -o comm= 2>/dev/null | awk '{print $1}')"
        if [[ "$listener_name" == "java" || "$listener_name" == "node" || "$listener_name" == "npm" ]]; then
          kill "$listener_pid" >/dev/null 2>&1 || true
        fi
      done

      sleep 2

      if is_port_listening "$port"; then
        log_msg INFO "Port $port is still active after follow-up stop attempt. Escalating to SIGKILL for: $(port_listener_line "$port")"
        for listener_pid in $(listening_pids "$port"); do
          listener_name="$(ps -p "$listener_pid" -o comm= 2>/dev/null | awk '{print $1}')"
          if [[ "$listener_name" == "java" || "$listener_name" == "node" || "$listener_name" == "npm" ]]; then
            kill -9 "$listener_pid" >/dev/null 2>&1 || true
          fi
        done

        sleep 1

        if is_port_listening "$port"; then
          log_msg INFO "Port $port remains active even after SIGKILL attempt. Current listener: $(port_listener_line "$port")"
        else
          log_msg INFO "Port $port is now free after SIGKILL escalation."
        fi
      else
        log_msg INFO "Port $port is now free."
      fi
    else
      log_msg INFO "$(service_display_name "$service") released port $port successfully."
    fi
  done
}

ensure_ui_dependencies() {
  local install_log="$CURRENT_RUN_DIR/ui-bootstrap.log"

  if [[ -d "$UI_DIR/node_modules" ]]; then
    log_msg INFO "UI dependencies already exist under $UI_DIR/node_modules."
    return 0
  fi

  log_msg INFO "Installing UI dependencies because node_modules is missing..."
  (
    cd "$UI_DIR"
    echo "================================================================"
    echo "UI dependency bootstrap started at $(timestamp)"
    echo "WORK_DIR: $UI_DIR"
    echo "COMMAND: npm install"
    echo "================================================================"
    npm install
  ) >> "$install_log" 2>&1

  log_msg INFO "UI dependency installation completed. Log: $install_log"
}

ensure_backend_dependencies() {
  local install_log="$CURRENT_RUN_DIR/backend-bootstrap.log"

  log_msg INFO "Installing backend shared artifacts required by the service modules..."
  (
    cd "$PARENT_POM_DIR"
    echo "================================================================"
    echo "Backend bootstrap started at $(timestamp)"
    echo "WORK_DIR: $PARENT_POM_DIR"
    echo "COMMAND: mvn -pl common-data -am install -DskipTests"
    echo "================================================================"
    mvn -pl common-data -am install -DskipTests
  ) >> "$install_log" 2>&1

  log_msg INFO "Backend bootstrap completed. Log: $install_log"
}

build_ui_production() {
  local build_log="$CURRENT_RUN_DIR/ui-build.log"

  log_msg INFO "Building the Vite UI for production serving..."
  (
    cd "$UI_DIR"
    echo "================================================================"
    echo "UI production build started at $(timestamp)"
    echo "WORK_DIR: $UI_DIR"
    echo "COMMAND: npm run build"
    echo "================================================================"
    npm run build
  ) >> "$build_log" 2>&1

  log_msg INFO "UI production build completed. Log: $build_log"
}

print_environment_summary() {
  cat <<EOF >> "$MASTER_LOG"
================================================================
STARTED_AT: $(timestamp)
REPO_ROOT: $REPO_ROOT
PARENT_POM_DIR: $PARENT_POM_DIR
UI_DIR: $UI_DIR
JAVA: $(command -v java || true)
JAVA_VERSION: $(java -version 2>&1 | head -n 1 || true)
MAVEN: $(command -v mvn || true)
MAVEN_VERSION: $(mvn -v 2>/dev/null | head -n 1 || true)
NODE: $(command -v node || true)
NODE_VERSION: $(node -v 2>/dev/null || true)
NPM: $(command -v npm || true)
NPM_VERSION: $(npm -v 2>/dev/null || true)
================================================================
EOF
}

