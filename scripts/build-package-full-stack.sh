#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

require_commands java mvn node npm

log_step() {
  printf '[%s] [INFO] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

log_step "Installing deterministic UI dependencies with npm ci..."
(
  cd "$UI_DIR"
  npm ci
)

if [[ "${SKIP_UI_TESTS:-false}" != "true" ]]; then
  log_step "Running frontend tests..."
  (
    cd "$UI_DIR"
    npm test
  )
else
  log_step "Skipping frontend tests because SKIP_UI_TESTS=true."
fi

log_step "Building the production frontend bundle..."
(
  cd "$UI_DIR"
  npm run build
)

MAVEN_ARGS=(clean package)
if [[ "${SKIP_MAVEN_TESTS:-false}" == "true" ]]; then
  MAVEN_ARGS+=(-DskipTests)
  log_step "Skipping Maven tests because SKIP_MAVEN_TESTS=true."
fi

log_step "Packaging all Spring Boot services with Maven..."
(
  cd "$PARENT_POM_DIR"
  mvn "${MAVEN_ARGS[@]}"
)

log_step "Packaged Spring Boot artifacts:"
for service in auth publisher pricing ui; do
  jar_path="$(resolve_service_jar "$service" 2>/dev/null || true)"
  if [[ -n "$jar_path" ]]; then
    printf '  - %-10s %s\n' "$service" "$jar_path"
  fi
done

log_step "Full-stack build and packaging completed successfully."

