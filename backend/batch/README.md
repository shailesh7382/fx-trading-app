# Daily PDF report batch scripts

These scripts download daily PDF reports from a running backend. The backend defaults to
`http://localhost:8080`, the report date defaults to the backend's current date, and output defaults to
`backend/batch/output`.

Generate all five reports:

```bash
./generate-all-daily-reports.sh 2026-09-13 /var/reports/fx
```

Generate one report:

```bash
./generate-trades-report.sh 2026-09-13 /var/reports/fx
```

Available individual scripts cover executed orders, trades, users logged in, users traded, and live orders.
Each script retries transient connection failures, applies connection and request timeouts, rejects non-PDF
responses, verifies the PDF signature, and moves a complete download into place atomically.

Environment variables:

- `BACKEND_BASE_URL` - backend URL, default `http://localhost:8080`
- `BACKEND_BEARER_TOKEN` - optional bearer token
- `REPORT_DATE` - optional default date in `YYYY-MM-DD` format
- `REPORT_OUTPUT_DIR` - optional default output directory

The server defines business-day boundaries with `reports.zone-id` (default `Asia/Singapore`), independently
of the machine running these scripts.

The corresponding REST route is `GET /api/reports/daily/{report-type}` with an optional `date=YYYY-MM-DD`
query parameter. The endpoint returns an `application/pdf` blob with attachment, report-date, and record-count
headers. Re-running a script replaces that type's same-date file only after a complete PDF is downloaded.
