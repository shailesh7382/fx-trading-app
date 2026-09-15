# Full-stack scripts

The scripts in this directory provide one managed workflow for building,
starting, viewing logs, and stopping the local FX trading stack. Run them from
any working directory; paths are resolved relative to each script.

## Start modes

`start-full-stack.sh` is the canonical entry point:

```bash
scripts/start-full-stack.sh --mode development
scripts/start-full-stack.sh --mode production
scripts/start-full-stack.sh --mode packaged
```

| Mode | Java services | UI |
| --- | --- | --- |
| `development` | Packages simulator/backend, then runs their executable jars | Vite development server |
| `production` | Packages simulator/backend, then runs their executable jars | Builds `dist/` and runs the local static server |
| `packaged` | Runs existing simulator/backend/frontend executable jars | Embedded in the frontend jar |

Maven is used only to compile, test, and package artifacts. Running services
always use `java -jar`.

The following convenience commands are retained:

- `start-full-stack-prod.sh` — production-mode alias.
- `start-full-stack-packaged.sh` — packaged-mode alias.
- `package-and-run-full-stack.sh` — full package, then packaged-mode start.
- `stop-full-stack-prod.sh` — compatibility alias for the mode-independent stop command.

## Build and operations

```bash
scripts/build-package-full-stack.sh
scripts/tail-logs.sh --lines 200 --service backend
scripts/stop-full-stack.sh
scripts/reset-database.sh
```

`reset-database.sh` asks for confirmation. Use `--force` only in non-interactive
local workflows where data loss is intentional.

## Requirements

- Start flows: Bash.
- Stop flows: Bash, `nc`, and `ps`.
- Development and production modes: Java 21, Maven, Node.js, and npm.
- Packaged mode: Java 21 and previously built jars.
- Full packaging: Java 21, Maven, Node.js, and npm.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `SKIP_JAVA_BUILD` | `false` | Reuse existing simulator/backend jars when starting |
| `SKIP_UI_TESTS` | `false` | Skip UI tests during full packaging |
| `SKIP_JAVA_TESTS` | `false` | Skip Java tests during full packaging |
| `TAIL_LINES` | `150` | Default number of lines shown by `tail-logs.sh` |

The stop command additionally accepts `STOP_TIMEOUT_SECONDS` (default `30`)
and `STOP_PORT_CHECK_TIMEOUT_SECONDS` (default `1`). Set `STOP_PORT_CHECK_HOST`
to override its default of `127.0.0.1`. External process and socket inspection
is intentionally isolated in that command.

The production UI server also accepts `UI_STATIC_HOST`, `UI_STATIC_PORT`,
`UI_DIST_DIR`, `BACKEND_API_PROXY_TARGET`, and
`BACKEND_API_PROXY_TIMEOUT_MS`.

## Runtime files

Each start creates `logs/runs/<timestamp>-<pid>/`. Per-service logs and generated
launchers live in that run directory. Managed PID, metadata, and current-run state
files live under `.runtime/`.

If launching a later service fails, services already launched by that attempt are
stopped. Stop operations verify the stored process marker before sending signals
and leave untracked listeners untouched.
