#!/usr/bin/env bash
# Shared state and helpers for the packaged FX trading stack. Sourced by the other scripts.

APP_HOME="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIB_DIR="$APP_HOME/lib"
CONF_DIR="$APP_HOME/conf"
LOG_DIR="${FX_LOG_DIR:-$APP_HOME/logs}"
RUN_DIR="${FX_RUN_DIR:-$APP_HOME/run}"

# Start order is dependency order. Stopping walks it in reverse.
SERVICES=(simulator backend frontend)

STARTUP_TIMEOUT="${FX_STARTUP_TIMEOUT:-120}"
SHUTDOWN_TIMEOUT="${FX_SHUTDOWN_TIMEOUT:-30}"

service_port() {
  case "$1" in
    simulator) echo 8090 ;;
    backend) echo 8080 ;;
    frontend) echo 5173 ;;
    *) return 1 ;;
  esac
}

service_name() {
  case "$1" in
    simulator) echo "FX Simulator" ;;
    backend) echo "FX Backend" ;;
    frontend) echo "FX Frontend" ;;
    *) echo "$1" ;;
  esac
}

pid_file() { printf '%s/%s.pid\n' "$RUN_DIR" "$1"; }
log_file() { printf '%s/%s.log\n' "$LOG_DIR" "$1"; }

log() { printf '[%s] %-5s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" "$2"; }

die() {
  log ERROR "$1"
  exit 1
}

require_java() {
  command -v java >/dev/null 2>&1 || die "java is required on PATH to run this stack."
}

# Echoes the pid only when the recorded process is still alive, so a stale file reads as stopped.
service_pid() {
  local file pid
  file="$(pid_file "$1")"
  [[ -f "$file" ]] || return 1
  pid="$(cat "$file" 2>/dev/null || true)"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  printf '%s\n' "$pid"
}

# Bash's own /dev/tcp keeps the scripts free of lsof, nc, and curl.
port_open() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null || return 1
  exec 3<&- 3>&-
  return 0
}
