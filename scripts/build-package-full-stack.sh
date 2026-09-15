#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
# shellcheck source=./lib/build.sh
source "$SCRIPT_DIR/lib/build.sh"

usage() {
  cat <<'EOF'
Usage: scripts/build-package-full-stack.sh

Builds and tests the UI, packages every Java service, and creates the
distribution archive.

Environment flags:
  SKIP_UI_TESTS=true    Skip UI tests.
  SKIP_JAVA_TESTS=true  Skip Java tests during Maven packaging.
EOF
}

main() {
  local java_jar
  local service
  local archive
  local maven_args=(clean package -Dui.build.skip=true)

  case "${1:-}" in
    '') ;;
    -h|--help) usage; return 0 ;;
    *) usage >&2; die "Unknown argument: $1" ;;
  esac

  require_commands java mvn node npm

  log_msg INFO 'Installing deterministic UI dependencies with npm ci...'
  (cd "$UI_DIR" && npm ci)

  if env_flag_enabled SKIP_UI_TESTS; then
    log_msg INFO 'Skipping UI tests because SKIP_UI_TESTS=true.'
  else
    log_msg INFO 'Running UI tests...'
    (cd "$UI_DIR" && npm test)
  fi

  log_msg INFO 'Building the production UI bundle...'
  (cd "$UI_DIR" && npm run build)

  if env_flag_enabled SKIP_JAVA_TESTS; then
    maven_args+=(-DskipTests)
    log_msg INFO 'Skipping Java tests because SKIP_JAVA_TESTS=true.'
  fi

  log_msg INFO 'Packaging all Spring Boot services and the distribution archive...'
  (cd "$REPO_ROOT" && mvn "${maven_args[@]}")

  log_msg INFO 'Packaged Spring Boot artifacts:'
  for service in "${SERVICES[@]}"; do
    java_jar="$(resolve_service_jar "$service" 2>/dev/null || true)"
    [[ -n "$java_jar" ]] && printf '  - %-10s %s\n' "$service" "$java_jar"
  done

  archive="$(resolve_distribution_archive 2>/dev/null || true)"
  if [[ -n "$archive" ]]; then
    printf '  - %-10s %s\n' 'archive' "$archive"
  fi

  log_msg INFO 'Full-stack build and packaging completed successfully.'
}

main "$@"
