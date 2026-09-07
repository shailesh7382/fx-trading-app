# FX Trading App — packaged stack

Every service in this archive is a self-contained Spring Boot application. Only a Java 21 runtime and
bash are required; nothing is installed and nothing is written outside this directory.

## Run it

```bash
bin/start.sh     # starts simulator, backend, then frontend, waiting for each to accept connections
bin/status.sh    # one line per service; exits non-zero if any service is down
bin/stop.sh      # stops in reverse order, SIGTERM first and SIGKILL only if that is ignored
```

| Service | Port | URL |
| --- | --- | --- |
| Frontend (trading UI) | 5173 | http://localhost:5173 |
| Backend | 8080 | http://localhost:8080/api/fxprices |
| Simulator | 8090 | http://localhost:8090/swagger-ui.html |

The backend also opens an H2 TCP server on 9092.

## Layout

- `bin/` — the start, stop, and status scripts
- `lib/` — one executable Spring Boot jar per service
- `conf/` — optional property overrides, shared and per service
- `logs/` — one log per service, created on first start
- `run/` — pid files, created on first start

## Configuration

`conf/application.properties` applies to every service; `conf/<service>/application.properties` applies
to one and takes precedence. Both are optional. `FX_JAVA_OPTS` is passed to every JVM, and `FX_LOG_DIR`,
`FX_RUN_DIR`, `FX_STARTUP_TIMEOUT`, and `FX_SHUTDOWN_TIMEOUT` relocate or retime the scripts.
