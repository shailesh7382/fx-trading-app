#!/usr/bin/env bash
# shellcheck shell=bash

set -Eeuo pipefail

resolve_service_jar() {
  local service="$1"
  local artifact
  local module_dir
  local candidate
  local selected=""
  local matches=()

  case "$service" in
    simulator|backend|frontend)
      artifact="$service"
      module_dir="$REPO_ROOT/$service/target"
      ;;
    *) return 1 ;;
  esac

  shopt -s nullglob
  matches=("$module_dir"/"$artifact"-*.jar)
  shopt -u nullglob

  for candidate in "${matches[@]}"; do
    case "$candidate" in
      *.jar.original|*-plain.jar) continue ;;
    esac

    if [[ -z "$selected" || "$candidate" -nt "$selected" ]]; then
      selected="$candidate"
    fi
  done

  [[ -n "$selected" ]] || return 1
  printf '%s\n' "$selected"
}

require_service_jar() {
  local service="$1"
  local jar_path

  jar_path="$(resolve_service_jar "$service" 2>/dev/null || true)"
  if [[ -z "$jar_path" || ! -f "$jar_path" ]]; then
    die "Packaged jar for $(service_display_name "$service") was not found. Run scripts/build-package-full-stack.sh first."
  fi

  printf '%s\n' "$jar_path"
}

resolve_distribution_archive() {
  local candidate
  local selected=""
  local matches=()

  shopt -s nullglob
  matches=("$REPO_ROOT"/distribution/target/fx-trading-app-*.tar.gz)
  shopt -u nullglob

  for candidate in "${matches[@]}"; do
    if [[ -z "$selected" || "$candidate" -nt "$selected" ]]; then
      selected="$candidate"
    fi
  done

  [[ -n "$selected" ]] || return 1
  printf '%s\n' "$selected"
}

run_logged_step() {
  local description="$1"
  local work_dir="$2"
  local log_file="$3"
  shift 3

  log_msg INFO "$description"
  {
    printf '%s\n' '================================================================'
    printf 'STARTED_AT: %s\n' "$(timestamp)"
    printf 'WORK_DIR: %s\n' "$work_dir"
    printf 'COMMAND: %s\n' "$(shell_join "$@")"
    printf '%s\n' '================================================================'
    cd "$work_dir"
    "$@"
  } >> "$log_file" 2>&1
  log_msg INFO "$description completed. Log: $log_file"
}

ensure_ui_dependencies() {
  if [[ -d "$UI_DIR/node_modules" ]]; then
    log_msg INFO "UI dependencies already exist under $UI_DIR/node_modules."
    return 0
  fi

  run_logged_step \
    'Installing UI dependencies with npm ci...' \
    "$UI_DIR" \
    "$CURRENT_RUN_DIR/ui-bootstrap.log" \
    npm ci
}

package_runtime_services() {
  if env_flag_enabled SKIP_JAVA_BUILD; then
    log_msg INFO 'Skipping Java packaging because SKIP_JAVA_BUILD=true.'
    return 0
  fi

  run_logged_step \
    'Packaging simulator and backend runtime jars...' \
    "$REPO_ROOT" \
    "$CURRENT_RUN_DIR/java-build.log" \
    mvn -pl simulator,backend -am package -DskipTests
}

build_ui_production() {
  run_logged_step \
    'Building the production UI bundle...' \
    "$UI_DIR" \
    "$CURRENT_RUN_DIR/ui-build.log" \
    npm run build
}

