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
    amendLimitOrder: vi.fn(),
    cancelLimitOrder: vi.fn(),
    fetchFxGrid: vi.fn(),
    submitLimitOrder: vi.fn(),
  };
});

import { amendLimitOrder, cancelLimitOrder, fetchFxGrid, submitLimitOrder } from '../api/client';

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
    goodTillDate: new Date().toISOString().slice(0, 10),
  });
  amendLimitOrder.mockResolvedValue({
    ...activeLimitOrder,
    qty: 2000000,
    limitPrice: 1.08325,
    status: 'ACTIVE',
    comments: 'Amended from test',
  });
  cancelLimitOrder.mockResolvedValue({
    ...activeLimitOrder,
    status: 'CANCELLED',
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

  await user.click(screen.getByRole('combobox', { name: /eurusd limit order tif/i }));
  await user.click(screen.getByRole('option', { name: 'GTD' }));
  await user.clear(screen.getByRole('spinbutton', { name: /eurusd limit price/i }));
  await user.type(screen.getByRole('spinbutton', { name: /eurusd limit price/i }), '1.08310');

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
      goodTillDate: new Date().toISOString().slice(0, 10),
      trader: 'demo.trader',
    })
  );
  expect(refresh).toHaveBeenCalled();
  expect(await screen.findByText(/limit order LO-240526-002 submitted/i)).toBeInTheDocument();
});

test('amends an active limit order from the current orders panel', async () => {
  const user = userEvent.setup();
  const { refresh } = renderRateGrid();

  await screen.findByText(/LO-240526-001/i);

  await user.click(screen.getByRole('button', { name: /amend/i }));
  await user.clear(screen.getByLabelText(/quantity/i));
  await user.type(screen.getByLabelText(/quantity/i), '2000000');
  await user.clear(screen.getByLabelText(/comments/i));
  await user.type(screen.getByLabelText(/comments/i), 'Amended from test');
  await user.clear(screen.getByLabelText(/^limit price$/i));
  await user.type(screen.getByLabelText(/^limit price$/i), '1.08325');
  await user.click(screen.getByRole('button', { name: /save amend/i }));

  expect(amendLimitOrder).toHaveBeenCalledWith(
    'LO-240526-001',
    expect.objectContaining({
      qty: 2000000,
      limitPrice: 1.08325,
      comments: 'Amended from test',
    })
  );
  expect(refresh).toHaveBeenCalled();
  expect(await screen.findByText(/limit order LO-240526-001 amended successfully/i)).toBeInTheDocument();
});

test('cancels an active limit order from the current orders panel', async () => {
  const user = userEvent.setup();
  const { refresh } = renderRateGrid();

  await screen.findByText(/LO-240526-001/i);
  await user.click(screen.getByRole('button', { name: /cancel order/i }));

  expect(cancelLimitOrder).toHaveBeenCalledWith('LO-240526-001');
  expect(refresh).toHaveBeenCalled();
  expect(await screen.findByText(/limit order LO-240526-001 cancelled successfully/i)).toBeInTheDocument();
});

