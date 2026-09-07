import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import LimitOrders from '@/features/limit-orders/LimitOrders';
import type { LimitOrder } from '@/shared/types';
import { TestWorkspaceShell, createWorkspaceContext } from '../../support/fixtures';

vi.mock('@/shared/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/shared/api/client')>('@/shared/api/client');
  return {
    ...actual,
    fetchLimitOrders: vi.fn(),
  };
});

import { fetchLimitOrders } from '@/shared/api/client';

const limitOrders: LimitOrder[] = [
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
  const workspaceData = createWorkspaceContext();

  render(
    <MemoryRouter initialEntries={['/app/limit-orders']}>
      <Routes>
        <Route path="/app" element={<TestWorkspaceShell workspaceData={workspaceData} />}>
          <Route path="limit-orders" element={<LimitOrders />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

  return { refresh: workspaceData.refresh };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchLimitOrders).mockResolvedValue(limitOrders);
});

test('renders all limit orders and summary metrics', async () => {
  renderHistoryScreen();

  expect(await screen.findByRole('heading', { name: /all limit orders/i })).toBeTruthy();
  expect(screen.getByText(/LO-ACTIVE/i)).toBeTruthy();
  expect(screen.getByText(/LO-EXEC/i)).toBeTruthy();
  expect(screen.getByText(/LO-EXP/i)).toBeTruthy();
  expect(screen.getByText(/3 total/i)).toBeTruthy();
});

test('filters the history screen by status', async () => {
  const user = userEvent.setup();
  renderHistoryScreen();

  await screen.findByText(/LO-ACTIVE/i);

  await user.click(screen.getByLabelText(/order status/i));
  await user.click(screen.getByRole('option', { name: 'EXECUTED' }));

  expect(screen.queryByText(/LO-ACTIVE/i)).toBeNull();
  expect(screen.getByText(/LO-EXEC/i)).toBeTruthy();
  expect(screen.queryByText(/LO-EXP/i)).toBeNull();
});

test('searches orders by instrument or identifier', async () => {
  const user = userEvent.setup();
  renderHistoryScreen();

  await screen.findByText(/LO-ACTIVE/i);
  await user.type(screen.getByLabelText(/search orders/i), 'USDJPY');

  expect(screen.queryByText(/LO-ACTIVE/i)).toBeNull();
  expect(screen.getByText(/LO-EXEC/i)).toBeTruthy();
  expect(screen.queryByText(/LO-EXP/i)).toBeNull();
});
