#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=./lib/runtime.sh
source "$SCRIPT_DIR/lib/runtime.sh"

PROPERTIES_FILE="$REPO_ROOT/backend/src/main/resources/application.properties"

usage() {
  cat <<'EOF'
Usage: scripts/reset-database.sh [--force]

Deletes the configured H2 database files. Without --force, confirmation is
required. Every order and trade in the local database will be lost.
EOF
}

datasource_url() {
  local line

  [[ -f "$PROPERTIES_FILE" ]] || die "Properties file not found: $PROPERTIES_FILE"
  while IFS= read -r line; do
    if [[ "$line" == spring.datasource.url=* ]]; then
      printf '%s\n' "${line#*=}"
      return 0
    fi
  done < "$PROPERTIES_FILE"

  return 1
}

database_base_path() {
  local url
  local database_path

  url="$(datasource_url || true)"
  if [[ "$url" != jdbc:h2:file:* ]]; then
    die "Datasource is not an H2 file database: ${url:-<not found>}. Nothing was deleted."
  fi

  database_path="${url#jdbc:h2:file:}"
  database_path="${database_path%%;*}"
  case "$database_path" in
    '~') database_path="${HOME:?HOME is not set}" ;;
    '~/'*) database_path="${HOME:?HOME is not set}/${database_path#\~/}" ;;
    /*) ;;
    *) die "Refusing to delete a relative database path: $database_path" ;;
  esac

  case "$database_path" in
    /|"$HOME"|"$REPO_ROOT") die "Refusing unsafe database path: $database_path" ;;
  esac

  printf '%s\n' "$database_path"
}

assert_stack_stopped() {
  local service
  local pid
  local busy=0

  for service in "${SERVICES[@]}"; do
    pid="$(read_pid "$service" 2>/dev/null || true)"
    if [[ -f "$(service_pid_file "$service")" ]]; then
      log_msg ERROR "Managed state still exists for $(service_display_name "$service")${pid:+ (PID $pid)}."
      busy=1
    fi
  done

  if (( busy != 0 )); then
    die 'The stack may still hold the database open. Run scripts/stop-full-stack.sh first.'
  fi
}

main() {
  local force=false
  local database_base
  local file
  local reply
  local removed=0
  local database_files=()

  while (( $# > 0 )); do
    case "$1" in
      --force) force=true; shift ;;
      -h|--help) usage; return 0 ;;
      *) usage >&2; die "Unknown argument: $1" ;;
    esac
  done

  database_base="$(database_base_path)"
  assert_stack_stopped

  database_files=(
    "$database_base.mv.db"
    "$database_base.trace.db"
    "$database_base.lock.db"
    "$database_base.newFile"
    "$database_base.tempFile"
  )

  log_msg INFO "Database files for $database_base:"
  for file in "${database_files[@]}"; do
    if [[ -e "$file" ]]; then
      log_msg INFO "  $file ($(du -h "$file" | cut -f1))"
    fi
  done

  for file in "${database_files[@]}"; do
    [[ -e "$file" ]] && removed=$(( removed + 1 ))
  done
  if (( removed == 0 )); then
    log_msg INFO 'No database files were found; nothing to delete.'
    return 0
  fi
  removed=0

  if [[ "$force" != true ]]; then
    read -r -p 'Delete these files? Every order and trade will be lost. [y/N] ' reply
    if [[ ! "$reply" =~ ^[Yy]$ ]]; then
      log_msg INFO 'Database files were left unchanged.'
      return 0
    fi
  fi

  for file in "${database_files[@]}"; do
    if [[ -e "$file" ]]; then
      rm -f "$file"
      log_msg INFO "Deleted $file"
      removed=$(( removed + 1 ))
    fi
  done

  log_msg INFO "Removed $removed database file(s). The next start rebuilds the schema."
}

main "$@"
