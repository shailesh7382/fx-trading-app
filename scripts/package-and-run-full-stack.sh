#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${1:-}" == '-h' || "${1:-}" == '--help' ]]; then
  exec "$SCRIPT_DIR/build-package-full-stack.sh" --help
fi

"$SCRIPT_DIR/build-package-full-stack.sh" "$@"
exec "$SCRIPT_DIR/start-full-stack.sh" --mode packaged
