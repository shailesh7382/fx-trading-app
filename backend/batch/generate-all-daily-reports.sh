#!/usr/bin/env bash
set -uo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
report_date=${1:-${REPORT_DATE:-}}
output_dir=${2:-${REPORT_OUTPUT_DIR:-"$script_dir/output"}}
report_types=(executed-orders trades users-logged-in users-traded live-orders)
failures=0

for report_type in "${report_types[@]}"; do
    if ! "$script_dir/download-daily-report.sh" "$report_type" "$report_date" "$output_dir"; then
        echo "Failed to create $report_type report." >&2
        failures=$((failures + 1))
    fi
done

if (( failures > 0 )); then
    echo "$failures daily report(s) failed." >&2
    exit 1
fi

echo "All daily reports were created in $output_dir"
