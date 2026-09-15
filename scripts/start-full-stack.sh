#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=./lib/build.sh
source "$SCRIPT_DIR/lib/build.sh"
# shellcheck source=./lib/runtime.sh
source "$SCRIPT_DIR/lib/runtime.sh"

STARTED_SERVICES=()
STARTUP_TIMEOUT_SECONDS="${STARTUP_TIMEOUT_SECONDS:-120}"
MODE='development'

usage() {
  cat <<'EOF'
Usage: scripts/start-full-stack.sh [--mode MODE]

Modes:
  development  Package and run Java services as jars; run the Vite dev server.
  production   Package and run Java services as jars; build and serve static UI.
  packaged     Run all three previously packaged Spring Boot jars.

Environment:
  SKIP_JAVA_BUILD=true         Reuse existing simulator and backend jars.
  STARTUP_TIMEOUT_SECONDS=120  Readiness timeout for each service.
EOF
}

parse_arguments() {
  while (( $# > 0 )); do
    case "$1" in
      --mode)
        [[ $# -ge 2 ]] || die '--mode requires a value.'
        MODE="$2"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        usage >&2
        die "Unknown argument: $1"
        ;;
    esac
  done

  case "$MODE" in
    development|production|packaged) ;;
    *) die "Unsupported mode '$MODE'. Expected development, production, or packaged." ;;
  esac
}

start_java_services() {
  local simulator_jar="$1"
  local backend_jar="$2"

  start_service \
    simulator "$REPO_ROOT/simulator" "$STARTUP_TIMEOUT_SECONDS" "$simulator_jar" \
    java -jar "$simulator_jar"
  start_service \
    backend "$REPO_ROOT/backend" "$STARTUP_TIMEOUT_SECONDS" "$backend_jar" \
    java -jar "$backend_jar"
}

print_success() {
  local mode="$1"

  log_msg INFO "FX trading stack started successfully in $mode mode."
  log_msg INFO 'Simulator API:   http://localhost:8090/swagger-ui.html'
  log_msg INFO 'Backend service: http://localhost:8080/api/rates'
  log_msg INFO 'Trading UI:      http://localhost:5173'
  log_msg INFO 'H2 TCP server:   tcp://localhost:9092'
  log_msg INFO 'Status:          scripts/status-full-stack.sh'
  log_msg INFO 'Logs:            scripts/tail-logs.sh'
}

main() {
  local simulator_jar
  local backend_jar
  local frontend_jar
  local vite_entry="$UI_DIR/node_modules/vite/bin/vite.js"

  parse_arguments "$@"
  require_positive_integer STARTUP_TIMEOUT_SECONDS "$STARTUP_TIMEOUT_SECONDS"

  case "$MODE" in
    packaged) require_commands java ;;
    development|production) require_commands java mvn node npm ;;
  esac

  initialize_run
  print_environment_summary
  log_msg INFO "Starting the FX trading stack in $MODE mode. Logs: $CURRENT_RUN_DIR"
  assert_stack_can_start
  enable_startup_rollback

  case "$MODE" in
    development)
      ensure_ui_dependencies
      package_runtime_services
      simulator_jar="$(require_service_jar simulator)"
      backend_jar="$(require_service_jar backend)"
      [[ -f "$vite_entry" ]] || die "Vite entry point not found: $vite_entry"
      start_java_services "$simulator_jar" "$backend_jar"
      start_service \
        frontend "$UI_DIR" "$STARTUP_TIMEOUT_SECONDS" "$vite_entry" \
        node "$vite_entry" --host 0.0.0.0 --port 5173
      ;;
    production)
      ensure_ui_dependencies
      build_ui_production
      package_runtime_services
      simulator_jar="$(require_service_jar simulator)"
      backend_jar="$(require_service_jar backend)"
      start_java_services "$simulator_jar" "$backend_jar"
      start_service \
        frontend "$REPO_ROOT" "$STARTUP_TIMEOUT_SECONDS" "$SCRIPT_DIR/serve-ui-dist.mjs" \
        env UI_STATIC_HOST=0.0.0.0 UI_STATIC_PORT=5173 UI_DIST_DIR="$UI_DIR/dist" \
        node "$SCRIPT_DIR/serve-ui-dist.mjs"
      ;;
    packaged)
      simulator_jar="$(require_service_jar simulator)"
      backend_jar="$(require_service_jar backend)"
      frontend_jar="$(require_service_jar frontend)"
      start_java_services "$simulator_jar" "$backend_jar"
      start_service \
        frontend "$REPO_ROOT/frontend" "$STARTUP_TIMEOUT_SECONDS" "$frontend_jar" \
        java -jar "$frontend_jar"
      ;;
  esac

  disable_startup_rollback
  print_success "$MODE"
}

main "$@"
