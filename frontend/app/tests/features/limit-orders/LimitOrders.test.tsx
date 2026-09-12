import { render, screen, within } from '@testing-library/react';
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
    amendLimitOrder: vi.fn(),
    cancelLimitOrder: vi.fn(),
  };
});

import { amendLimitOrder, cancelLimitOrder, fetchLimitOrders } from '@/shared/api/client';

const activeOrder: LimitOrder = {
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
  lastEvaluatedAt: '2026-05-26T08:10:00.000Z',
  lastEvaluatedPrice: 1.0836,
};

const limitOrders: LimitOrder[] = [
  activeOrder,
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

/** Opens the row action menu for a given order. */
async function openRowMenu(user: ReturnType<typeof userEvent.setup>, orderId: string) {
  await user.click(screen.getByLabelText(`Actions for ${orderId}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchLimitOrders).mockResolvedValue(limitOrders);
});

test('renders all limit orders and summary metrics', async () => {
  renderHistoryScreen();

  expect(await screen.findByText(/LO-ACTIVE/i)).toBeTruthy();
  expect(screen.getByText(/LO-EXEC/i)).toBeTruthy();
  expect(screen.getByText(/LO-EXP/i)).toBeTruthy();
  expect(screen.getByText(/3 total/i)).toBeTruthy();
  expect(screen.queryByText('All limit orders')).toBeNull();
  expect(screen.queryByText('Order status and execution history.')).toBeNull();
});

test('summarises order counts across the status tiles', async () => {
  renderHistoryScreen();

  await screen.findByText(/LO-ACTIVE/i);

  expect(screen.getByRole('tab', { name: /working \(1\)/i })).toBeTruthy();
  expect(screen.getByRole('tab', { name: /filled \(1\)/i })).toBeTruthy();
  expect(screen.getByRole('tab', { name: /expired \(1\)/i })).toBeTruthy();
  expect(screen.getByRole('tab', { name: /cancelled \(0\)/i })).toBeTruthy();
});

test('filters the history screen by status', async () => {
  const user = userEvent.setup();
  renderHistoryScreen();

  await screen.findByText(/LO-ACTIVE/i);

  await user.click(screen.getByRole('tab', { name: /filled/i }));

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

test('sorts by quantity when the column header is activated', async () => {
  const user = userEvent.setup();
  renderHistoryScreen();

  await screen.findByText(/LO-ACTIVE/i);
  await user.click(screen.getByRole('button', { name: /quantity/i }));

  const orderIds = screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getByText(/^LO-/).textContent);

  expect(orderIds).toEqual(['LO-ACTIVE', 'LO-EXP', 'LO-EXEC']);
});

test('only offers amend and cancel while an order is still working', async () => {
  const user = userEvent.setup();
  renderHistoryScreen();

  await screen.findByText(/LO-ACTIVE/i);

  await openRowMenu(user, 'LO-ACTIVE');
  expect(screen.getByRole('menuitem', { name: 'Amend' }).getAttribute('aria-disabled')).toBeNull();
  await user.keyboard('{Escape}');

  await openRowMenu(user, 'LO-EXEC');
  expect(screen.getByRole('menuitem', { name: 'Amend' }).getAttribute('aria-disabled')).toBe('true');
  expect(screen.getByRole('menuitem', { name: 'Cancel order' }).getAttribute('aria-disabled')).toBe('true');
});

test('amends a working order through the amend ticket', async () => {
  const user = userEvent.setup();
  vi.mocked(amendLimitOrder).mockResolvedValue({ ...activeOrder, limitPrice: 1.08 });
  renderHistoryScreen();

  await screen.findByText(/LO-ACTIVE/i);

  await openRowMenu(user, 'LO-ACTIVE');
  await user.click(screen.getByRole('menuitem', { name: 'Amend' }));

  const limitPriceField = screen.getByLabelText(/limit price/i);
  await user.clear(limitPriceField);
  await user.type(limitPriceField, '1.08');
  await user.click(screen.getByRole('button', { name: /save amendment/i }));

  expect(amendLimitOrder).toHaveBeenCalledWith(
    'LO-ACTIVE',
    expect.objectContaining({ qty: 1000000, limitPrice: 1.08, timeInForce: 'GTC' })
  );
  expect(await screen.findByText(/LO-ACTIVE amended/i)).toBeTruthy();
});

test('rejects an amendment with a non-positive quantity', async () => {
  const user = userEvent.setup();
  renderHistoryScreen();

  await screen.findByText(/LO-ACTIVE/i);

  await openRowMenu(user, 'LO-ACTIVE');
  await user.click(screen.getByRole('menuitem', { name: 'Amend' }));

  const quantityField = screen.getByLabelText(/quantity/i);
  await user.clear(quantityField);
  await user.type(quantityField, '0');
  await user.click(screen.getByRole('button', { name: /save amendment/i }));

  expect(screen.getByText(/quantity greater than zero/i)).toBeTruthy();
  expect(amendLimitOrder).not.toHaveBeenCalled();
});

test('cancels a working order after confirmation', async () => {
  const user = userEvent.setup();
  vi.mocked(cancelLimitOrder).mockResolvedValue({ ...activeOrder, status: 'CANCELLED' });
  renderHistoryScreen();

  await screen.findByText(/LO-ACTIVE/i);

  await openRowMenu(user, 'LO-ACTIVE');
  await user.click(screen.getByRole('menuitem', { name: 'Cancel order' }));

  expect(screen.getByText(/cannot be undone/i)).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Cancel order' }));

  expect(cancelLimitOrder).toHaveBeenCalledWith('LO-ACTIVE');
  expect(await screen.findByText(/LO-ACTIVE cancelled/i)).toBeTruthy();
});

test('keeps a working order when the cancellation is dismissed', async () => {
  const user = userEvent.setup();
  renderHistoryScreen();

  await screen.findByText(/LO-ACTIVE/i);

  await openRowMenu(user, 'LO-ACTIVE');
  await user.click(screen.getByRole('menuitem', { name: 'Cancel order' }));
  await user.click(screen.getByRole('button', { name: /keep order/i }));

  expect(cancelLimitOrder).not.toHaveBeenCalled();
});

test('opens the detail drawer with the full order record', async () => {
  const user = userEvent.setup();
  renderHistoryScreen();

  await user.click(await screen.findByText(/LO-EXEC/i));

  const drawer = screen.getByRole('presentation');
  expect(within(drawer).getByText(/156\.251/)).toBeTruthy();
  expect(within(drawer).getByText(/GTD 2026-05-30/)).toBeTruthy();
});

test('shows an empty state when nothing matches the filters', async () => {
  const user = userEvent.setup();
  renderHistoryScreen();

  await screen.findByText(/LO-ACTIVE/i);
  await user.type(screen.getByLabelText(/search orders/i), 'no-such-order');

  expect(screen.getByText(/no matching orders/i)).toBeTruthy();

  await user.click(screen.getByRole('button', { name: /clear filters/i }));

  expect(screen.getByText(/LO-ACTIVE/i)).toBeTruthy();
});
