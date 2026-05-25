# FX Trading App

This repository contains a multi-service FX trading demo stack:

- `fx-parent-pom/fx-auth-rs` — authentication service and H2 TCP server
- `fx-parent-pom/fx-rate-publisher` — market data publisher and embedded ActiveMQ broker
- `fx-parent-pom/fx-pricing-rs` — pricing API and JMS subscriber
- `fx-parent-pom/fx-trading-ui/fx-trading-app` — Vite-based React trading UI

## Full-stack startup scripts

The repository now includes managed bash scripts with exhaustive logs, PID tracking, and port checks under `scripts/`.

### Start everything

```bash
cd "/Users/shailesh/codebase-new/fx-trading-app"
bash scripts/start-full-stack.sh
```

### Start everything in production-oriented mode

This builds the Vite UI and serves `dist/` through a lightweight SPA-aware static server instead of using the Vite dev server.

```bash
cd "/Users/shailesh/codebase-new/fx-trading-app"
bash scripts/start-full-stack-prod.sh
```

### Check status

```bash
cd "/Users/shailesh/codebase-new/fx-trading-app"
bash scripts/status-full-stack.sh
```

### Follow current logs

```bash
cd "/Users/shailesh/codebase-new/fx-trading-app"
bash scripts/tail-logs.sh
```

### Stop everything

```bash
cd "/Users/shailesh/codebase-new/fx-trading-app"
bash scripts/stop-full-stack.sh
```

## Runtime prerequisites

The scripts expect these commands to be available on your machine:

- `java`
- `mvn`
- `node`
- `npm`
- `lsof`

## What the startup flow does

The `scripts/start-full-stack.sh` script:

1. verifies required tooling
2. creates a timestamped log directory under `logs/runs/`
3. installs UI dependencies if `node_modules/` is missing
4. starts services in dependency order:
   - auth (`8080`, H2 TCP on `9092`)
   - rate publisher / ActiveMQ (`61616`)
   - pricing (`8081`)
   - trading UI (`5173`)
5. waits for each required port before continuing
6. stores per-service PID files under `.runtime/`

## Production-oriented UI serving

`scripts/start-full-stack-prod.sh` performs the same backend startup flow, but it also:

1. runs `npm run build` inside `fx-parent-pom/fx-trading-ui/fx-trading-app`
2. serves the built files from `dist/` using `scripts/serve-ui-dist.mjs`
3. keeps SPA route fallback behavior by returning `index.html` for unknown frontend paths
4. writes UI build and HTTP access logs into the current run directory

## Same-origin API access for auth and pricing

The UI now uses same-origin API base paths by default:

- `/auth-api/...` → proxied to `http://localhost:8080/api/...`
- `/pricing-api/...` → proxied to `http://localhost:8081/api/...`

This avoids browser cross-origin API calls from the UI and helps prevent confusing network entries like `strict-origin-when-cross-origin` when using the local frontend.

- In dev mode, the Vite dev server proxies these paths.
- In production-oriented mode, `scripts/serve-ui-dist.mjs` proxies the same paths.

## Log layout

Each start run creates a fresh directory like:

- `logs/runs/<timestamp>/startup.log`
- `logs/runs/<timestamp>/auth.log`
- `logs/runs/<timestamp>/publisher.log`
- `logs/runs/<timestamp>/pricing.log`
- `logs/runs/<timestamp>/ui.log`
- `logs/runs/<timestamp>/ui-bootstrap.log` (only when `npm install` runs)

`logs/current` points to the latest run.

