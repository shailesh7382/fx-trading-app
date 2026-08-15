#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "${script_dir}/.." && pwd)"
parent_project="${project_dir}/fx-parent-pom"

mvn -q -f "${parent_project}/pom.xml" -pl fx-pricing-rs -am test-compile

exec java \
  -cp "${parent_project}/fx-pricing-rs/target/test-classes:${parent_project}/fx-pricing-rs/target/classes" \
  com.example.util.CcyPairCrosserMicroHarness "$@"
