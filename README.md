# FX Trading App

This repository contains a multi-service FX trading demo stack:

- `open-api-spec` — authored OpenAPI contract plus generated Java API interfaces and models
- `simulator` — executable FX pricing, idempotent trade booking, and resting limit orders
- `backend` — authentication, pricing API, JMS subscriber, legacy market data model, and H2 TCP server
- `frontend` — Spring Boot host for the SPA, with the React app under `frontend/app`
- `distribution` — packages every service and its operating scripts into one tarball

The backend has intentionally not been connected to the simulator yet. It continues to use its existing
JMS integration until the backend migration is implemented separately.

## Simulator API

The simulator runs on port `8090` and exposes the authored contract at:

- Swagger UI: `http://localhost:8090/swagger-ui.html`
- OpenAPI YAML: `http://localhost:8090/openapi/fx-simulator-api.yaml`
- Pricing: `POST /api/v1/pricing/quotes` and `GET /api/v1/pricing/quotes/{quoteId}`
- Booking: `POST /api/v1/bookings` and `GET /api/v1/bookings/{tradeId}`
- Limit orders: `POST /api/v1/limit-orders`, `GET /api/v1/limit-orders/{orderId}`, `DELETE /api/v1/limit-orders/{orderId}`

Pricing supports `ONE_WAY` requests with flat `side`, `coverPrice`, `clientPrice`, and `swapPoints` response
fields. `TWO_WAY` requests return flat `buy*` and `sell*` price fields. Every request carries channel, segment,
customer, and request identification; responses echo that context and add a response ID and timestamp. Forward
prices are generated from tenor-specific currency curves.

## Limit orders and their callback

A limit order carries the same identification as every other request (`requestId`, `channel`, `segment`,
`customerId`) plus an `Idempotency-Key` header scoped by customer, exactly like booking. It rests until the
executable client price reaches its limit, its `GOOD_TILL_TIME` expiry passes, or it is cancelled. Working
orders are re-priced on a fixed interval, so a fill takes the price quoted at the evaluation that triggered
it, never the limit itself. A triggered order books a trade that is retrievable at `/api/v1/bookings/{tradeId}`.

When an order becomes `TRIGGERED` or `EXPIRED`, the simulator POSTs a `LimitOrderEvent` to the order's
`callbackUrl` — the contract declares this as an OpenAPI `callbacks` operation on the placement endpoint.
Delivery is at least once with exponential backoff, and `eventId` is stable across retries, so receivers
dedupe on it. Delivery runs separately from evaluation, so an unreachable receiver never delays other orders;
the order itself reports `callbackStatus` and `callbackAttempts`. Cancellations produce no event, because the
caller already has the outcome in the cancel response.

The simulator only posts to a configured prefix, so a caller cannot aim it at an arbitrary host; a URL
outside the allowlist is rejected with 422. The defaults live in `simulator/src/main/resources/application.properties`:

```properties
simulator.limit-orders.evaluation-interval=250ms
simulator.limit-orders.callback.allowed-prefixes[0]=http://localhost:8080/
simulator.limit-orders.callback.max-attempts=5
simulator.limit-orders.callback.initial-backoff=1s
```

The default prefix points at the backend's origin, but the backend does not expose a receiving endpoint yet —
that arrives with the backend migration described above.

The validated Spring server interfaces, shared DTOs, and declarative Spring HTTP client interfaces are generated
during Maven's `generate-sources` phase. Edit the YAML in `open-api-spec`; do not edit files under
`target/generated-sources`. The generated client interfaces are ready for the later backend integration.

## Packaged distribution

`mvn package` at the repository root builds every service and produces one self-contained archive:

```
distribution/target/fx-trading-app-<version>.tar.gz
```

It needs only a Java 21 runtime and bash wherever it is unpacked:

```bash
tar xzf distribution/target/fx-trading-app-1.0-SNAPSHOT.tar.gz
cd fx-trading-app-1.0-SNAPSHOT
bin/start.sh     # simulator, then backend, then frontend, waiting for each port
bin/status.sh    # one line per service; non-zero exit if any service is down
bin/stop.sh      # reverse order, SIGTERM first, SIGKILL only if ignored
```

The archive holds `lib/` (one executable Spring Boot jar per service), `bin/`, and `conf/`; `logs/` and
`run/` are created on first start. `conf/application.properties` overrides every service and
`conf/<service>/application.properties` overrides one, both optional. `FX_JAVA_OPTS` reaches every JVM.

The frontend jar carries the Vite bundle, which Maven builds with npm during `prepare-package`. Java-only
builds are unaffected — `mvn test` never invokes npm — and `-Dui.build.skip=true` packages whatever bundle
is already on disk, which is what `scripts/build-package-full-stack.sh` does after building it itself.

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

1. runs `npm run build` inside `frontend/app`
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
