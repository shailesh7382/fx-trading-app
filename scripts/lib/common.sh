#!/usr/bin/env bash
# shellcheck shell=bash

set -Eeuo pipefail

COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(cd "$COMMON_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SCRIPTS_DIR/.." && pwd)"
UI_DIR="$REPO_ROOT/frontend/app"
RUNTIME_DIR="$REPO_ROOT/.runtime"
PID_DIR="$RUNTIME_DIR/pids"
META_DIR="$RUNTIME_DIR/meta"
STATE_DIR="$RUNTIME_DIR/state"
LOG_ROOT="$REPO_ROOT/logs"
RUNS_DIR="$LOG_ROOT/runs"
CURRENT_RUN_ID_FILE="$STATE_DIR/current_run_id"
CURRENT_LOG_DIR_LINK="$LOG_ROOT/current"

readonly COMMON_DIR SCRIPTS_DIR REPO_ROOT UI_DIR
readonly RUNTIME_DIR PID_DIR META_DIR STATE_DIR
readonly LOG_ROOT RUNS_DIR CURRENT_RUN_ID_FILE CURRENT_LOG_DIR_LINK

SERVICES=(simulator backend frontend)
readonly SERVICES

timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

log_msg() {
  local level="$1"
  shift

  local line
  line="[$(timestamp)] [$level] $*"
  printf '%s\n' "$line"

  if [[ -n "${MASTER_LOG:-}" ]]; then
    printf '%s\n' "$line" >> "$MASTER_LOG"
  fi
}

die() {
  log_msg ERROR "$*" >&2
  exit 1
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
    die "Missing required commands: ${missing[*]}"
  fi
}

require_positive_integer() {
  local name="$1"
  local value="$2"

  if [[ ! "$value" =~ ^[1-9][0-9]*$ ]]; then
    die "$name must be a positive integer; received '$value'."
  fi
}

env_flag_enabled() {
  local name="$1"
  local value="${!name:-false}"

  case "$value" in
    1|true|TRUE|yes|YES) return 0 ;;
    0|false|FALSE|no|NO|'') return 1 ;;
    *) die "$name must be true or false; received '$value'." ;;
  esac
}

shell_join() {
  local argument
  local quoted
  local output=""

  for argument in "$@"; do
    printf -v quoted '%q' "$argument"
    output+="${output:+ }$quoted"
  done

  printf '%s' "$output"
}

service_display_name() {
  case "$1" in
    simulator) printf '%s\n' 'FX Simulator' ;;
    backend) printf '%s\n' 'FX Backend' ;;
    frontend) printf '%s\n' 'FX Frontend' ;;
    *) return 1 ;;
  esac
}

service_primary_port() {
  case "$1" in
    simulator) printf '%s\n' '8090' ;;
    backend) printf '%s\n' '8080' ;;
    frontend) printf '%s\n' '5173' ;;
    *) return 1 ;;
  esac
}

service_ports() {
  service_primary_port "$1"

  case "$1" in
    backend) printf '%s\n' '9092' ;;
    simulator|frontend) ;;
    *) return 1 ;;
  esac
}

service_pid_file() {
  printf '%s/%s.pid\n' "$PID_DIR" "$1"
}

service_meta_file() {
  printf '%s/%s.meta\n' "$META_DIR" "$1"
}

new_run_id() {
  printf '%s-%s\n' "$(date '+%Y%m%d-%H%M%S')" "$$"
}
