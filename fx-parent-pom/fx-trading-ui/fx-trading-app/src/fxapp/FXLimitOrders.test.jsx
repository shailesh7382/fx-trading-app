import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import FXLimitOrders from './FXLimitOrders';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return {
    ...actual,
    fetchLimitOrders: vi.fn(),
  };
});

import { fetchLimitOrders } from '../api/client';

function TestWorkspaceShell({ workspaceData }) {
  return <Outlet context={workspaceData} />;
}

const limitOrders = [
  {
    id: 'LO-ACTIVE',
    ccyPair: 'EURUSD',
    tenor: 'SP',
    qty: 1000000,
    direction: 'Buy',
    dealtCurrency: 'EUR',
    limitPrice: 1.0831,
    timeInForce: 'GTC',
    status: 'ACTIVE',
    trader: 'demo.trader',
    submittedAt: '2026-05-26T08:00:00.000Z',
  },
  {
    id: 'LO-EXEC',
    ccyPair: 'USDJPY',
    tenor: 'SP',
    qty: 2000000,
    direction: 'Sell',
    dealtCurrency: 'USD',
    limitPrice: 156.25,
    timeInForce: 'GTD',
    goodTillDate: '2026-05-30',
    status: 'EXECUTED',
    trader: 'demo.trader',
    submittedAt: '2026-05-26T07:30:00.000Z',
    executedAt: '2026-05-26T08:15:00.000Z',
    executedPrice: 156.251,
  },
  {
    id: 'LO-EXP',
    ccyPair: 'GBPUSD',
    tenor: 'SP',
    qty: 1500000,
    direction: 'Buy',
    dealtCurrency: 'GBP',
    limitPrice: 1.2735,
    timeInForce: 'GTD',
    goodTillDate: '2026-05-25',
    status: 'EXPIRED',
    trader: 'demo.trader',
    submittedAt: '2026-05-24T08:00:00.000Z',
  },
];

function renderHistoryScreen() {
  const refresh = vi.fn().mockResolvedValue(undefined);

  render(
    <MemoryRouter initialEntries={['/app/limit-orders']}>
      <Routes>
        <Route path="/app" element={<TestWorkspaceShell workspaceData={{ refresh }} />}>
          <Route path="limit-orders" element={<FXLimitOrders />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

  return { refresh };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchLimitOrders.mockResolvedValue(limitOrders);
});

test('renders all limit orders and summary metrics', async () => {
  renderHistoryScreen();

  expect(await screen.findByRole('heading', { name: /all limit orders/i })).toBeInTheDocument();
  expect(screen.getByText(/LO-ACTIVE/i)).toBeInTheDocument();
  expect(screen.getByText(/LO-EXEC/i)).toBeInTheDocument();
  expect(screen.getByText(/LO-EXP/i)).toBeInTheDocument();
  expect(screen.getByText(/3 total/i)).toBeInTheDocument();
});

test('filters the history screen by status', async () => {
  const user = userEvent.setup();
  renderHistoryScreen();

  await screen.findByText(/LO-ACTIVE/i);

  await user.click(screen.getByLabelText(/order status/i));
  await user.click(screen.getByRole('option', { name: 'EXECUTED' }));

  expect(screen.queryByText(/LO-ACTIVE/i)).not.toBeInTheDocument();
  expect(screen.getByText(/LO-EXEC/i)).toBeInTheDocument();
  expect(screen.queryByText(/LO-EXP/i)).not.toBeInTheDocument();
});


