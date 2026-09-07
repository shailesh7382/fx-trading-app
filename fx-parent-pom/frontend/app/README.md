# FX Trading Workspace UI

This frontend has been upgraded from Create React App to **Vite** and redesigned into a more polished, mobile-ready FX trading workspace.

## What changed

### Review summary of the old UI

- The app shell was tied to a desktop-only permanent drawer and did not scale well on mobile.
- The workflow between rates, booking, blotter, analysis, and portfolio was fragmented.
- Login, rate monitoring, and booking states were tightly coupled to direct component state with minimal resilience.
- The CRA toolchain and older dependency set added weight without improving the runtime UX.

### Upgrade summary

- Migrated from **Create React App** to **Vite 8**
- Upgraded the main libraries to current versions of **React 19**, **React Router 7**, **MUI 9**, **Emotion**, and **Axios**
- Replaced the old placeholder pages with a responsive trading workspace flow
- Added a resilient **demo mode** and **local trade capture fallback** so the UI remains reviewable if services are offline
- Added **Vitest** + **Testing Library** for frontend verification

## UX flow now included

- **Login / demo entry**
- **Dashboard overview** with workspace metrics and next actions
- **Live rate cards** with search, filters, export, and one-tap booking
- **Structured trade ticket** with quote expiry, repricing, and coverage fields
- **Trade blotter** with KPIs, filters, and export
- **Market analysis** view driven by current feed conditions
- **Portfolio** view with derived exposures and customer concentration

## Project structure

```
src/
├── main.tsx              entry point
├── app/                  App root, route table, MUI theme
├── features/             one folder per screen area
│   ├── auth/             Login, ProtectedRoute, UserProvider
│   ├── workspace/        WorkspaceLayout shell + useWorkspaceData
│   ├── rates/            RateGrid
│   ├── limit-orders/     LimitOrders
│   ├── notifications/    Notifications
│   ├── booking/          TradeBooking
│   ├── blotter/          TradeBlotter
│   ├── analysis/         MarketAnalysis
│   └── portfolio/        Portfolio (built, not currently routed)
├── shared/               cross-feature code
│   ├── api/client.ts     typed axios client
│   ├── types/            domain model
│   ├── utils/            formatters, CSV export
│   └── demo/             demo-mode fallback data
└── assets/

tests/                    separate package, mirrors src/, own tsconfig
```

Imports use the `@/` alias for `src/`, declared in `tsconfig.base.json` and `vite.config.ts`.

## Environment variables

Copy `.env.example` to `.env` if you want to override the defaults.

```bash
cp .env.example .env
```

Available variables:

- `VITE_API_URL` — defaults to the same-origin `/api` path proxied to the backend

## Scripts

```bash
npm install
npm run dev        # Vite dev server on :5173
npm run typecheck  # tsc over src/ and tests/
npm run build      # typecheck, then production bundle into dist/
npm run preview
npm test           # Vitest
```

## Local development

```bash
npm install
npm run dev
```

Vite serves the app on `http://localhost:5173` by default.

## Production build

```bash
npm run build
npm run preview
```

The production output is generated in `dist/`.

## Test

```bash
npm test
```

## Notes

- When backend services are reachable, the UI will use live auth and pricing endpoints.
- When pricing or booking endpoints are unavailable, the app falls back to demo liquidity and local trade persistence to keep the full UX flow usable.
