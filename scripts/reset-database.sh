#!/usr/bin/env bash
set -Eeuo pipefail

# Deletes the H2 database so the next start builds a fresh schema.
#
# Identifiers, resting orders and trades all go. The stack recreates every table on
# the next start because Hibernate runs with ddl-auto=update, and the identifier
# counter restarts from zero — the first order booked afterwards is B00000000.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

PROPERTIES="$REPO_ROOT/backend/src/main/resources/application.properties"

# Read the database location from the application rather than assuming it, so this
# keeps working if the datasource is ever pointed somewhere else.
datasource_url() {
  grep -E '^spring\.datasource\.url=' "$PROPERTIES" | head -n 1 | cut -d= -f2-
}

database_base_path() {
  local url path
  url="$(datasource_url)"

  if [[ "$url" != jdbc:h2:file:* ]]; then
    log_msg ERROR "Datasource is not an H2 file database: ${url:-<not found>}"
    log_msg ERROR "Nothing was deleted. Clear it by hand, or point this script at the right database."
    return 1
  fi

  path="${url#jdbc:h2:file:}"   # strip the driver prefix
  path="${path%%;*}"            # strip the connection options
  echo "${path/#\~/$HOME}"      # H2 expands ~ to the user's home directory
}

assert_stack_stopped() {
  local port busy=0

  for port in 8080 8090 5173; do
    if is_port_listening "$port"; then
      log_msg ERROR "Port $port is still listening: $(port_listener_line "$port")"
      busy=1
    fi
  done

  if (( busy )); then
    log_msg ERROR "The stack still holds the database open. Run ./stop-full-stack.sh first."
    return 1
  fi
}

main() {
  local base removed=0 file

  base="$(database_base_path)"
  assert_stack_stopped

  log_msg INFO "Database files for $base:"
  for file in "$base.mv.db" "$base.trace.db" "$base.lock.db" "$base.newFile" "$base.tempFile"; do
    [[ -e "$file" ]] && log_msg INFO "  $file ($(du -h "$file" | cut -f1))"
  done

  if [[ ! -e "$base.mv.db" ]]; then
    log_msg INFO "No database found at $base.mv.db; nothing to delete."
    return 0
  fi

  if [[ "${1:-}" != "--force" ]]; then
    read -r -p "Delete these files? Every order and trade is lost. [y/N] " reply
    if [[ ! "$reply" =~ ^[Yy]$ ]]; then
      log_msg INFO "Left the database alone."
      return 0
    fi
  fi

  for file in "$base.mv.db" "$base.trace.db" "$base.lock.db" "$base.newFile" "$base.tempFile"; do
    if [[ -e "$file" ]]; then
      rm -f "$file"
      log_msg INFO "Deleted $file"
      removed=$(( removed + 1 ))
    fi
  done

  log_msg INFO "Removed $removed database file(s). The next start rebuilds the schema from scratch."
}

main "$@"
