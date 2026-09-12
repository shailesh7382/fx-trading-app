import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import RateGrid from '@/features/rates/RateGrid';
import { UserContext } from '@/features/auth/UserProvider';
import type { LimitOrder } from '@/shared/types';
import type { WorkspaceContextValue } from '@/features/workspace/useWorkspaceData';
import { TestWorkspaceShell, createRate, createUserContext, createWorkspaceContext } from '../../support/fixtures';

vi.mock('@/shared/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/shared/api/client')>('@/shared/api/client');
  return {
    ...actual,
    amendLimitOrder: vi.fn(),
    cancelLimitOrder: vi.fn(),
    fetchFxGrid: vi.fn(),
    submitLimitOrder: vi.fn(),
  };
});

import {
  amendLimitOrder,
  cancelLimitOrder,
  fetchFxGrid,
  submitLimitOrder,
} from '@/shared/api/client';

const testRate = createRate();

const activeLimitOrder: LimitOrder = {
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

function renderRateGrid(workspaceOverrides: Partial<WorkspaceContextValue> = {}) {
  const workspaceData = createWorkspaceContext({
    rates: [testRate],
    lastUpdated: testRate.updatedAt,
    limitOrders: [activeLimitOrder],
    ...workspaceOverrides,
  });

  const userContextValue = createUserContext({ bookTrade: vi.fn() });

  const tree = (data: WorkspaceContextValue) => (
    <UserContext.Provider value={userContextValue}>
      <MemoryRouter initialEntries={['/app/rates']}>
        <Routes>
          <Route path="/app" element={<TestWorkspaceShell workspaceData={data} />}>
            <Route path="rates" element={<RateGrid />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </UserContext.Provider>
  );

  const renderResult = render(tree(workspaceData));

  return {
    refresh: workspaceData.refresh,
    updateWorkspace: (updates: Partial<WorkspaceContextValue>) =>
      renderResult.rerender(tree({ ...workspaceData, ...updates })),
    ...renderResult,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchFxGrid).mockResolvedValue([testRate]);
  vi.mocked(submitLimitOrder).mockResolvedValue({
    ...activeLimitOrder,
    id: 'LO-240526-002',
    timeInForce: 'GTD',
    goodTillDate: new Date().toISOString().slice(0, 10),
  });
  vi.mocked(amendLimitOrder).mockResolvedValue({
    ...activeLimitOrder,
    qty: 2000000,
    limitPrice: 1.08325,
    status: 'ACTIVE',
    comments: 'Amended from test',
  });
  vi.mocked(cancelLimitOrder).mockResolvedValue({
    ...activeLimitOrder,
    status: 'CANCELLED',
  });
});

test('shows active limit orders on the right-hand side', async () => {
  renderRateGrid();

  expect(await screen.findByText(/current limit orders/i)).toBeTruthy();
  expect(screen.getByText(/LO-240526-001/i)).toBeTruthy();
  expect(screen.getByText(/Buy EURUSD/i)).toBeTruthy();
});

test('reloads RFQ rates when the workspace refresh signal fires', async () => {
  const { updateWorkspace } = renderRateGrid();

  await waitFor(() => expect(fetchFxGrid).toHaveBeenCalledTimes(1));

  updateWorkspace({ manualRefreshToken: 1 });

  await waitFor(() => expect(fetchFxGrid).toHaveBeenCalledTimes(2));
});

test('submits a spot GTD limit order from the rate grid', async () => {
  const user = userEvent.setup();
  const { refresh } = renderRateGrid({ limitOrders: [] });

  await screen.findByRole('button', { name: /^submit$/i });

  await user.click(screen.getByRole('combobox', { name: /eurusd limit order tif/i }));
  await user.click(screen.getByRole('option', { name: 'GTD' }));
  await user.clear(screen.getByRole('spinbutton', { name: /eurusd limit price/i }));
  await user.type(screen.getByRole('spinbutton', { name: /eurusd limit price/i }), '1.08310');

  await user.click(screen.getByRole('button', { name: /^submit$/i }));

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
  expect(await screen.findByText(/limit order LO-240526-002 submitted/i)).toBeTruthy();
});

test('amends an active limit order from the current orders panel', async () => {
  const user = userEvent.setup();
  const { refresh } = renderRateGrid();

  await screen.findByText(/LO-240526-001/i);

  await user.click(screen.getByRole('button', { name: /amend/i }));
  await user.clear(screen.getByLabelText(/^quantity$/i));
  await user.type(screen.getByLabelText(/^quantity$/i), '2000000');
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
  expect(await screen.findByText(/limit order LO-240526-001 amended successfully/i)).toBeTruthy();
});

test('cancels an active limit order from the current orders panel', async () => {
  const user = userEvent.setup();
  const { refresh } = renderRateGrid();

  await screen.findByText(/LO-240526-001/i);
  await user.click(screen.getByRole('button', { name: /cancel order/i }));

  expect(cancelLimitOrder).toHaveBeenCalledWith('LO-240526-001');
  expect(refresh).toHaveBeenCalled();
  expect(await screen.findByText(/limit order LO-240526-001 cancelled successfully/i)).toBeTruthy();
});
