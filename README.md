# FX Trading App

This repository contains a multi-service FX trading demo stack:

- `fx-parent-pom/open-api-spec` — authored OpenAPI contract plus generated Java API interfaces and models
- `fx-parent-pom/simulator` — executable FX pricing and idempotent trade-booking simulator
- `fx-parent-pom/backend` — authentication, pricing API, JMS subscriber, legacy market data model, and H2 TCP server
- `fx-parent-pom/frontend` — Spring Boot host for the SPA, with the React app under `frontend/app`

The backend has intentionally not been connected to the simulator yet. It continues to use its existing
JMS integration until the backend migration is implemented separately.

## Simulator API

The simulator runs on port `8090` and exposes the authored contract at:

- Swagger UI: `http://localhost:8090/swagger-ui.html`
- OpenAPI YAML: `http://localhost:8090/openapi/fx-simulator-api.yaml`
- Pricing: `POST /api/v1/pricing/quotes` and `GET /api/v1/pricing/quotes/{quoteId}`
- Booking: `POST /api/v1/bookings` and `GET /api/v1/bookings/{tradeId}`

Pricing supports `ONE_WAY` requests with flat `side`, `coverPrice`, `clientPrice`, and `swapPoints` response
fields. `TWO_WAY` requests return flat `buy*` and `sell*` price fields. Every request carries channel, segment,
customer, and request identification; responses echo that context and add a response ID and timestamp. Forward
prices are generated from tenor-specific currency curves.

The validated Spring server interfaces, shared DTOs, and declarative Spring HTTP client interfaces are generated
during Maven's `generate-sources` phase. Edit the YAML in `open-api-spec`; do not edit files under
`target/generated-sources`. The generated client interfaces are ready for the later backend integration.

## Full-stack startup scripts

The repository now includes managed bash scripts with exhaustive logs, PID tracking, and port checks under `scripts/`.

 ## Packaged Spring Boot full-stack flow

The stack can now be built and run fully as packaged Spring Boot applications, including the frontend.
The Vite UI bundle is copied into the `frontend` Spring Boot jar and served on port `5173`, while `/api/...` is proxied to the backend from that same frontend application.

### Build and package every service

```bash
cd "/Users/shailesh/codebase-new/fx-trading-app"
bash scripts/build-package-full-stack.sh
```

### Start the packaged Spring Boot jars

```bash
cd "/Users/shailesh/codebase-new/fx-trading-app"
bash scripts/start-full-stack-packaged.sh
```

### One command: package and run everything

```bash
cd "/Users/shailesh/codebase-new/fx-trading-app"
bash scripts/package-and-run-full-stack.sh
```

### Optional skip flags during packaging

```bash
cd "/Users/shailesh/codebase-new/fx-trading-app"
SKIP_UI_TESTS=true SKIP_MAVEN_TESTS=true bash scripts/build-package-full-stack.sh
```

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

### Stop the production-oriented stack

```bash
cd "/Users/shailesh/codebase-new/fx-trading-app"
bash scripts/stop-full-stack-prod.sh
```

### Check production-oriented stack status

```bash
cd "/Users/shailesh/codebase-new/fx-trading-app"
bash scripts/status-full-stack-prod.sh
```

### Restart the production-oriented stack

```bash
cd "/Users/shailesh/codebase-new/fx-trading-app"
bash scripts/restart-full-stack-prod.sh
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
   - FX simulator (`8090`)
   - backend (`8080`, H2 TCP on `9092`)
   - frontend (`5173`)
5. waits for each required port before continuing
6. stores per-service PID files under `.runtime/`

## Production-oriented UI serving

`scripts/start-full-stack-prod.sh` performs the same backend startup flow, but it also:

1. runs `npm run build` inside `fx-parent-pom/frontend/app`
2. serves the built files from `dist/` using `scripts/serve-ui-dist.mjs`
3. keeps SPA route fallback behavior by returning `index.html` for unknown frontend paths
4. writes UI build and HTTP access logs into the current run directory

## Same-origin API access

The UI uses a same-origin API base path by default:

- `/api/...` → proxied to `http://localhost:8080/api/...`

This avoids browser cross-origin API calls from the UI and helps prevent confusing network entries like `strict-origin-when-cross-origin` when using the local frontend.

- In dev mode, the Vite dev server proxies this path.
- In production-oriented mode, `scripts/serve-ui-dist.mjs` proxies the same path.

## Log layout

Each start run creates a fresh directory like:

- `logs/runs/<timestamp>/startup.log`
- `logs/runs/<timestamp>/auth.log`
- `logs/runs/<timestamp>/simulator.log`
- `logs/runs/<timestamp>/pricing.log`
- `logs/runs/<timestamp>/ui.log`
- `logs/runs/<timestamp>/ui-bootstrap.log` (only when `npm install` runs)

`logs/current` points to the latest run.
