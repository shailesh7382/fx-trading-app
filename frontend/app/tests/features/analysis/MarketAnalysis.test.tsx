import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, test } from 'vitest';
import MarketAnalysis from '@/features/analysis/MarketAnalysis';
import type { NormalizedRate } from '@/shared/types';
import { TestWorkspaceShell, createRate, createWorkspaceContext } from '../../support/fixtures';

// spreadPips is set explicitly: the shared fixture assumes a 4-decimal pair, which
// would report a JPY cross as hundreds of pips.
const rates: NormalizedRate[] = [
  createRate({ ccyPair: 'EURUSD', tenor: 'SP', bid: 1.08321, ask: 1.08339, spreadPips: 1.8, bidDelta: 0.00042 }),
  createRate({ ccyPair: 'GBPUSD', tenor: 'SP', bid: 1.27301, ask: 1.27324, spreadPips: 2.3, bidDelta: -0.00068 }),
  createRate({ ccyPair: 'USDJPY', tenor: 'SP', bid: 156.238, ask: 156.259, spreadPips: 2.1, bidDelta: 0.037 }),
];

function renderAnalysisScreen(overrides: Partial<ReturnType<typeof createWorkspaceContext>> = {}) {
  const workspaceData = createWorkspaceContext({ rates, ...overrides });

  render(
    <MemoryRouter initialEntries={['/app/analysis']}>
      <Routes>
        <Route path="/app" element={<TestWorkspaceShell workspaceData={workspaceData} />}>
          <Route path="analysis" element={<MarketAnalysis />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

test('summarises spreads and moves across the live feed', () => {
  renderAnalysisScreen();

  // EURUSD 1.8 pips, GBPUSD 2.3 pips, USDJPY 2.1 pips -> average 2.1, tightest EURUSD, widest GBPUSD.
  expect(screen.getByText('2.1 pips')).toBeTruthy();
  expect(within(screen.getByText('Tightest').closest('div') as HTMLElement).getByText('EURUSD')).toBeTruthy();
  expect(within(screen.getByText('Widest').closest('div') as HTMLElement).getByText('GBPUSD')).toBeTruthy();
  expect(screen.getByText(/3 instruments/)).toBeTruthy();
  expect(screen.getByText(/2 up \/ 1 down/)).toBeTruthy();
});

test('names the largest mover in pips rather than raw price units', () => {
  renderAnalysisScreen();

  // GBPUSD moved -0.00068 -> -6.8 pips, the largest absolute move of the three.
  expect(screen.getByText(/-6.8 pips since last tick/i)).toBeTruthy();
});

test('plots both charts and lists every quote in the table view', () => {
  renderAnalysisScreen();

  expect(screen.getByText('Session moves')).toBeTruthy();
  expect(screen.getByText('Spread by instrument')).toBeTruthy();

  const table = screen.getByRole('table');
  expect(within(table).getAllByRole('row')).toHaveLength(rates.length + 1);
  expect(within(table).getByText('1.08321')).toBeTruthy();
});

test('falls back to an empty state when no quotes have arrived', () => {
  renderAnalysisScreen({ rates: [] });

  expect(screen.getByText(/no market data yet/i)).toBeTruthy();
  expect(screen.queryByRole('table')).toBeNull();
});
