#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
    echo "Usage: $(basename "$0") <report-type> [YYYY-MM-DD] [output-directory]" >&2
    echo "Report types: executed-orders, trades, users-logged-in, users-traded, live-orders" >&2
}

if [[ $# -lt 1 || $# -gt 3 ]]; then
    usage
    exit 64
fi

report_type=$1
report_date=${2:-${REPORT_DATE:-}}
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
output_dir=${3:-${REPORT_OUTPUT_DIR:-"$script_dir/output"}}
base_url=${BACKEND_BASE_URL:-http://localhost:8080}
base_url=${base_url%/}

case "$report_type" in
    executed-orders|trades|users-logged-in|users-traded|live-orders) ;;
    *)
        echo "Unsupported report type: $report_type" >&2
        usage
        exit 64
        ;;
esac

if [[ -n "$report_date" && ! "$report_date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    echo "Report date must use YYYY-MM-DD format: $report_date" >&2
    exit 64
fi

command -v curl >/dev/null 2>&1 || { echo "curl is required." >&2; exit 69; }
mkdir -p "$output_dir"

body_file=$(mktemp "$output_dir/.${report_type}.body.XXXXXX")
header_file=$(mktemp "$output_dir/.${report_type}.headers.XXXXXX")
cleanup() {
    rm -f "$body_file" "$header_file"
}
trap cleanup EXIT INT TERM

url="$base_url/api/reports/daily/$report_type"
if [[ -n "$report_date" ]]; then
    url="$url?date=$report_date"
fi

curl_args=(
    --silent
    --show-error
    --fail-with-body
    --location
    --retry 3
    --retry-delay 1
    --retry-connrefused
    --connect-timeout 5
    --max-time 120
    --header "Accept: application/pdf"
    --dump-header "$header_file"
    --output "$body_file"
)
if [[ -n "${BACKEND_BEARER_TOKEN:-}" ]]; then
    curl_args+=(--header "Authorization: Bearer $BACKEND_BEARER_TOKEN")
fi

echo "Downloading $report_type daily report from $url"
curl "${curl_args[@]}" "$url"

content_type=$(awk 'BEGIN { IGNORECASE=1 } tolower($1) == "content-type:" { gsub("\r", "", $2); print tolower($2) }' "$header_file" | tail -n 1)
if [[ "$content_type" != application/pdf* ]]; then
    echo "Unexpected response content type: ${content_type:-missing}" >&2
    exit 65
fi

signature=$(LC_ALL=C head -c 5 "$body_file")
if [[ "$signature" != "%PDF-" ]]; then
    echo "The endpoint response is not a valid PDF document." >&2
    exit 65
fi

response_date=$(awk 'BEGIN { IGNORECASE=1 } tolower($1) == "x-report-date:" { gsub("\r", "", $2); print $2 }' "$header_file" | tail -n 1)
if [[ ! "$response_date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    echo "The endpoint did not return a valid X-Report-Date header." >&2
    exit 65
fi

destination="$output_dir/fx-$report_type-$response_date.pdf"
chmod 0644 "$body_file"
mv -f "$body_file" "$destination"
echo "Created $destination"
