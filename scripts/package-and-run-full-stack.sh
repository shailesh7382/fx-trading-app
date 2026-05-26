#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/build-package-full-stack.sh"
"$SCRIPT_DIR/start-full-stack-packaged.sh"

