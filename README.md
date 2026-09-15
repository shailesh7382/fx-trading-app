# FX Trading App

This repository contains a multi-service FX trading demo stack:

- `open-api-spec` — authored OpenAPI contract plus generated Java API interfaces and models
- `simulator` — executable FX pricing, idempotent trade booking, and resting orders
- `backend` — authentication, a REST workspace API, generated Trading System clients, callback reconciliation, and H2 persistence
- `frontend` — Spring Boot host for the SPA, with the React app under `frontend/app`
- `distribution` — packages every service and its operating scripts into one tarball

The backend is integrated with the Trading System (implemented here by the simulator module) exclusively through HTTP interfaces generated from the authored
OpenAPI contract. It requests executable prices, books them with idempotency keys, delegates resting-order
placement/amendment/cancellation, receives terminal callbacks, and reconciles missed callbacks by trade ID.
The former JMS/local market-data engine and the unused UI streaming abstraction have been removed.

## Trading Systems API

The simulator runs on port `8090` and exposes the authored contract at:

- Swagger UI: `http://localhost:8090/swagger-ui.html`
- OpenAPI YAML: `http://localhost:8090/openapi/fx-trading-systems-api.yaml`
- Pricing: `POST /api/v1/pricing/quotes` and `GET /api/v1/pricing/quotes/{quoteId}`
- Booking: `POST /api/v1/bookings` and `GET /api/v1/bookings/{tradeId}`
- Resting orders: `POST /api/v1/resting-orders`, `GET/PUT/DELETE /api/v1/resting-orders/{orderId}`

Pricing supports `ONE_WAY` requests with flat `side`, `coverPrice`, `clientPrice`, and `swapPoints` response
fields. `TWO_WAY` requests return flat `buy*` and `sell*` price fields. Every request carries channel, segment,
customer, and request identification; responses echo that context and add a response ID and timestamp. Forward
prices are generated from tenor-specific currency curves.

## Resting orders and their callback

A resting order — today always a limit order — carries the same identification as every other request
(`requestId`, `channel`, `segment`, `customerId`). The caller names it with `orderId`, which addresses the
order from then on and doubles as the idempotency key: placement takes no `Idempotency-Key` header,
repeating the same name and terms replays the original order, and reusing the name for different terms is a
409. It rests until the executable client price reaches its limit, its `GOOD_TILL_TIME` expiry passes, or it
is cancelled. Working orders are re-priced on a fixed interval, so a fill takes the price quoted at the
evaluation that triggered it, never the limit itself. A triggered order books a trade
retrievable at `/api/v1/bookings/{tradeId}`. A triggered order exposes `tradeId` for recovery, while the event
and trade remain authoritative for execution price and settlement detail.

When an order becomes `TRIGGERED` or `EXPIRED`, the simulator POSTs a `RestingOrderEvent` to the order's
`callbackUrl` — the contract declares this as an OpenAPI `callbacks` operation on the placement endpoint.
Delivery is at least once with exponential backoff, and `eventId` is stable across retries, so receivers
dedupe on it. Delivery runs separately from evaluation, so an unreachable receiver never delays other orders;
the order itself reports `callbackStatus` and `callbackAttempts`. Cancellations produce no event, because the
caller already has the outcome in the cancel response.

[docs/resting-orders.md](docs/resting-orders.md) walks through the whole flow with diagrams and worked requests.

The simulator only posts to a configured prefix, so a caller cannot aim it at an arbitrary host; a URL
outside the allowlist is rejected with 422. The defaults live in `simulator/src/main/resources/application.properties`:

```properties
simulator.resting-orders.evaluation-interval=250ms
simulator.resting-orders.callback.allowed-prefixes[0]=http://localhost:8080/
simulator.resting-orders.callback.max-attempts=5
simulator.resting-orders.callback.initial-backoff=1s
```

The default prefix points at the backend receiver at `POST /api/resting-orders/events`. Delivery is deduplicated
by `eventId`; the backend also polls active order resources so it can recover the booked trade if callback
delivery was interrupted.

## Backend workspace API

The UI uses these backend endpoints on port `8080`:

- `GET /api/rates` and `GET /api/rates/grid` — fresh two-way Trading System quotes with quote/response IDs,
  cover prices, client prices, swap points, spot/value dates, and expiry
- `GET/POST /api/trades` — locally indexed trade history and contract-driven quote-then-book execution
- `GET/POST /api/resting-orders`, `PUT/DELETE /api/resting-orders/{orderId}` — persisted workspace views backed
  by the Trading System lifecycle
- `POST /api/resting-orders/events` — at-least-once terminal callback receiver

Client connection details, business identity defaults, instrument universe, timeouts, and callback URL are
configured under `trading-system.client.*` in `backend/src/main/resources/application.properties`.

## Daily PDF reports

The backend generates operational reports as downloadable PDF blobs through
`GET /api/reports/daily/{report-type}?date=YYYY-MM-DD`. Supported report types are `executed-orders`, `trades`,
`users-logged-in`, `users-traded`, and `live-orders`. Omitting `date` uses the current business date. Daily
boundaries use `reports.zone-id`, which defaults to `Asia/Singapore` and can be overridden with
`FX_REPORTS_ZONE_ID`.

Successful logins are recorded in `BKND_USER_LOGIN_EVENT`, allowing historical daily login reports rather
than relying on only the latest timestamp. The Oracle DDL and indexes are under `backend/sql`.

Run all report downloads against a running backend with:

```bash
backend/batch/generate-all-daily-reports.sh 2026-09-13 ./reports
```

Individual resilient download scripts and their environment options are documented in
[`backend/batch/README.md`](backend/batch/README.md).

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

## Full-stack scripts

The managed scripts support development, production-oriented, and fully
packaged start modes. They provide per-service logs, PID ownership validation,
rollback after a partial launch, stop, and local database reset operations.

```bash
scripts/start-full-stack.sh --mode development
scripts/start-full-stack.sh --mode production
scripts/start-full-stack.sh --mode packaged
```

Maven packages the Java artifacts; the running services are launched as
executable jars with `java -jar`. See [scripts/README.md](scripts/README.md) for
all commands, prerequisites, compatibility aliases, and environment options.
