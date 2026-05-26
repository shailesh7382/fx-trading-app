import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import FXRateGrid from './FXRateGrid';
import UserContext from './UserContext';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return {
    ...actual,
    fetchFxGrid: vi.fn(),
    submitLimitOrder: vi.fn(),
  };
});

import { fetchFxGrid, submitLimitOrder } from '../api/client';

function TestWorkspaceShell({ workspaceData }) {
  return <Outlet context={workspaceData} />;
}

const testRate = {
  ccyPair: 'EURUSD',
  tenor: 'SP',
  qty: 5000000,
  bid: 1.08321,
  ask: 1.08339,
  source: 'STREAM',
  status: 'LIVE',
  updatedAt: '2026-05-26T08:00:00.000Z',
};

const activeLimitOrder = {
  id: 'LO-240526-001',
  ccyPair: 'EURUSD',
  tenor: 'SP',
  qty: 1000000,
  direction: 'Buy',
  dealtCurrency: 'EUR',
  limitPrice: 1.0831,
  timeInForce: 'GTC',
  status: 'ACTIVE',
  trader: 'demo.trader',
  submittedAt: '2026-05-26T08:02:00.000Z',
};

function renderRateGrid(workspaceOverrides = {}) {
  const refresh = vi.fn().mockResolvedValue(undefined);
  const workspaceData = {
    rates: [testRate],
    error: '',
    isLoading: false,
    lastUpdated: testRate.updatedAt,
    limitOrders: [activeLimitOrder],
    refresh,
    ...workspaceOverrides,
  };

  const userContextValue = {
    userDetails: { username: 'demo.trader' },
    trades: [],
    bookTrade: vi.fn(),
  };

  return {
    refresh,
    ...render(
      <UserContext.Provider value={userContextValue}>
        <MemoryRouter initialEntries={['/app/rates']}>
          <Routes>
            <Route path="/app" element={<TestWorkspaceShell workspaceData={workspaceData} />}>
              <Route path="rates" element={<FXRateGrid />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </UserContext.Provider>
    ),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchFxGrid.mockResolvedValue([testRate]);
  submitLimitOrder.mockResolvedValue({
    ...activeLimitOrder,
    id: 'LO-240526-002',
    timeInForce: 'GTD',
    goodTillDate: '2026-05-30',
  });
});

test('shows active limit orders on the right-hand side', async () => {
  renderRateGrid();

  expect(await screen.findByText(/current limit orders/i)).toBeInTheDocument();
  expect(screen.getByText(/LO-240526-001/i)).toBeInTheDocument();
  expect(screen.getByText(/Buy EURUSD/i)).toBeInTheDocument();
});

test('submits a spot GTD limit order from the rate grid', async () => {
  const user = userEvent.setup();
  const { refresh } = renderRateGrid({ limitOrders: [] });

  await screen.findByRole('button', { name: /submit limit order/i });

  await user.click(screen.getByLabelText(/tif/i));
  await user.click(screen.getByRole('option', { name: 'GTD' }));
  await user.clear(screen.getByLabelText(/limit price/i));
  await user.type(screen.getByLabelText(/limit price/i), '1.08310');
  await user.clear(screen.getByLabelText(/good till/i));
  await user.type(screen.getByLabelText(/good till/i), '2026-05-30');

  await user.click(screen.getByRole('button', { name: /submit limit order/i }));

  expect(submitLimitOrder).toHaveBeenCalledWith(
    expect.objectContaining({
      ccyPair: 'EURUSD',
      tenor: 'SP',
      qty: 5000000,
      direction: 'Buy',
      dealtCurrency: 'EUR',
      limitPrice: 1.0831,
      timeInForce: 'GTD',
      goodTillDate: '2026-05-30',
      trader: 'demo.trader',
    })
  );
  expect(refresh).toHaveBeenCalled();
  expect(await screen.findByText(/limit order LO-240526-002 submitted/i)).toBeInTheDocument();
});

