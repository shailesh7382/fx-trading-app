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

## Environment variables

Copy `.env.example` to `.env` if you want to override the defaults.

```bash
cp .env.example .env
```

Available variables:

- `VITE_AUTH_API_URL` — defaults to `http://localhost:8080/api`
- `VITE_PRICING_API_URL` — defaults to `http://localhost:8081/api`

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
npm test
```

## Local development

```bash
cd "/Users/shailesh/codebase-new/fx-trading-app/fx-parent-pom/fx-trading-ui/fx-trading-app"
npm install
npm run dev
```

Vite serves the app on `http://localhost:5173` by default.

## Production build

```bash
cd "/Users/shailesh/codebase-new/fx-trading-app/fx-parent-pom/fx-trading-ui/fx-trading-app"
npm run build
npm run preview
```

The production output is generated in `dist/`.

## Test

```bash
cd "/Users/shailesh/codebase-new/fx-trading-app/fx-parent-pom/fx-trading-ui/fx-trading-app"
npm test
```

## Notes

- When backend services are reachable, the UI will use live auth and pricing endpoints.
- When pricing or booking endpoints are unavailable, the app falls back to demo liquidity and local trade persistence to keep the full UX flow usable.
